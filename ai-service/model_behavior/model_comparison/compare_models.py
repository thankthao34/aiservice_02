from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_SUMMARY_PATHS = {
    "RNN": BASE_DIR / "rnn_model" / "outputs" / "metrics_summary.csv",
    "LSTM": BASE_DIR / "lstm_model" / "outputs" / "metrics_summary.csv",
    "BiLSTM": BASE_DIR / "bilstm_model" / "outputs" / "metrics_summary.csv",
}

MODEL_EPOCH_HISTORY_PATHS = {
    "RNN": BASE_DIR / "rnn_model" / "outputs" / "epoch_history_mean.csv",
    "LSTM": BASE_DIR / "lstm_model" / "outputs" / "epoch_history_mean.csv",
    "BiLSTM": BASE_DIR / "bilstm_model" / "outputs" / "epoch_history_mean.csv",
}


def load_metric(summary_path: Path, metric_name: str) -> tuple[float, float]:
    if not summary_path.exists():
        raise FileNotFoundError(f"Missing file: {summary_path}")

    df = pd.read_csv(summary_path)
    row = df[df["metric"] == metric_name]
    if row.empty:
        raise ValueError(f"Metric '{metric_name}' not found in {summary_path}")

    return float(row["mean"].iloc[0]), float(row["std"].iloc[0])


def build_comparison() -> pd.DataFrame:
    rows = []
    for model_name, path in MODEL_SUMMARY_PATHS.items():
        acc_mean, acc_std = load_metric(path, "accuracy")
        f1_mean, f1_std = load_metric(path, "f1")
        auc_mean, auc_std = load_metric(path, "auc")

        # Composite score for model_best selection.
        score = 0.5 * acc_mean + 0.3 * f1_mean + 0.2 * auc_mean

        rows.append(
            {
                "model": model_name,
                "accuracy_mean": acc_mean,
                "accuracy_std": acc_std,
                "f1_mean": f1_mean,
                "f1_std": f1_std,
                "auc_mean": auc_mean,
                "auc_std": auc_std,
                "loss_mean": 1.0 - acc_mean,
                "loss_std": acc_std,
                "score": score,
            }
        )

    out = pd.DataFrame(rows).sort_values("score", ascending=False).reset_index(drop=True)
    out["rank"] = np.arange(1, len(out) + 1)
    return out[["rank", "model", "accuracy_mean", "accuracy_std", "loss_mean", "loss_std", "f1_mean", "f1_std", "auc_mean", "auc_std", "score"]]


def plot_accuracy(comparison_df: pd.DataFrame) -> None:
    plt.figure(figsize=(8, 5))
    x = np.arange(len(comparison_df))
    plt.bar(
        x,
        comparison_df["accuracy_mean"],
        yerr=comparison_df["accuracy_std"],
        capsize=6,
        color=["#5C6BC0", "#26A69A", "#EF5350"],
    )
    plt.xticks(x, comparison_df["model"])
    plt.ylim(0, 1.0)
    plt.ylabel("Accuracy")
    plt.title("Model Accuracy Comparison (mean +/- std)")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "accuracy_comparison.png", dpi=180)
    plt.close()


def plot_loss(comparison_df: pd.DataFrame) -> None:
    plt.figure(figsize=(8, 5))
    x = np.arange(len(comparison_df))
    plt.bar(
        x,
        comparison_df["loss_mean"],
        yerr=comparison_df["loss_std"],
        capsize=6,
        color=["#8D6E63", "#FFB74D", "#78909C"],
    )
    plt.xticks(x, comparison_df["model"])
    plt.ylim(0, 1.0)
    plt.ylabel("Loss (1 - Accuracy)")
    plt.title("Model Loss Comparison (mean +/- std)")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "loss_comparison.png", dpi=180)
    plt.close()


def plot_epoch_accuracy_loss() -> None:
    histories = {}
    for model_name, path in MODEL_EPOCH_HISTORY_PATHS.items():
        if not path.exists():
            continue
        histories[model_name] = pd.read_csv(path)

    if not histories:
        return

    plt.figure(figsize=(10, 6))
    for model_name, df in histories.items():
        plt.plot(df["epoch"], df["train_accuracy"], label=f"{model_name} Train", linewidth=2)
        plt.plot(df["epoch"], df["val_accuracy"], linestyle="--", label=f"{model_name} Validation", linewidth=2)
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.ylim(0, 1.05)
    plt.title("Accuracy by Epoch (Train vs Validation) - 3 Models")
    plt.grid(alpha=0.2)
    plt.legend(ncol=2)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "accuracy_epochs_3models_train_val.png", dpi=180)
    plt.close()

    plt.figure(figsize=(10, 6))
    for model_name, df in histories.items():
        plt.plot(df["epoch"], df["train_loss"], label=f"{model_name} Train", linewidth=2)
        plt.plot(df["epoch"], df["val_loss"], linestyle="--", label=f"{model_name} Validation", linewidth=2)
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("Loss by Epoch (Train vs Validation) - 3 Models")
    plt.grid(alpha=0.2)
    plt.legend(ncol=2)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "loss_epochs_3models_train_val.png", dpi=180)
    plt.close()


def write_text_report(comparison_df: pd.DataFrame) -> None:
    best = comparison_df.iloc[0]
    lines = [
        "Model comparison based on current outputs.",
        "",
        "Selection rule:",
        "score = 0.5*accuracy + 0.3*f1 + 0.2*auc",
        "",
        f"Best model: {best['model']}",
        f"Accuracy: {best['accuracy_mean']:.4f} +/- {best['accuracy_std']:.4f}",
        f"F1: {best['f1_mean']:.4f} +/- {best['f1_std']:.4f}",
        f"AUC: {best['auc_mean']:.4f} +/- {best['auc_std']:.4f}",
        f"Loss: {best['loss_mean']:.4f} +/- {best['loss_std']:.4f}",
        "",
        "Epoch charts:",
        "- accuracy_epochs_3models_train_val.png",
        "- loss_epochs_3models_train_val.png",
    ]
    (OUTPUT_DIR / "model_best_report.txt").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    comparison_df = build_comparison()
    comparison_df.to_csv(OUTPUT_DIR / "model_comparison.csv", index=False)

    plot_accuracy(comparison_df)
    plot_loss(comparison_df)
    plot_epoch_accuracy_loss()
    write_text_report(comparison_df)

    print("Saved:", OUTPUT_DIR / "model_comparison.csv")
    print("Saved:", OUTPUT_DIR / "accuracy_comparison.png")
    print("Saved:", OUTPUT_DIR / "loss_comparison.png")
    print("Saved:", OUTPUT_DIR / "model_best_report.txt")
    print("Saved:", OUTPUT_DIR / "accuracy_epochs_3models_train_val.png")
    print("Saved:", OUTPUT_DIR / "loss_epochs_3models_train_val.png")


if __name__ == "__main__":
    main()
