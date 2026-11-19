from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.config import settings
from app.features import FEATURE_LABELS, FEATURE_NAMES, feature_vector

_lock = threading.Lock()
_cache: dict[str, Any] | None = None


def artifact_paths(base: Path | None = None) -> tuple[Path, Path]:
    directory = base or settings.model_dir
    return directory / "model.joblib", directory / "metadata.json"


def load_artifact() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache
    with _lock:
        if _cache is not None:
            return _cache
        model_file, meta_file = artifact_paths()
        if not model_file.exists() or not meta_file.exists():
            from app.ml.train import train_and_save

            train_and_save()
        _cache = {
            "model": joblib.load(model_file),
            "metadata": json.loads(meta_file.read_text(encoding="utf-8")),
        }
        return _cache


def metadata() -> dict[str, Any]:
    return load_artifact()["metadata"]


def predict_probability(ctx: dict[str, Any]) -> float:
    model = load_artifact()["model"]
    vector = np.array([feature_vector(ctx)], dtype=float)
    return float(model.predict_proba(vector)[0][1])


def _display(feature: str, ctx: dict[str, Any]) -> str:
    from app.features import CATEGORY_LABELS, CHANNEL_LABELS, format_vnd

    if feature == "amount":
        return format_vnd(float(ctx.get("amount", 0)))
    if feature == "hour":
        return f"{int(ctx.get('hour', 0)):02d}:00"
    if feature in {"category", "category_risk"}:
        category = str(ctx.get("merchant_category", ""))
        return CATEGORY_LABELS.get(category, category)
    if feature in {"channel", "channel_online"}:
        channel = str(ctx.get("channel", ""))
        return CHANNEL_LABELS.get(channel, channel)
    if feature == "is_night":
        return "Có" if ctx.get("is_night") else "Không"
    if feature == "country_mismatch":
        return f"IP {ctx.get('ip_country')} / thẻ {ctx.get('card_country')}"
    if feature == "new_device":
        return "Thiết bị chưa từng thấy"
    if feature == "velocity_1h":
        return f"{ctx.get('velocity_1h', 1)} giao dịch / 60 phút"
    if feature == "velocity_24h":
        return f"{ctx.get('velocity_24h', 1)} giao dịch / 24 giờ"
    if feature == "amount_ratio":
        return f"×{float(ctx.get('amount_ratio', 1)):.1f} chi tiêu thường ngày"
    if feature == "distinct_merchants_24d":
        return f"{ctx.get('distinct_merchants_24d', 0)} merchant / 24 giờ"
    if feature == "account_age_days":
        return f"{int(ctx.get('account_age_days', 0))} ngày"
    return str(ctx.get(feature, ""))


def contributions(ctx: dict[str, Any], risk_score: float, limit: int = 6) -> list[dict[str, Any]]:
    """Ước lượng mức đóng góp của từng tín hiệu vào điểm rủi ro.

    Không dùng SHAP để giữ artifact nhẹ; dùng độ quan trọng toàn cục của model
    nhân với độ lệch chuẩn hoá của từng feature so với baseline huấn luyện.
    """
    meta = metadata()
    baseline = meta.get("baseline", {})
    importance = {item["feature"]: item["importance"] for item in meta.get("feature_importance", [])}
    vector = feature_vector(ctx)
    values = dict(zip(FEATURE_NAMES, vector, strict=True))

    grouped: dict[str, float] = {}
    for feature, value in values.items():
        stats = baseline.get(feature)
        if not stats:
            continue
        std = max(float(stats.get("std", 1.0)), 1e-6)
        z = (float(value) - float(stats.get("mean", 0.0))) / std
        weight = importance.get(feature, 0.0) * max(min(z, 3.0), -3.0)

        group = {
            "hour_sin": "hour",
            "hour_cos": "hour",
            "amount_log": "amount",
            "amount_ratio_log": "amount_ratio",
            "channel_online": "channel",
            "category_risk": "category",
        }.get(feature, feature)
        if group in {"hour"}:
            grouped[group] = grouped.get(group, 0.0) + weight * 0.5
        else:
            grouped[group] = grouped.get(group, 0.0) + weight

    total = sum(abs(value) for value in grouped.values()) or 1.0
    items = []
    for feature, weight in grouped.items():
        items.append(
            {
                "feature": feature,
                "label": FEATURE_LABELS.get(
                    {"amount": "amount_log", "hour": "hour_sin", "amount_ratio": "amount_ratio_log", "category": "category_risk", "channel": "channel_online"}.get(feature, feature),
                    feature,
                ),
                "value": _display(feature, ctx),
                "impact": round(abs(weight) / total * 100, 1),
                "direction": "up" if weight >= 0 else "down",
            }
        )
    items.sort(key=lambda item: item["impact"], reverse=True)
    return items[:limit]


def model_info() -> dict[str, Any]:
    meta = metadata()
    return {
        "version": meta["version"],
        "trained_at": meta["trained_at"],
        "algorithm": meta["algorithm"],
        "auc": meta["auc"],
        "precision": meta["precision"],
        "recall": meta["recall"],
        "samples": meta["samples"],
        "feature_importance": meta["feature_importance"],
        "baseline": meta["baseline"],
    }
