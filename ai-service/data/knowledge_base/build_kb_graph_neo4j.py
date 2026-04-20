from __future__ import annotations

import argparse
import csv
import os
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from neo4j import GraphDatabase

ACTION_REL_MAP = {
    "view": "VIEWED",
    "click": "CLICKED",
    "add_to_cart": "ADDED_TO_CART",
}


def parse_args() -> argparse.Namespace:
    base_dir = Path(__file__).resolve().parents[2]
    default_csv = base_dir / "data" / "model_behavior" / "data_user500.csv"

    parser = argparse.ArgumentParser(description="Build Neo4j KB graph from behavior CSV")
    parser.add_argument("--csv", type=str, default=str(default_csv), help="Path to behavior csv")
    parser.add_argument("--uri", type=str, default=os.getenv("NEO4J_URI", "bolt://localhost:7687"), help="Neo4j URI")
    parser.add_argument("--user", type=str, default=os.getenv("NEO4J_USER", "neo4j"), help="Neo4j user")
    parser.add_argument(
        "--password",
        type=str,
        default=os.getenv("NEO4J_PASSWORD", "neo4j12345"),
        help="Neo4j password",
    )
    parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="Delete existing User/Product graph relationships before importing",
    )
    return parser.parse_args()


def read_behavior_csv(csv_path: Path) -> List[Dict[str, str]]:
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    rows: List[Dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = [str(c).strip().replace("\ufeff", "") for c in (reader.fieldnames or [])]
        reader.fieldnames = fieldnames
        required = {"user_id", "product_id", "action", "timestamp"}
        missing = required - set(fieldnames)
        if missing:
            raise ValueError(f"Missing columns: {sorted(missing)}")

        for row in reader:
            action = str(row.get("action", "")).strip().lower()
            if action not in ACTION_REL_MAP:
                continue

            rows.append(
                {
                    "user_id": int(row["user_id"]),
                    "product_id": int(row["product_id"]),
                    "action": action,
                    "timestamp": str(row["timestamp"]),
                }
            )

    return rows


def aggregate_events(rows: Iterable[Dict[str, str]]) -> List[Dict[str, object]]:
    grouped: Dict[Tuple[int, int, str], Dict[str, object]] = defaultdict(dict)

    for r in rows:
        key = (int(r["user_id"]), int(r["product_id"]), str(r["action"]))
        ts = str(r["timestamp"])

        if not grouped[key]:
            grouped[key] = {
                "uid": key[0],
                "pid": key[1],
                "action": key[2],
                "count": 1,
                "first_at": ts,
                "last_at": ts,
            }
            continue

        grouped[key]["count"] = int(grouped[key]["count"]) + 1
        if ts < str(grouped[key]["first_at"]):
            grouped[key]["first_at"] = ts
        if ts > str(grouped[key]["last_at"]):
            grouped[key]["last_at"] = ts

    return list(grouped.values())


def create_schema(session) -> None:
    session.run("CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
    session.run("CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE")


def clear_graph(session) -> None:
    session.run(
        """
        MATCH (:User)-[r:VIEWED|CLICKED|ADDED_TO_CART|SIMILAR]->(:Product)
        DELETE r
        """
    )


def sync_aggregated(session, agg_rows: List[Dict[str, object]]) -> None:
    by_rel: Dict[str, List[Dict[str, object]]] = {
        "VIEWED": [],
        "CLICKED": [],
        "ADDED_TO_CART": [],
    }

    for row in agg_rows:
        rel_type = ACTION_REL_MAP[str(row["action"])]
        by_rel[rel_type].append(row)

    for rel_type, rows in by_rel.items():
        if not rows:
            continue

        query = f"""
        UNWIND $rows AS row
        MERGE (u:User {{id: row.uid}})
        MERGE (p:Product {{id: row.pid}})
        MERGE (u)-[r:{rel_type}]->(p)
        SET r.count = row.count,
            r.first_at = row.first_at,
            r.last_at = row.last_at
        """
        session.run(query, rows=rows)


def build_similar_links(session) -> None:
    session.run(
        """
        MATCH (p1:Product)<-[:VIEWED|CLICKED|ADDED_TO_CART]-(:User)-[:VIEWED|CLICKED|ADDED_TO_CART]->(p2:Product)
        WHERE p1.id <> p2.id
        WITH p1, p2, count(*) AS c
        WHERE c >= 1
        MERGE (p1)-[s:SIMILAR]->(p2)
        SET s.weight = c
        """
    )


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv)

    rows = read_behavior_csv(csv_path)
    agg_rows = aggregate_events(rows)

    driver = GraphDatabase.driver(args.uri, auth=(args.user, args.password))

    try:
        with driver.session() as session:
            create_schema(session)
            if args.clear_existing:
                clear_graph(session)
            sync_aggregated(session, agg_rows)
            build_similar_links(session)

            counts = session.run(
                """
                MATCH (u:User)
                WITH count(u) AS users
                MATCH (p:Product)
                WITH users, count(p) AS products
                MATCH ()-[r:VIEWED|CLICKED|ADDED_TO_CART]->()
                WITH users, products, count(r) AS behavior_rels
                MATCH ()-[s:SIMILAR]->()
                RETURN users, products, behavior_rels, count(s) AS similar_rels
                """
            ).single()

        print("KB_Graph build completed.")
        print(f"CSV rows: {len(rows)}")
        print(f"Aggregated behavior relationships: {len(agg_rows)}")
        print(
            "Graph counts: "
            f"users={counts['users']}, products={counts['products']}, "
            f"behavior_rels={counts['behavior_rels']}, similar_rels={counts['similar_rels']}"
        )
        print("Visualization query:")
        print("MATCH (u:User)-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product) RETURN u,r,p LIMIT 300")
    finally:
        driver.close()


if __name__ == "__main__":
    main()
