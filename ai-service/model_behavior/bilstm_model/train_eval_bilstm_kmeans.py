from __future__ import annotations

import argparse
import random
from pathlib import Path
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.cluster import KMeans
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler, label_binarize
from sklearn.utils.class_weight import compute_class_weight

"""
Pipeline huan luyen/danh gia BiLSTM + KMeans.

Phuong phap:
1) Dung KMeans tren dac trung hanh vi tong hop theo user de sinh cluster pseudo-label.
2) Huan luyen mo hinh chuoi BiLSTM tren chuoi tuong tac co thu tu thoi gian de du doan cluster.

Artifact trong ./outputs ho tro danh gia minh bach: metrics csv, bao cao tung split,
confusion matrix, ROC plot va duong hoc trung binh.
"""


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_PATH = SCRIPT_DIR.parents[1] / "data" / "model_behavior" / "data_user500.csv"
OUTPUT_DIR = SCRIPT_DIR / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


ACTION_MAP = {
    # Ma so hanh dong dung cho nhanh embedding cua action.
    "view": 1,
    "click": 2,
    "add_to_cart": 3,
}


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def parse_args() -> argparse.Namespace:
    # Giao dien dong lenh giup kiem soat va tai lap lan chay thi nghiem.
    parser = argparse.ArgumentParser(description="BiLSTM + KMeans evaluation with 5 repeated hold-out splits.")
    parser.add_argument("--data", type=str, default=str(DEFAULT_DATA_PATH), help="Path to data_user500.csv")
    parser.add_argument("--splits", type=int, default=5, help="Number of repeated hold-out runs")
    parser.add_argument("--epochs", type=int, default=25, help="BiLSTM training epochs for each split")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--test-size", type=float, default=0.3, help="Test ratio")
    return parser.parse_args()


def load_data(path: Path) -> pd.DataFrame:
    # Kiem tra cot bat buoc va chuyen kieu du lieu ve dang nhat quan.
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")

    df = pd.read_csv(path)
    required = {"user_id", "product_id", "action", "timestamp"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    df = df.copy()
    df["action"] = df["action"].astype(str).str.strip().str.lower()
    bad_actions = sorted(set(df["action"]) - set(ACTION_MAP.keys()))
    if bad_actions:
        raise ValueError(f"Unsupported action values: {bad_actions}")

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    if df["timestamp"].isna().any():
        raise ValueError("Found invalid timestamp values")

    df["product_id"] = df["product_id"].astype(int)
    df["user_id"] = df["user_id"].astype(int)
    return df


def build_user_features(df: pd.DataFrame) -> pd.DataFrame:
    # Tao dac trung mo ta hanh vi user de phuc vu clustering.
    agg = df.groupby("user_id").agg(
        event_count=("user_id", "size"),
        unique_products=("product_id", "nunique"),
        avg_product=("product_id", "mean"),
        std_product=("product_id", "std"),
        view_count=("action", lambda s: (s == "view").sum()),
        click_count=("action", lambda s: (s == "click").sum()),
        cart_count=("action", lambda s: (s == "add_to_cart").sum()),
    )

    agg["std_product"] = agg["std_product"].fillna(0.0)
    agg["view_ratio"] = agg["view_count"] / agg["event_count"]
    agg["click_ratio"] = agg["click_count"] / agg["event_count"]
    agg["cart_ratio"] = agg["cart_count"] / agg["event_count"]

    return agg[
        [
            "event_count",
            "unique_products",
            "avg_product",
            "std_product",
            "view_ratio",
            "click_ratio",
            "cart_ratio",
        ]
    ].reset_index()


def assign_kmeans_labels(user_features: pd.DataFrame, n_clusters: int = 3) -> pd.DataFrame:
    # Chuan hoa thang do feature truoc khi clustering theo khoang cach.
    scaler = MinMaxScaler()
    x = scaler.fit_transform(user_features.drop(columns=["user_id"]))
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=20)
    labels = km.fit_predict(x)

    out = user_features[["user_id"]].copy()
    out["label"] = labels.astype(int)
    return out


