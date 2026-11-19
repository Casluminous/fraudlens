from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from app.features import build_context, format_vnd, local_hour

MERCHANTS: list[tuple[str, str, str]] = [
    ("Shopee Việt Nam", "ecommerce", "VN"),
    ("Lazada Việt Nam", "ecommerce", "VN"),
    ("Tiki", "ecommerce", "VN"),
    ("TikTok Shop", "ecommerce", "VN"),
    ("Thế Giới Di Động", "electronics", "VN"),
    ("FPT Shop", "electronics", "VN"),
    ("CellphoneS", "electronics", "VN"),
    ("Bách Hóa Xanh", "grocery", "VN"),
    ("WinMart", "grocery", "VN"),
    ("Highlands Coffee", "food", "VN"),
    ("Phúc Long", "food", "VN"),
    ("Grab Việt Nam", "transport", "VN"),
    ("Be Group", "transport", "VN"),
    ("Vietnam Airlines", "travel", "VN"),
    ("Vietjet Air", "travel", "VN"),
    ("Agoda", "travel", "SG"),
    ("Booking.com", "travel", "NL"),
    ("CGV Cinemas", "entertainment", "VN"),
    ("Galaxy Cinema", "entertainment", "VN"),
    ("Steam", "entertainment", "US"),
    ("Netflix", "subscription", "US"),
    ("Spotify", "subscription", "SE"),
    ("Viettel Telecom", "utilities", "VN"),
    ("EVN HCMC", "utilities", "VN"),
    ("Pharmacity", "healthcare", "VN"),
    ("Nhà thuốc Long Châu", "healthcare", "VN"),
    ("PNJ", "jewelry", "VN"),
    ("DOJI", "jewelry", "VN"),
    ("Vincom Fashion", "fashion", "VN"),
    ("Zara Việt Nam", "fashion", "VN"),
    ("Shein", "fashion", "SG"),
    ("Temu", "ecommerce", "US"),
    ("Amazon", "ecommerce", "US"),
    ("Coursera", "education", "US"),
    ("Udemy", "education", "US"),
    ("Binance", "crypto", "SC"),
    ("Remitano", "crypto", "SC"),
    ("ONUS", "crypto", "SG"),
    ("1xBet", "gambling", "CY"),
    ("Fun88", "gambling", "PH"),
    ("GiftCard Hub", "gift_card", "US"),
    ("CardXchange", "gift_card", "US"),
    ("ATM Vietcombank", "cash_advance", "VN"),
    ("ATM Techcombank", "cash_advance", "VN"),
    ("ShopeeFood", "food", "VN"),
    ("Lotte Mart", "grocery", "VN"),
    ("Guardian", "healthcare", "VN"),
    ("The Coffee House", "food", "VN"),
]

CATEGORY_WEIGHTS = {
    "food": 22,
    "grocery": 18,
    "transport": 14,
    "ecommerce": 12,
    "entertainment": 8,
    "utilities": 7,
    "subscription": 5,
    "healthcare": 5,
    "fashion": 4,
    "electronics": 2,
    "travel": 1.5,
    "jewelry": 0.6,
    "education": 0.5,
    "crypto": 0.25,
    "gambling": 0.1,
    "gift_card": 0.15,
    "cash_advance": 1.5,
}

FOREIGN_IPS = ["SG", "US", "TH", "MY", "ID", "PH", "GB", "RU", "NG", "HK"]
TRAVEL_IPS = ["SG", "TH", "MY", "JP", "KR", "US", "AU"]
SURNAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"]
GIVEN_NAMES = [
    "An", "Bình", "Châu", "Dũng", "Dung", "Giang", "Hà", "Hải", "Hiếu", "Hoa", "Hùng", "Huy",
    "Khanh", "Lan", "Linh", "Long", "Mai", "Minh", "Nam", "Nga", "Ngọc", "Nhung", "Phong", "Phúc",
    "Quân", "Quỳnh", "Sơn", "Tâm", "Thảo", "Thắng", "Thu", "Trang", "Trung", "Tuấn", "Vy", "Yến",
]


