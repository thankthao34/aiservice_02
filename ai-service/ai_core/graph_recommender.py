from __future__ import annotations

import os
from typing import Dict, List

from ai_core.behavior_store import get_events

try:
    from neo4j import GraphDatabase
except Exception:  # pragma: no cover
    GraphDatabase = None

NEO4J_URI = os.getenv("NEO4J_URI", "")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")

ACTION_REL_MAP = {
    "view": "VIEWED",
    "click": "CLICKED",
    "add_to_cart": "ADDED_TO_CART",
}


def _neo4j_driver():
    if not GraphDatabase or not NEO4J_URI:
        return None
    try:
        return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except Exception:
        return None


def sync_behavior_to_neo4j(limit: int = 5000, user_id: int | None = None, clear_existing: bool = False) -> Dict:
    driver = _neo4j_driver()
    if not driver:
        return {
            "ok": False,
            "message": "Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD.",
            "synced": 0,
        }

    events = get_events(user_id=user_id, limit=limit)
    if not events:
        return {
            "ok": True,
            "message": "No behavior events to sync.",
            "synced": 0,
            "user_id": user_id,
        }

    rel_types = tuple(sorted(set(ACTION_REL_MAP.values())))
    synced = 0
    skipped = 0

    try:
        with driver.session() as session:
            if clear_existing:
                session.run(
                    "MATCH ()-[r]->() WHERE type(r) IN $rel_types DELETE r",
                    rel_types=list(rel_types),
                )

            for e in events:
                action = str(e.get("action") or "").strip().lower()
                rel_type = ACTION_REL_MAP.get(action)
                if not rel_type:
                    skipped += 1
                    continue

                ts = str(e.get("timestamp") or "")
                uid = int(e.get("user_id"))
                pid = int(e.get("product_id"))

                query = f"""
                MERGE (u:User {{id:$uid}})
                MERGE (p:Product {{id:$pid}})
                MERGE (u)-[r:{rel_type}]->(p)
                ON CREATE SET r.count = 1, r.first_at = $ts, r.last_at = $ts
                ON MATCH SET r.count = coalesce(r.count, 0) + 1, r.last_at = $ts
                """
                session.run(query, uid=uid, pid=pid, ts=ts)
                synced += 1

            # Build SIMILAR links from shared users to help graph-based recommend query.
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

        return {
            "ok": True,
            "message": "Behavior events synced to Neo4j.",
            "synced": synced,
            "skipped": skipped,
            "user_id": user_id,
            "clear_existing": bool(clear_existing),
        }
    except Exception as exc:
        return {
            "ok": False,
            "message": f"Failed to sync behavior to Neo4j: {exc}",
            "synced": synced,
            "skipped": skipped,
        }
    finally:
        driver.close()


def get_user_behavior_graph_neo4j(user_id: int, limit: int = 200) -> Dict:
    driver = _neo4j_driver()
    if not driver:
        return {
            "ok": False,
            "message": "Neo4j is not configured.",
            "nodes": [],
            "edges": [],
        }

    query = """
    MATCH (u:User {id:$uid})-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product)
    RETURN u.id AS user_id,
           p.id AS product_id,
           p.name AS product_name,
           type(r) AS action,
           coalesce(r.count, 1) AS count,
           r.last_at AS last_at
    ORDER BY r.last_at DESC
    LIMIT $limit
    """

    try:
        with driver.session() as session:
            rows = list(session.run(query, uid=int(user_id), limit=int(limit)))

        node_map = {
            f"user:{int(user_id)}": {
                "id": f"user:{int(user_id)}",
                "label": "User",
                "user_id": int(user_id),
            }
        }
        edges = []

        for r in rows:
            pid = r.get("product_id")
            if pid is None:
                continue
            pid_int = int(pid)
            pkey = f"product:{pid_int}"
            if pkey not in node_map:
                node_map[pkey] = {
                    "id": pkey,
                    "label": "Product",
                    "product_id": pid_int,
                    "name": r.get("product_name"),
                }

            edges.append(
                {
                    "source": f"user:{int(user_id)}",
                    "target": pkey,
                    "action": r.get("action"),
                    "count": int(r.get("count") or 1),
                    "last_at": r.get("last_at"),
                }
            )

        return {
            "ok": True,
            "user_id": int(user_id),
            "nodes": list(node_map.values()),
            "edges": edges,
            "edge_count": len(edges),
        }
    except Exception as exc:
        return {
            "ok": False,
            "message": f"Failed to query Neo4j graph: {exc}",
            "nodes": [],
            "edges": [],
        }
    finally:
        driver.close()


def graph_scores_neo4j(user_id: int, limit: int = 50) -> Dict[int, float]:
    driver = _neo4j_driver()
    if not driver:
        return {}

    query = (
        "MATCH (u:User {id:$uid})-[:BUY|ADD_TO_CART|VIEW]->(p:Product)-[:SIMILAR]->(rec:Product) "
        "RETURN rec.id AS product_id, count(*) AS rel_score "
        "ORDER BY rel_score DESC LIMIT $limit"
    )

    out: Dict[int, float] = {}
    try:
        with driver.session() as session:
            rows = session.run(query, uid=int(user_id), limit=int(limit))
            pairs = [(int(r["product_id"]), float(r["rel_score"])) for r in rows if r["product_id"] is not None]
        if not pairs:
            return {}
        max_score = max(s for _, s in pairs) or 1.0
        for pid, s in pairs:
            out[pid] = float(s / max_score)
        return out
    except Exception:
        return {}
    finally:
        driver.close()


def graph_scores_local(user_id: int, products: List[Dict], limit: int = 50) -> Dict[int, float]:
    events = get_events(user_id=user_id, limit=600)
    if not events:
        return {}

    bought = [int(e["product_id"]) for e in events if str(e.get("action")) in ("add_to_cart", "click", "view")]
    if not bought:
        return {}

    by_id = {int(p["id"]): p for p in products if p.get("id") is not None}
    bought_set = set(bought)

    scores: Dict[int, float] = {}
    for pid, p in by_id.items():
        if pid in bought_set:
            continue

        score = 0.0
        p_main = str(p.get("main_category") or "")
        p_sub = str(p.get("sub_category") or p.get("category") or "")

        for bpid in bought_set:
            bp = by_id.get(int(bpid))
            if not bp:
                continue
            b_main = str(bp.get("main_category") or "")
            b_sub = str(bp.get("sub_category") or bp.get("category") or "")

            if p_sub and b_sub and p_sub == b_sub:
                score += 1.0
            elif p_main and b_main and p_main == b_main:
                score += 0.4

        if score > 0:
            scores[pid] = score

    if not scores:
        return {}

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[: max(1, int(limit))]
    max_score = max(s for _, s in ranked) or 1.0
    return {pid: s / max_score for pid, s in ranked}


def graph_scores(user_id: int, products: List[Dict], limit: int = 50) -> Dict[int, float]:
    neo = graph_scores_neo4j(user_id=user_id, limit=limit)
    if neo:
        return neo
    return graph_scores_local(user_id=user_id, products=products, limit=limit)