def build_sequences(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray, int, int]:
    # Giu thong tin thoi gian bang cach sap xep su kien theo user va timestamp.
    df = df.sort_values(["user_id", "timestamp"]).copy()
    max_product = int(df["product_id"].max()) + 1
    action_vocab_size = max(ACTION_MAP.values()) + 1
    df["action_code"] = df["action"].map(ACTION_MAP).astype(int)

    product_seqs: List[List[int]] = []
    action_seqs: List[List[int]] = []
    users: List[int] = []
    for uid, g in df.groupby("user_id"):
        product_seqs.append(g["product_id"].tolist())
        action_seqs.append(g["action_code"].tolist())
        users.append(int(uid))

    max_len = max(len(s) for s in product_seqs)
    # Pre-padding de su kien moi nhat nam ben phai chuoi.
    padded_products = tf.keras.preprocessing.sequence.pad_sequences(
        product_seqs,
        maxlen=max_len,
        padding="pre",
        truncating="pre",
        value=0,
    )
    padded_actions = tf.keras.preprocessing.sequence.pad_sequences(
        action_seqs,
        maxlen=max_len,
        padding="pre",
        truncating="pre",
        value=0,
    )

    return (
        padded_products.astype(np.int32),
        padded_actions.astype(np.int32),
        np.array(users, dtype=np.int32),
        max_product,
        action_vocab_size,
    )


def build_bilstm_model(product_vocab_size: int, action_vocab_size: int, seq_len: int, n_classes: int) -> tf.keras.Model:
    # BiLSTM doc chuoi hai chieu de bat ngu canh phong phu hon.
    product_input = tf.keras.layers.Input(shape=(seq_len,), name="product_input")
    action_input = tf.keras.layers.Input(shape=(seq_len,), name="action_input")

    product_emb = tf.keras.layers.Embedding(
        input_dim=product_vocab_size + 1,
        output_dim=32,
        mask_zero=True,
        name="product_embedding",
    )(product_input)
    action_emb = tf.keras.layers.Embedding(
        input_dim=action_vocab_size + 1,
        output_dim=8,
        mask_zero=True,
        name="action_embedding",
    )(action_input)

    x = tf.keras.layers.Concatenate(axis=-1)([product_emb, action_emb])
    # Xep chong nhieu lop BiLSTM de tang nang luc hoc dong hoc hanh vi phuc tap.
    x = tf.keras.layers.Bidirectional(
        tf.keras.layers.LSTM(96, return_sequences=True, dropout=0.2, recurrent_dropout=0.1)
    )(x)
    x = tf.keras.layers.Bidirectional(
        tf.keras.layers.LSTM(48, return_sequences=False, dropout=0.2, recurrent_dropout=0.1)
    )(x)
    x = tf.keras.layers.Dense(64, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.35)(x)
    output = tf.keras.layers.Dense(n_classes, activation="softmax")(x)

    model = tf.keras.Model(inputs=[product_input, action_input], outputs=output)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def evaluate_split(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray,
    split_idx: int,
    class_names: List[str],
) -> Dict[str, float]:
    # Thu thap metrics theo split de tong hop trung binh ve sau.
    metrics = {
        "split": split_idx,
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="weighted", zero_division=0),
        "recall": recall_score(y_true, y_pred, average="weighted", zero_division=0),
        "f1": f1_score(y_true, y_pred, average="weighted", zero_division=0),
    }

    auc_value = np.nan
    try:
        if len(np.unique(y_true)) >= 2:
            auc_value = roc_auc_score(y_true, y_proba, multi_class="ovr", average="weighted")
    except Exception:
        auc_value = np.nan
    metrics["auc"] = auc_value

    # Luu bao cao chi tiet theo lop de phan tich dinh tinh.
    report = classification_report(y_true, y_pred, target_names=class_names, zero_division=0)
    (OUTPUT_DIR / f"classification_report_split_{split_idx}.txt").write_text(report, encoding="utf-8")

    # Confusion matrix lam ro cac cap cluster bi nham lan nhieu.
    disp = ConfusionMatrixDisplay.from_predictions(y_true, y_pred, display_labels=class_names, cmap="Blues")
    disp.ax_.set_title(f"Confusion Matrix - Split {split_idx}")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / f"confusion_matrix_split_{split_idx}.png", dpi=160)
    plt.close()

    try:
        classes = np.unique(y_true)
        if len(classes) >= 2:
            y_bin = label_binarize(y_true, classes=sorted(classes))
            plt.figure(figsize=(7, 5))
            for idx, c in enumerate(sorted(classes)):
                if y_bin.shape[1] == 1:
                    continue
                fpr, tpr, _ = roc_curve(y_bin[:, idx], y_proba[:, c])
                plt.plot(fpr, tpr, label=f"Class {c}")
            plt.plot([0, 1], [0, 1], "k--", linewidth=1)
            plt.xlabel("False Positive Rate")
            plt.ylabel("True Positive Rate")
            plt.title(f"ROC Curves - Split {split_idx}")
            plt.legend(loc="lower right")
            plt.tight_layout()
            plt.savefig(OUTPUT_DIR / f"roc_curves_split_{split_idx}.png", dpi=160)
            plt.close()
    except Exception:
        pass

    return metrics