def _choose_merchant(rng: random.Random, allowed: list[tuple[str, str, str]]) -> tuple[str, str, str]:
    weights = [CATEGORY_WEIGHTS.get(cat, 0.5) for _, cat, _ in allowed]
    return rng.choices(allowed, weights=weights, k=1)[0]


def _amount_for(rng: random.Random, avg_spend: float, category: str, foreign: bool) -> float:
    multiplier = {
        "travel": 6.0,
        "electronics": 4.2,
        "jewelry": 5.5,
        "cash_advance": 2.4,
        "crypto": 3.0,
        "gambling": 2.2,
        "gift_card": 1.6,
        "utilities": 1.1,
        "grocery": 0.55,
        "food": 0.35,
        "transport": 0.25,
        "subscription": 0.2,
        "education": 1.4,
    }.get(category, 1.0)
    if foreign:
        multiplier *= 1.6
    value = rng.lognormvariate(math.log(max(avg_spend * multiplier, 1)), 0.55)
    return max(round(value / 1000) * 1000, 5000)


def _event_time(rng: random.Random, day: datetime, preferred_hour: int) -> datetime:
    hour = min(max(int(rng.gauss(preferred_hour, 2.6)), 6), 22)
    return day.replace(hour=hour, minute=rng.randrange(60), second=rng.randrange(60))


