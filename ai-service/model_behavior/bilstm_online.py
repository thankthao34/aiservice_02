from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import requests
import tensorflow as tf

from ai_core.behavior_store import get_events

LABELS = ["cheap_hunter", "normal_user", "premium_user"]
ACTION_MAP = {"view": 1, "click": 2, "add_to_cart": 3}

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "bilstm_online_model.keras"
META_PATH = BASE_DIR / "bilstm_online_meta.json"

PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:3002")
MIN_USERS_TO_TRAIN = int(os.getenv("BILSTM_MIN_USERS", "1"))
MAX_EVENTS = int(os.getenv("BILSTM_MAX_EVENTS", "80000"))
MAX_LEN = int(os.getenv("BILSTM_SEQ_LEN", "40"))

_model = None
_meta = None


def _fetch_price_map() -> Dict[int, float]:
    try:
        rows = requests.get(f"{PRODUCT_SERVICE_URL}/", timeout=8).json()
        if not isinstance(rows, list):
            return {}
        out = {}
        for r in rows:
            pid = r.get("id")
            if pid is None:
                continue
            out[int(pid)] = float(r.get("price") or 0.0)
        return out
    except Exception:
        return {}


def _avg_price_to_label(avg_price: float) -> int:
    if avg_price < 200:
        return 0
    if avg_price > 999:
        return 2
    return 1


def _build_user_samples(price_map: Dict[int, float]) -> Tuple[List[List[int]], List[List[int]], List[int], List[int]]:
    rows = get_events(user_id=None, limit=MAX_EVENTS)
    if not rows:
        return [], [], [], []

    by_user: Dict[int, List[Dict]] = {}
    for row in rows:
        uid = int(row.get("user_id"))
        by_user.setdefault(uid, []).append(row)

    product_seqs: List[List[int]] = []
    action_seqs: List[List[int]] = []
    labels: List[int] = []
    user_ids: List[int] = []

    for uid, events in by_user.items():
        p_seq = []
        a_seq = []
        prices = []

        for e in events:
            pid = int(e.get("product_id"))
            action = str(e.get("action") or "view").strip().lower()
            p_seq.append(pid)
            a_seq.append(ACTION_MAP.get(action, 1))
            if pid in price_map and price_map[pid] > 0:
                prices.append(price_map[pid])

        if len(p_seq) < 2:
            continue

        avg_price = float(np.mean(prices)) if prices else 300.0
        labels.append(_avg_price_to_label(avg_price))
        product_seqs.append(p_seq[-MAX_LEN:])
        action_seqs.append(a_seq[-MAX_LEN:])
        user_ids.append(uid)

    return product_seqs, action_seqs, labels, user_ids


def _encode_and_pad(product_seqs: List[List[int]], action_seqs: List[List[int]], product_to_idx: Dict[int, int]):
    x_prod = []
    x_act = []

    for p_seq, a_seq in zip(product_seqs, action_seqs):
        encoded = [product_to_idx.get(int(pid), 0) for pid in p_seq][-MAX_LEN:]
        acts = [int(a) for a in a_seq][-MAX_LEN:]
        x_prod.append(encoded)
        x_act.append(acts)

    x_prod = tf.keras.preprocessing.sequence.pad_sequences(x_prod, maxlen=MAX_LEN, padding="pre", truncating="pre", value=0)
    x_act = tf.keras.preprocessing.sequence.pad_sequences(x_act, maxlen=MAX_LEN, padding="pre", truncating="pre", value=0)
    return x_prod.astype(np.int32), x_act.astype(np.int32)