def save_epoch_curves(histories: List[Dict[str, List[float]]]) -> None:
    # Tinh duong train/validation trung binh qua tat ca split de danh gia do on dinh.
    if not histories:
        return

    max_len = max(len(h.get("accuracy", [])) for h in histories)
    metric_map = {
        "train_accuracy": "accuracy",
        "val_accuracy": "val_accuracy",
        "train_loss": "loss",
        "val_loss": "val_loss",
    }

    out_df = pd.DataFrame({"epoch": np.arange(1, max_len + 1, dtype=int)})
    for out_col, src_col in metric_map.items():
        arr = np.full((len(histories), max_len), np.nan, dtype=float)
        for i, h in enumerate(histories):
            values = h.get(src_col, [])
            if not values:
                continue
            arr[i, : len(values)] = np.asarray(values, dtype=float)
        out_df[out_col] = np.nanmean(arr, axis=0)

    out_df.to_csv(OUTPUT_DIR / "epoch_history_mean.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(out_df["epoch"], out_df["train_accuracy"], label="Train Accuracy")
    plt.plot(out_df["epoch"], out_df["val_accuracy"], label="Validation Accuracy")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.ylim(0, 1.05)
    plt.title("BiLSTM Accuracy by Epoch (mean over splits)")
    plt.grid(alpha=0.2)
    plt.legend()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "accuracy_epochs_train_val.png", dpi=180)
    plt.close()

    plt.figure(figsize=(8, 5))
    plt.plot(out_df["epoch"], out_df["train_loss"], label="Train Loss")
    plt.plot(out_df["epoch"], out_df["val_loss"], label="Validation Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("BiLSTM Loss by Epoch (mean over splits)")
    plt.grid(alpha=0.2)
    plt.legend()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "loss_epochs_train_val.png", dpi=180)
    plt.close()


def plot_overall(metrics_df: pd.DataFrame) -> None:
    metric_cols = ["accuracy", "precision", "recall", "f1", "auc"]

    # Mean +/- std tom tat dong thoi hieu nang va tinh nhat quan.
    means = metrics_df[metric_cols].mean(skipna=True)
    stds = metrics_df[metric_cols].std(skipna=True)

    plt.figure(figsize=(8, 5))
    x = np.arange(len(metric_cols))
    plt.bar(x, means.values, yerr=stds.values, capsize=5)
    plt.xticks(x, metric_cols)
    plt.ylim(0, 1.05)
    plt.ylabel("Score")
    plt.title("BiLSTM + KMeans: Mean +/- Std over 5 Splits")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "metrics_bar_mean_std.png", dpi=180)
    plt.close()

    # Duong xu huong theo split giup phat hien do nhay cam theo random seed.
    plt.figure(figsize=(9, 5))
    for m in metric_cols:
        plt.plot(metrics_df["split"], metrics_df[m], marker="o", label=m)
    plt.ylim(0, 1.05)
    plt.xlabel("Split")
    plt.ylabel("Score")
    plt.title("Metric Trends Across 5 Splits")
    plt.legend()
    plt.grid(alpha=0.2)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "metric_trends_5_splits.png", dpi=180)
    plt.close()