def generate_dataset(
    *,
    seed: int = 42,
    days: int = 60,
    customers: int = 900,
    fraud_events_per_customer: float = 0.045,
    anomaly_rate: float = 0.05,
    start: datetime | None = None,
) -> list[dict[str, Any]]:
    """Sinh dataset giao dịch tổng hợp có nhãn và pattern gian lận.

    Mỗi bản ghi chứa đầy đủ feature hành vi đã tính tại thời điểm giao dịch,
    dùng chung cho cả huấn luyện model và seed database demo.
    """
    rng = random.Random(seed)
    end = start or datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    begin = end - timedelta(days=days)
    records: list[dict[str, Any]] = []

    profiles: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    for _ in range(customers):
        customer_id = f"CUS-{rng.randrange(100000, 999999)}"
        while customer_id in used_ids:
            customer_id = f"CUS-{rng.randrange(100000, 999999)}"
        used_ids.add(customer_id)
        name = f"{rng.choice(SURNAMES)} {rng.choice(GIVEN_NAMES)}"
        primary_device = f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
        devices = [primary_device]
        if rng.random() < 0.35:
            devices.append(f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}")
        profile = {
            "id": customer_id,
            "name": name,
            "avg_spend": rng.choice([180_000, 250_000, 350_000, 500_000, 750_000, 1_200_000, 2_000_000]),
            "preferred_hour": rng.randint(8, 20),
            "devices": devices,
            "signup_age": rng.randint(45, 1500),
            "foreign_tolerance": rng.random() < 0.12,
            "travel_start": rng.randrange(1, days) if rng.random() < 0.06 else None,
            "travel_days": rng.randint(2, 5),
        }
        profiles.append(profile)

    fraud_patterns = ["card_testing", "takeover", "geo_mismatch", "velocity_burst", "merchant_risk"]

    for profile in profiles:
        history: list[dict[str, Any]] = []
        for offset in range(days):
            day = begin + timedelta(days=offset)
            activity = rng.choices([0, 1, 2, 3], weights=[24, 46, 22, 8], k=1)[0]
            for _ in range(activity):
                occurred = _event_time(rng, day, profile["preferred_hour"])
                if occurred >= end:
                    continue
                merchant_name, category, merchant_country = _choose_merchant(rng, MERCHANTS)
                traveling = (
                    profile["travel_start"] is not None
                    and profile["travel_start"] <= offset < profile["travel_start"] + profile["travel_days"]
                )
                new_device = rng.random() < 0.015
                device = rng.choice(profile["devices"]) if not new_device else f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
                ip_country = "VN"
                if traveling:
                    ip_country = rng.choice(TRAVEL_IPS)
                    merchant_name, category, merchant_country = _choose_merchant(
                        rng, [m for m in MERCHANTS if m[2] in TRAVEL_IPS] or MERCHANTS
                    )
                elif profile["foreign_tolerance"] and rng.random() < 0.08:
                    ip_country = rng.choice(FOREIGN_IPS)
                amount = _amount_for(rng, profile["avg_spend"], category, ip_country != "VN")
                record = _make_record(
                    profile,
                    history,
                    occurred,
                    amount,
                    merchant_name,
                    category,
                    merchant_country,
                    ip_country,
                    device,
                    label=0,
                    pattern="travel" if traveling else ("new_device" if new_device else "normal"),
                    rng=rng,
                )
                records.append(record)
                history.append(_history_item(record))

            if rng.random() < fraud_events_per_customer:
                pattern = rng.choice(fraud_patterns)
                burst = 1
                if pattern == "card_testing":
                    burst = rng.randint(2, 4)
                elif pattern == "velocity_burst":
                    burst = rng.randint(4, 7)
                night = rng.random() < 0.75
                soft = rng.random() < 0.6
                if soft:
                    night = rng.random() < 0.4
                base_time = day.replace(
                    hour=rng.choice([0, 1, 2, 3, 4, 23]) if night else rng.randint(9, 20),
                    minute=rng.randrange(60),
                    second=rng.randrange(60),
                )
                for step in range(burst):
                    occurred = base_time + timedelta(minutes=step * rng.randint(3, 12))
                    if occurred >= end:
                        break
                    record = _fraud_record(profile, history, occurred, pattern, rng, soft=soft)
                    records.append(record)
                    history.append(_history_item(record))

            # Giao dịch hợp lệ nhưng bất thường: mua sắm lớn, du lịch, đổi thiết bị.
            if rng.random() < anomaly_rate:
                occurred = _event_time(rng, day, profile["preferred_hour"])
                if rng.random() < 0.45:
                    occurred = occurred.replace(hour=rng.choice([0, 1, 2, 3, 4, 22, 23]))
                if occurred < end:
                    pool = [m for m in MERCHANTS if m[1] in {"electronics", "travel", "jewelry", "crypto", "gift_card"}]
                    merchant_name, category, merchant_country = rng.choice(pool)
                    amount = rng.randrange(1, 15) * 1_000_000
                    device = rng.choice(profile["devices"])
                    if rng.random() < 0.4:
                        device = f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
                    record = _make_record(
                        profile,
                        history,
                        occurred,
                        float(amount),
                        merchant_name,
                        category,
                        merchant_country,
                        "VN" if rng.random() < 0.5 else rng.choice(FOREIGN_IPS),
                        device,
                        label=0,
                        pattern="legit_big_ticket",
                        rng=rng,
                    )
                    records.append(record)
                    history.append(_history_item(record))

                    # Hợp lệ nhưng dồn dập: thanh toán hóa đơn, mua sắm liên tục.
                    if rng.random() < 0.4:
                        for step in range(rng.randint(2, 4)):
                            extra_time = occurred + timedelta(minutes=8 * (step + 1))
                            if extra_time >= end:
                                break
                            m_name, cat, m_country = _choose_merchant(rng, MERCHANTS)
                            extra = _make_record(
                                profile,
                                history,
                                extra_time,
                                float(rng.randrange(150, 2500) * 1000),
                                m_name,
                                cat,
                                m_country,
                                "VN",
                                device,
                                label=0,
                                pattern="legit_burst",
                                rng=rng,
                            )
                            records.append(extra)
                            history.append(_history_item(extra))

        history.sort(key=lambda item: item["occurred_at"])

    records.sort(key=lambda item: item["occurred_at"])
    # Đảm bảo external_id không trùng sau khi trộn.
    for index, record in enumerate(records):
        record["external_id"] = f"TXN-{seed}-{index:07d}"
    return records


def _make_record(
    profile: dict[str, Any],
    history: list[dict[str, Any]],
    occurred: datetime,
    amount: float,
    merchant_name: str,
    category: str,
    merchant_country: str,
    ip_country: str,
    device: str,
    *,
    label: int,
    pattern: str,
    rng: random.Random,
) -> dict[str, Any]:
    context = build_context(
        amount=amount,
        occurred_at=occurred,
        card_country="VN",
        ip_country=ip_country,
        device_id=device,
        merchant_category=category,
        channel=rng.choices(["online", "pos", "transfer", "atm"], weights=[55, 30, 10, 5], k=1)[0],
        history=list(reversed(history)),
    )
    context["account_age_days"] = profile["signup_age"]
    return {
        **context,
        "customer_id": profile["id"],
        "customer_name": profile["name"],
        "amount": round(amount, 2),
        "currency": "VND",
        "merchant_name": merchant_name,
        "merchant_country": merchant_country,
        "device_id": device,
        "occurred_at": occurred,
        "label": label,
        "fraud_pattern": pattern,
    }


