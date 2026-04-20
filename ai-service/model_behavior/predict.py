from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

try:
    from model_behavior.model import build_model
except Exception:  # pragma: no cover
    from model import build_model

LABELS = ["cheap_hunter", "normal_user", "premium_user"]
CAT_MAP = {
    "phone": 0,
    "mobile": 0,
    "laptop": 1,
    "tablet": 1,
    "accessory": 2,
    "audio": 2,
    "monitor": 2,
    "chuot": 2,
    "ban-phim": 2,
}

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "behavior_model.h5"
SCALER_PATH = BASE_DIR / "scaler.pkl"
TRAINING_DATA_PATH = BASE_DIR / "training_data.csv"

model = None
scaler = None


def _encode_category(value) -> int:
    key = str(value or "").strip().lower()
    return CAT_MAP.get(key, 2)


def _generate_training_data() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    data = []

    for _ in range(333):
        avg_price = rng.uniform(5, 199)
        purchase_count = int(rng.integers(1, 20))
        total_spent = avg_price * purchase_count * rng.uniform(0.8, 1.2)
        fav_cat = int(rng.choice([0, 2], p=[0.2, 0.8]))
        data.append([avg_price, total_spent, purchase_count, fav_cat, 0])

    for _ in range(334):
        avg_price = rng.uniform(200, 999)
        purchase_count = int(rng.integers(1, 15))
        total_spent = avg_price * purchase_count * rng.uniform(0.8, 1.2)
        fav_cat = int(rng.choice([0, 1, 2], p=[0.5, 0.2, 0.3]))
        data.append([avg_price, total_spent, purchase_count, fav_cat, 1])

    for _ in range(333):
        avg_price = rng.uniform(1000, 3000)
        purchase_count = int(rng.integers(1, 10))
        total_spent = avg_price * purchase_count * rng.uniform(0.8, 1.2)
        fav_cat = int(rng.choice([0, 1], p=[0.5, 0.5]))
        data.append([avg_price, total_spent, purchase_count, fav_cat, 2])

    df = pd.DataFrame(data, columns=["avg_price", "total_spent", "purchase_count", "fav_category", "label"])
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    return df


def _train_and_save_model() -> bool:
    try:
        if TRAINING_DATA_PATH.exists():
            df = pd.read_csv(TRAINING_DATA_PATH)
        else:
            df = _generate_training_data()
            df.to_csv(TRAINING_DATA_PATH, index=False)

        x = df[["avg_price", "total_spent", "purchase_count", "fav_category"]].values
        y = df["label"].values

        scaler_local = StandardScaler()
        x_scaled = scaler_local.fit_transform(x)
        x_train, x_test, y_train, y_test = train_test_split(x_scaled, y, test_size=0.2, random_state=42)

        model_local = build_model()
        model_local.fit(x_train, y_train, epochs=20, batch_size=32, validation_split=0.2, verbose=0)
        model_local.evaluate(x_test, y_test, verbose=0)

        model_local.save(MODEL_PATH)
        joblib.dump(scaler_local, SCALER_PATH)
        return True
    except Exception:
        return False


def _ensure_model_ready() -> bool:
    global model, scaler

    if model is not None and scaler is not None:
        return True

    try:
        if MODEL_PATH.exists() and SCALER_PATH.exists():
            model = tf.keras.models.load_model(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            return True
    except Exception:
        pass

    if not _train_and_save_model():
        return False

    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        return True
    except Exception:
        return False


_ensure_model_ready()


def _heuristic_predict(avg_price: float):
    if avg_price < 200:
        return {"segment": "cheap_hunter", "confidence": 0.8, "scores": {"cheap_hunter": 0.8, "normal_user": 0.15, "premium_user": 0.05}}
    if avg_price > 999:
        return {"segment": "premium_user", "confidence": 0.85, "scores": {"cheap_hunter": 0.03, "normal_user": 0.12, "premium_user": 0.85}}
    return {"segment": "normal_user", "confidence": 0.78, "scores": {"cheap_hunter": 0.12, "normal_user": 0.78, "premium_user": 0.1}}


def predict_segment(avg_price, total_spent, purchase_count, fav_category):
    if not _ensure_model_ready():
        return _heuristic_predict(float(avg_price))

    cat_enc = _encode_category(fav_category)
    x = np.array([[avg_price, total_spent, purchase_count, cat_enc]])
    probs = model.predict(scaler.transform(x), verbose=0)[0]
    idx = int(np.argmax(probs))

    return {
        "segment": LABELS[idx],
        "confidence": float(probs[idx]),
        "scores": {
            "cheap_hunter": float(probs[0]),
            "normal_user": float(probs[1]),
            "premium_user": float(probs[2]),
        },
    }