def main() -> None:
    # Giai doan 0: doc tham so va nap du lieu.
    args = parse_args()
    data_path = Path(args.data)

    set_seed(42)
    df = load_data(data_path)

    # Giai doan 1: tao pseudo-label khong giam sat bang KMeans.
    user_features = build_user_features(df)
    labels_df = assign_kmeans_labels(user_features, n_clusters=3)

    # Giai doan 2: tao tensor chuoi va canh hang nhan theo user_id.
    x_products, x_actions, user_ids_arr, product_vocab_size, action_vocab_size = build_sequences(df)
    y_map = dict(zip(labels_df["user_id"].tolist(), labels_df["label"].tolist()))
    y = np.array([y_map[int(uid)] for uid in user_ids_arr], dtype=np.int32)

    n_classes = int(len(np.unique(y)))
    class_names = [f"cluster_{i}" for i in sorted(np.unique(y))]

    metrics_rows = []
    histories: List[Dict[str, List[float]]] = []

    for i in range(1, int(args.splits) + 1):
        # Repeated hold-out giup metrics bao cao co do vung vang cao hon.
        seed = 300 + i
        set_seed(seed)

        x_prod_train, x_prod_test, x_act_train, x_act_test, y_train, y_test = train_test_split(
            x_products,
            x_actions,
            y,
            test_size=float(args.test_size),
            random_state=seed,
            stratify=y,
        )

        classes = np.unique(y_train)
        # Weighted loss xu ly mat can bang giua cac lop cluster.
        class_weights_arr = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
        class_weight = {int(c): float(w) for c, w in zip(classes, class_weights_arr)}

        model = build_bilstm_model(
            product_vocab_size=product_vocab_size,
            action_vocab_size=action_vocab_size,
            seq_len=x_products.shape[1],
            n_classes=n_classes,
        )
        callbacks = [
            # To hop callback giup kiem soat overfitting va dieu chinh learning rate dong.
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=6, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-5),
        ]

        history = model.fit(
            {"product_input": x_prod_train, "action_input": x_act_train},
            y_train,
            validation_split=0.2,
            epochs=int(args.epochs),
            batch_size=int(args.batch_size),
            verbose=0,
            callbacks=callbacks,
            class_weight=class_weight,
        )
        histories.append(history.history)

        y_proba = model.predict({"product_input": x_prod_test, "action_input": x_act_test}, verbose=0)
        y_pred = np.argmax(y_proba, axis=1)

        row = evaluate_split(y_test, y_pred, y_proba, i, class_names)
        metrics_rows.append(row)
        print(
            f"Split {i}: "
            f"acc={row['accuracy']:.4f}, "
            f"prec={row['precision']:.4f}, "
            f"rec={row['recall']:.4f}, "
            f"f1={row['f1']:.4f}, "
            f"auc={row['auc'] if pd.notna(row['auc']) else float('nan'):.4f}"
        )

    # Giai doan 3: xuat bang so metrics de dua vao bang ket qua.
    metrics_df = pd.DataFrame(metrics_rows)
    metrics_df.to_csv(OUTPUT_DIR / "metrics_per_split.csv", index=False)

    summary = pd.DataFrame(
        {
            "metric": ["accuracy", "precision", "recall", "f1", "auc"],
            "mean": [metrics_df[c].mean(skipna=True) for c in ["accuracy", "precision", "recall", "f1", "auc"]],
            "std": [metrics_df[c].std(skipna=True) for c in ["accuracy", "precision", "recall", "f1", "auc"]],
        }
    )
    summary.to_csv(OUTPUT_DIR / "metrics_summary.csv", index=False)

    # Giai doan 4: xuat hinh ve cho phan phan tich thuc nghiem.
    plot_overall(metrics_df)
    save_epoch_curves(histories)

    print("\n=== Average +/- Std over splits ===")
    for _, r in summary.iterrows():
        print(f"{r['metric']}: {r['mean']:.4f} +/- {r['std']:.4f}")

    print(f"\nSaved outputs to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
