from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    average_precision_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.config import settings
from app.features import FEATURE_LABELS, FEATURE_NAMES, feature_vector
from app.ml.synthetic import generate_dataset

VERSION = "gbdt-1.0.0"


def train_and_save(
    *,
    seed: int = 42,
    days: int = 60,
    customers: int = 900,
    output_dir: Path | None = None,
) -> dict:
    output = output_dir or settings.model_dir
    output.mkdir(parents=True, exist_ok=True)

    records = generate_dataset(seed=seed, days=days, customers=customers)
    x = np.array([feature_vector(record) for record in records], dtype=float)
    y = np.array([int(record["label"]) for record in records])
    timestamps = np.array([record["occurred_at"] for record in records])

    order = np.argsort(timestamps)
    x, y = x[order], y[order]
    split = int(len(x) * 0.8)
    x_train, x_test = x[:split], x[split:]
    y_train, y_test = y[:split], y[split:]

    model = HistGradientBoostingClassifier(
        max_iter=220,
        learning_rate=0.09,
        max_depth=4,
        min_samples_leaf=25,
        l2_regularization=1.0,
        random_state=seed,
    )
    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    auc = float(roc_auc_score(y_test, probabilities))
    precision = float(precision_score(y_test, predictions, zero_division=0))
    recall = float(recall_score(y_test, predictions, zero_division=0))
    ap = float(average_precision_score(y_test, probabilities))

    # Permutation importance nhẹ trên tập test (chỉ 3 vòng) để phản ánh đóng góp thật.
    rng = np.random.default_rng(seed)
    base_auc = auc
    importances: list[float] = []
    for column in range(x_test.shape[1]):
        drops = []
        for _ in range(3):
            shuffled = x_test.copy()
            rng.shuffle(shuffled[:, column])
            score = roc_auc_score(y_test, model.predict_proba(shuffled)[:, 1])
            drops.append(max(base_auc - score, 0.0))
        importances.append(float(np.mean(drops)))

    total_importance = sum(importances) or 1.0
    feature_importance = [
        {
            "feature": name,
            "label": FEATURE_LABELS[name],
            "importance": round(value / total_importance, 4),
        }
        for name, value in zip(FEATURE_NAMES, importances, strict=True)
    ]
    feature_importance.sort(key=lambda item: item["importance"], reverse=True)

    baseline = {
        name: {"mean": float(x_train[:, index].mean()), "std": float(x_train[:, index].std())}
        for index, name in enumerate(FEATURE_NAMES)
    }

    metadata = {
        "version": VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "HistGradientBoostingClassifier",
        "auc": round(auc, 4),
        "average_precision": round(ap, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "samples": len(x),
        "fraud_rate": round(float(y.mean()), 4),
        "train_size": len(x_train),
        "test_size": len(x_test),
        "dataset": {"seed": seed, "days": days, "customers": customers},
        "feature_importance": feature_importance,
        "baseline": baseline,
    }

    joblib.dump(model, output / "model.joblib")
    (output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Huấn luyện model chấm điểm rủi ro FraudLens")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--customers", type=int, default=900)
    args = parser.parse_args()
    meta = train_and_save(seed=args.seed, days=args.days, customers=args.customers)
    print(json.dumps({key: meta[key] for key in ("version", "auc", "precision", "recall", "samples")}, indent=2))


if __name__ == "__main__":
    main()
