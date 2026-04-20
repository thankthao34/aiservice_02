from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("AI_BEHAVIOR_DB", str(DATA_DIR / "behavior.db")))

VALID_ACTIONS = {"view", "click", "add_to_cart"}


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_behavior_db() -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_behavior (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                timestamp TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def log_event(user_id: int, product_id: int, action: str, timestamp: Optional[str] = None) -> Dict:
    action_norm = str(action or "").strip().lower()
    if action_norm not in VALID_ACTIONS:
        raise ValueError(f"Invalid action: {action}")

    conn = _connect()
    try:
        if timestamp:
            cur = conn.execute(
                "INSERT INTO user_behavior (user_id, product_id, action, timestamp) VALUES (?, ?, ?, ?)",
                (int(user_id), int(product_id), action_norm, str(timestamp)),
            )
        else:
            cur = conn.execute(
                "INSERT INTO user_behavior (user_id, product_id, action) VALUES (?, ?, ?)",
                (int(user_id), int(product_id), action_norm),
            )
        conn.commit()
        row = conn.execute("SELECT * FROM user_behavior WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def get_events(user_id: Optional[int] = None, limit: int = 500) -> List[Dict]:
    conn = _connect()
    try:
        if user_id is None:
            rows = conn.execute(
                "SELECT * FROM user_behavior ORDER BY timestamp ASC, id ASC LIMIT ?",
                (int(limit),),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM user_behavior WHERE user_id = ? ORDER BY timestamp ASC, id ASC LIMIT ?",
                (int(user_id), int(limit)),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_user_sequence(user_id: int, min_action_weight: int = 1, limit: int = 200) -> List[int]:
    rows = get_events(user_id=user_id, limit=limit)
    if not rows:
        return []

    weight_map = {
        "view": 1,
        "click": 2,
        "add_to_cart": 3,
    }
    seq = []
    for row in rows:
        action = str(row.get("action") or "view")
        if weight_map.get(action, 1) >= min_action_weight:
            seq.append(int(row["product_id"]))
    return seq


def get_all_sequences(limit_users: int = 2000) -> List[List[int]]:
    conn = _connect()
    try:
        user_rows = conn.execute(
            "SELECT DISTINCT user_id FROM user_behavior ORDER BY user_id ASC LIMIT ?",
            (int(limit_users),),
        ).fetchall()
        user_ids = [int(r[0]) for r in user_rows]
    finally:
        conn.close()

    sequences = []
    for uid in user_ids:
        seq = get_user_sequence(uid)
        if len(seq) >= 2:
            sequences.append(seq)
    return sequences
