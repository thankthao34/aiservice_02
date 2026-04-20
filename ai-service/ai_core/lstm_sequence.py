from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "model_behavior"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

LSTM_MODEL_PATH = MODEL_DIR / "sequence_lstm.keras"
LSTM_META_PATH = MODEL_DIR / "sequence_lstm_meta.json"


class SequenceLSTMModel(tf.keras.Model):
    def __init__(self, vocab_size: int, emb_dim: int = 32, hidden_dim: int = 64):
        super().__init__()
        self.embedding = tf.keras.layers.Embedding(vocab_size, emb_dim, mask_zero=True)
        self.lstm = tf.keras.layers.LSTM(hidden_dim)
        self.fc = tf.keras.layers.Dense(vocab_size)

    def call(self, x, training=False):
        x = self.embedding(x)
        x = self.lstm(x, training=training)
        return self.fc(x)


def _build_vocab(product_ids: List[int]) -> Tuple[Dict[int, int], Dict[int, int]]:
    uniq = sorted({int(pid) for pid in product_ids if int(pid) > 0})
    product_to_idx = {pid: i + 1 for i, pid in enumerate(uniq)}
    idx_to_product = {i + 1: pid for i, pid in enumerate(uniq)}
    return product_to_idx, idx_to_product


def _make_training_data(sequences: List[List[int]], product_to_idx: Dict[int, int], max_len: int = 10):
    x_rows = []
    y_rows = []

    for seq in sequences:
        encoded = [product_to_idx[p] for p in seq if p in product_to_idx]
        if len(encoded) < 2:
            continue
        for i in range(1, len(encoded)):
            left = encoded[max(0, i - max_len):i]
            x = [0] * (max_len - len(left)) + left
            y = encoded[i]
            x_rows.append(x)
            y_rows.append(y)

    if not x_rows:
        return None, None

    return np.array(x_rows, dtype=np.int32), np.array(y_rows, dtype=np.int32)


def train_sequence_model(sequences: List[List[int]], product_ids: List[int], epochs: int = 5) -> Dict:
    if not sequences:
        return {"trained": False, "reason": "no_sequences"}

    product_to_idx, idx_to_product = _build_vocab(product_ids)
    if len(product_to_idx) < 5:
        return {"trained": False, "reason": "small_vocab"}

    x, y = _make_training_data(sequences, product_to_idx)
    if x is None or y is None:
        return {"trained": False, "reason": "insufficient_pairs"}

    vocab_size = len(product_to_idx) + 1
    model = SequenceLSTMModel(vocab_size=vocab_size)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=["accuracy"],
    )
    hist = model.fit(x, y, epochs=max(1, int(epochs)), batch_size=32, verbose=0)

    model.save(LSTM_MODEL_PATH)
    LSTM_META_PATH.write_text(
        json.dumps(
            {
                "max_len": 10,
                "product_to_idx": product_to_idx,
                "idx_to_product": idx_to_product,
            }
        ),
        encoding="utf-8",
    )

    return {
        "trained": True,
        "samples": int(len(x)),
        "vocab_size": int(len(product_to_idx)),
        "last_accuracy": float(hist.history.get("accuracy", [0])[-1]),
    }


def _load_model_bundle():
    if not LSTM_MODEL_PATH.exists() or not LSTM_META_PATH.exists():
        return None, None
    model = tf.keras.models.load_model(LSTM_MODEL_PATH)
    meta = json.loads(LSTM_META_PATH.read_text(encoding="utf-8"))
    return model, meta


def predict_next_scores(sequence: List[int], top_k: int = 30) -> Dict[int, float]:
    model, meta = _load_model_bundle()
    if model is None or meta is None:
        return {}

    product_to_idx = {int(k): int(v) for k, v in meta["product_to_idx"].items()}
    idx_to_product = {int(k): int(v) for k, v in meta["idx_to_product"].items()}
    max_len = int(meta.get("max_len", 10))

    encoded = [product_to_idx[p] for p in sequence if p in product_to_idx]
    if not encoded:
        return {}

    left = encoded[-max_len:]
    x = np.array([[0] * (max_len - len(left)) + left], dtype=np.int32)
    logits = model.predict(x, verbose=0)[0]
    probs = tf.nn.softmax(logits).numpy()

    top_idx = np.argsort(probs)[::-1][: max(1, int(top_k))]
    out = {}
    for idx in top_idx:
        pid = idx_to_product.get(int(idx))
        if pid is None:
            continue
        out[int(pid)] = float(probs[int(idx)])
    return out


def markov_scores(sequence: List[int], all_sequences: List[List[int]], top_k: int = 30) -> Dict[int, float]:
    if not sequence:
        return {}
    last_pid = int(sequence[-1])
    counts: Dict[int, int] = {}

    for seq in all_sequences:
        for i in range(len(seq) - 1):
            if int(seq[i]) != last_pid:
                continue
            nxt = int(seq[i + 1])
            counts[nxt] = counts.get(nxt, 0) + 1

    if not counts:
        return {}

    total = float(sum(counts.values()))
    ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)[: max(1, int(top_k))]
    return {pid: c / total for pid, c in ranked}
