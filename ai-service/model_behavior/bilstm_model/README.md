# BiLSTM Model (Model 3)

This folder contains the third standalone model pipeline for behavior classification.

## Goal
- Build a BiLSTM-based classifier.
- Use KMeans pseudo-label strategy.
- Evaluate with 5 repeated random splits (train/test = 70/30).
- Report Accuracy, Precision, Recall, F1, and AUC.
- Save plots for visualization.

## Input Data
- Default file: `../../data/model_behavior/data_user500.csv`
- Required columns: `user_id`, `product_id`, `action`, `timestamp`

## Run
From repository root:

```powershell
python ai-service/model_behavior/bilstm_model/train_eval_bilstm_kmeans.py
```

Or with custom data path:

```powershell
python ai-service/model_behavior/bilstm_model/train_eval_bilstm_kmeans.py --data "ai-service/data/model_behavior/data_user500.csv"
```

## Output
Generated under `outputs/`:
- `metrics_per_split.csv`
- `metrics_summary.csv`
- `classification_report_split_*.txt`
- `confusion_matrix_split_*.png`
- `metrics_bar_mean_std.png`
- `metric_trends_5_splits.png`
- `roc_curves_split_*.png` (when AUC can be computed)
