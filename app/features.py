from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

TZ_OFFSET_HOURS = 7  # Asia/Ho_Chi_Minh

CATEGORY_RISK: dict[str, float] = {
    "crypto": 1.0,
    "gift_card": 0.95,
    "gambling": 0.9,
    "cash_advance": 0.85,
    "jewelry": 0.65,
    "electronics": 0.55,
    "travel": 0.45,
    "ecommerce": 0.35,
    "fashion": 0.3,
    "other": 0.3,
    "entertainment": 0.25,
    "transport": 0.15,
    "subscription": 0.15,
    "grocery": 0.1,
    "food": 0.1,
    "healthcare": 0.1,
    "education": 0.1,
    "utilities": 0.05,
}

CATEGORY_LABELS: dict[str, str] = {
    "crypto": "Tiền mã hóa",
    "gift_card": "Thẻ quà tặng",
    "gambling": "Cá cược",
    "cash_advance": "Ứng tiền mặt",
    "jewelry": "Trang sức",
    "electronics": "Điện tử",
    "travel": "Du lịch",
    "ecommerce": "Thương mại điện tử",
    "fashion": "Thời trang",
    "other": "Khác",
    "entertainment": "Giải trí",
    "transport": "Vận tải",
    "subscription": "Đăng ký định kỳ",
    "grocery": "Tạp hóa",
    "food": "Ẩm thực",
    "healthcare": "Y tế",
    "education": "Giáo dục",
    "utilities": "Tiện ích",
}

CHANNEL_LABELS: dict[str, str] = {
    "online": "Online",
    "pos": "POS",
    "atm": "ATM",
    "transfer": "Chuyển khoản",
}

FEATURE_NAMES = [
    "amount_log",
    "hour_sin",
    "hour_cos",
    "is_night",
    "country_mismatch",
    "new_device",
    "velocity_1h",
    "velocity_24h",
    "amount_ratio_log",
    "distinct_merchants_24d",
    "account_age_days",
    "category_risk",
    "channel_online",
]

FEATURE_LABELS: dict[str, str] = {
    "amount_log": "Giá trị giao dịch",
    "hour_sin": "Giờ giao dịch",
    "hour_cos": "Giờ giao dịch",
    "is_night": "Giao dịch ban đêm",
    "country_mismatch": "Lệch quốc gia IP/thẻ",
    "new_device": "Thiết bị mới",
    "velocity_1h": "Tần suất 1 giờ",
    "velocity_24h": "Tần suất 24 giờ",
    "amount_ratio_log": "So với chi tiêu thường ngày",
    "distinct_merchants_24d": "Số merchant trong 24 giờ",
    "account_age_days": "Tuổi tài khoản",
    "category_risk": "Rủi ro ngành hàng",
    "channel_online": "Kênh online",
}


def local_hour(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt.astimezone(timezone.utc).hour + TZ_OFFSET_HOURS) % 24


def is_night_hour(hour: int) -> bool:
    return hour < 5 or hour >= 23


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_context(
    *,
    amount: float,
    occurred_at: datetime,
    card_country: str,
    ip_country: str,
    device_id: str,
    merchant_category: str,
    channel: str,
    history: list[dict[str, Any]],
    now: datetime | None = None,
) -> dict[str, Any]:
    """Tính feature hành vi từ lịch sử giao dịch của khách hàng.

    ``history`` là danh sách giao dịch trước đó (mới nhất trước), mỗi phần tử có
    ``amount``, ``occurred_at``, ``device_id``, ``merchant_name``, ``merchant_category``.
    """
    now = now or occurred_at
    hour = local_hour(occurred_at)
    amount = float(amount)

    last_30d = [h for h in history if _within_days(h["occurred_at"], occurred_at, 30)]
    last_24h = [h for h in history if _within_hours(h["occurred_at"], occurred_at, 24)]
    last_1h = [h for h in history if _within_hours(h["occurred_at"], occurred_at, 1)]

    avg_30d = sum(to_float(h["amount"]) for h in last_30d) / len(last_30d) if last_30d else amount
    avg_30d = max(avg_30d, 1.0)
    seen_devices = {h.get("device_id") for h in history}
    first_seen = min((h["occurred_at"] for h in history), default=occurred_at)
    account_age_days = max((occurred_at - first_seen).days, 0)

    return {
        "amount": amount,
        "channel": channel,
        "merchant_category": merchant_category,
        "merchant_country": None,
        "card_country": card_country,
        "ip_country": ip_country,
        "hour": hour,
        "is_night": is_night_hour(hour),
        "country_mismatch": card_country != ip_country,
        "new_device": device_id not in seen_devices if history else False,
        "velocity_1h": len(last_1h) + 1,
        "velocity_24h": len(last_24h) + 1,
        "amount_ratio": round(amount / avg_30d, 2),
        "distinct_merchants_24d": len({h.get("merchant_name") for h in last_24h} | set()),
        "account_age_days": account_age_days,
        "avg_amount_30d": round(avg_30d, 2),
        "txn_count_30d": len(last_30d),
        "usual_hours": sorted({local_hour(h["occurred_at"]) for h in last_30d})[:12],
        "usual_categories": _top_values([h.get("merchant_category") for h in last_30d], 3),
        "usual_countries": _top_values([h.get("ip_country") for h in last_30d], 3),
        "seen_devices": len(seen_devices),
    }


def _within_hours(earlier: datetime, later: datetime, hours: float) -> bool:
    delta = (later - earlier).total_seconds()
    return 0 <= delta <= hours * 3600


def _within_days(earlier: datetime, later: datetime, days: int) -> bool:
    return _within_hours(earlier, later, days * 24)


def _top_values(values: list[Any], limit: int) -> list[str]:
    counts: dict[str, int] = {}
    for value in values:
        if value:
            counts[str(value)] = counts.get(str(value), 0) + 1
    return [item for item, _ in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]]


def feature_vector(ctx: dict[str, Any]) -> list[float]:
    hour = int(ctx["hour"])
    return [
        math.log1p(max(to_float(ctx["amount"]), 0.0)),
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        1.0 if ctx["is_night"] else 0.0,
        1.0 if ctx["country_mismatch"] else 0.0,
        1.0 if ctx["new_device"] else 0.0,
        to_float(ctx["velocity_1h"], 1.0),
        to_float(ctx["velocity_24h"], 1.0),
        math.log1p(max(to_float(ctx["amount_ratio"], 1.0), 0.0)),
        to_float(ctx["distinct_merchants_24d"], 0.0),
        min(to_float(ctx["account_age_days"], 0.0), 3650.0),
        CATEGORY_RISK.get(str(ctx.get("merchant_category")), 0.3),
        1.0 if ctx.get("channel") == "online" else 0.0,
    ]


def format_vnd(amount: float) -> str:
    return f"{amount:,.0f} ₫".replace(",", ".")