def _fraud_record(
    profile: dict[str, Any],
    history: list[dict[str, Any]],
    occurred: datetime,
    pattern: str,
    rng: random.Random,
    *,
    soft: bool = False,
) -> dict[str, Any]:
    new_device = f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}" if pattern in {"takeover", "card_testing"} else rng.choice(profile["devices"])
    ip_country = rng.choice(["NG", "RU", "US", "HK", "ID"]) if pattern != "merchant_risk" else "VN"

    if pattern == "card_testing":
        amount = rng.randrange(5, 40) * 1000
        merchant_name, category, merchant_country = rng.choice(
            [m for m in MERCHANTS if m[1] in {"crypto", "gift_card", "gambling"}]
        )
        channel = "online"
    elif pattern == "takeover":
        amount = rng.randrange(9, 55) * 1_000_000
        merchant_name, category, merchant_country = rng.choice(
            [m for m in MERCHANTS if m[1] in {"electronics", "jewelry", "crypto", "travel"}]
        )
        channel = rng.choice(["online", "transfer"])
    elif pattern == "geo_mismatch":
        amount = rng.randrange(3, 22) * 1_000_000
        merchant_name, category, merchant_country = _choose_merchant(rng, MERCHANTS)
        channel = "online"
        ip_country = rng.choice(["RU", "NG", "HK", "ID"])
    elif pattern == "velocity_burst":
        amount = rng.randrange(1, 6) * 1_000_000
        merchant_name, category, merchant_country = _choose_merchant(rng, MERCHANTS)
        channel = "online"
    else:
        amount = rng.randrange(2, 16) * 1_000_000
        merchant_name, category, merchant_country = rng.choice(
            [m for m in MERCHANTS if m[1] in {"crypto", "gambling", "gift_card"}]
        )
        channel = "online"

    if soft:
        # Gian lận "mềm": tín hiệu yếu, nằm trong dải chi tiêu quen thuộc.
        if pattern == "card_testing":
            amount = rng.randrange(30, 120) * 1000
        else:
            amount = max(round(rng.lognormvariate(math.log(profile["avg_spend"] * 1.6), 0.55) / 1000) * 1000, 20000)
        ip_country = "VN"
        new_device = rng.choice(profile["devices"])
        if rng.random() < 0.5:
            merchant_name, category, merchant_country = _choose_merchant(rng, MERCHANTS)

    record = _make_record(
        profile,
        history,
        occurred,
        float(amount),
        merchant_name,
        category,
        merchant_country,
        ip_country,
        new_device,
        label=1,
        pattern=pattern,
        rng=rng,
    )
    record["channel"] = channel
    return record


def _history_item(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "amount": record["amount"],
        "occurred_at": record["occurred_at"],
        "device_id": record["device_id"],
        "merchant_name": record["merchant_name"],
        "merchant_category": record["merchant_category"],
        "ip_country": record["ip_country"],
    }


def describe_pattern_vi(pattern: str) -> str:
    return {
        "card_testing": "Thử thẻ với nhiều giao dịch nhỏ",
        "takeover": "Chiếm đoạt tài khoản, giá trị lớn",
        "geo_mismatch": "Lệch địa lý IP/thẻ",
        "velocity_burst": "Bùng nổ tần suất giao dịch",
        "merchant_risk": "Ngành hàng rủi ro cao",
        "travel": "Du lịch nước ngoài (hợp lệ)",
        "new_device": "Thiết bị mới (hợp lệ)",
        "normal": "Bình thường",
    }.get(pattern, pattern)


__all__ = ["generate_dataset", "describe_pattern_vi", "MERCHANTS", "format_vnd", "local_hour"]