def _build_model(product_vocab_size: int, action_vocab_size: int = 4) -> tf.keras.Model:
    product_input = tf.keras.layers.Input(shape=(MAX_LEN,), name="product_input")
    action_input = tf.keras.layers.Input(shape=(MAX_LEN,), name="action_input")

    product_emb = tf.keras.layers.Embedding(input_dim=product_vocab_size + 1, output_dim=32, mask_zero=True)(product_input)
    action_emb = tf.keras.layers.Embedding(input_dim=action_vocab_size + 1, output_dim=8, mask_zero=True)(action_input)

    x = tf.keras.layers.Concatenate(axis=-1)([product_emb, action_emb])
    x = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=True, dropout=0.2))(x)
    x = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(32, return_sequences=False, dropout=0.2))(x)
    x = tf.keras.layers.Dense(48, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    output = tf.keras.layers.Dense(3, activation="softmax")(x)

    model = tf.keras.Model(inputs=[product_input, action_input], outputs=output)
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


def _save_artifacts(model: tf.keras.Model, product_to_idx: Dict[int, int]) -> None:
    model.save(MODEL_PATH)
    meta = {
        "max_len": MAX_LEN,
        "product_to_idx": {str(k): int(v) for k, v in product_to_idx.items()},
        "labels": LABELS,
    }
    META_PATH.write_text(json.dumps(meta), encoding="utf-8")


def _load_artifacts() -> bool:
    global _model, _meta
    try:
        if not MODEL_PATH.exists() or not META_PATH.exists():
            return False
        _model = tf.keras.models.load_model(MODEL_PATH)
        _meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        return True
    except Exception:
        _model = None
        _meta = None
        return False


def _train_online_model() -> bool:
    price_map = _fetch_price_map()
    p_seqs, a_seqs, labels, _ = _build_user_samples(price_map)
    if len(p_seqs) < MIN_USERS_TO_TRAIN:
        return False

    unique_products = sorted({int(pid) for seq in p_seqs for pid in seq})
    if not unique_products:
        return False

    product_to_idx = {pid: idx + 1 for idx, pid in enumerate(unique_products)}
    x_prod, x_act = _encode_and_pad(p_seqs, a_seqs, product_to_idx)
    y = np.asarray(labels, dtype=np.int32)

    # For small online datasets, duplicate samples to stabilize training.
    if len(y) < 8:
        repeats = int(np.ceil(8 / max(1, len(y))))
        x_prod = np.tile(x_prod, (repeats, 1))[:8]
        x_act = np.tile(x_act, (repeats, 1))[:8]
        y = np.tile(y, repeats)[:8]

    model = _build_model(product_vocab_size=len(product_to_idx))
    val_split = 0.2 if len(y) >= 10 else 0.0

    model.fit(
        {"product_input": x_prod, "action_input": x_act},
        y,
        epochs=12,
        batch_size=32,
        validation_split=val_split,
        verbose=0,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss" if val_split > 0 else "loss",
                patience=3,
                restore_best_weights=True,
            )
        ],
    )

    _save_artifacts(model, product_to_idx)
    return _load_artifacts()


def _ensure_ready() -> bool:
    if _model is not None and _meta is not None:
        return True
    if _load_artifacts():
        return True
    return _train_online_model()


def predict_segment_bilstm_online(user_id: int) -> Optional[Dict]:
    if not _ensure_ready():
        return None

    rows = get_events(user_id=int(user_id), limit=MAX_EVENTS)
    if len(rows) < 2:
        return None

    product_to_idx = {int(k): int(v) for k, v in (_meta.get("product_to_idx") or {}).items()}
    if not product_to_idx:
        return None

    p_seq = [int(r.get("product_id")) for r in rows][-MAX_LEN:]
    a_seq = [ACTION_MAP.get(str(r.get("action") or "view").strip().lower(), 1) for r in rows][-MAX_LEN:]

    x_prod, x_act = _encode_and_pad([p_seq], [a_seq], product_to_idx)
    probs = _model.predict({"product_input": x_prod, "action_input": x_act}, verbose=0)[0]
    idx = int(np.argmax(probs))

    return {
        "segment": LABELS[idx],
        "confidence": float(probs[idx]),
        "scores": {
            "cheap_hunter": float(probs[0]),
            "normal_user": float(probs[1]),
            "premium_user": float(probs[2]),
        },
        "model": "BiLSTM-online",
    }
