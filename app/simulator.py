from __future__ import annotations

import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.synthetic import MERCHANTS
from app.models import Transaction, utcnow
from app.schemas import TransactionIn
from app.scoring import ingest_transaction

SUSPICIOUS_MERCHANTS = [m for m in MERCHANTS if m[1] in {"crypto", "gift_card", "gambling", "electronics", "jewelry"}]


def simulate_transactions(
    db: Session, *, count: int, fraud_bias: float = 0.3, seed: int | None = None
) -> list[Transaction]:
    rng = random.Random(seed)
    customers = db.execute(
        select(Transaction.customer_id, Transaction.customer_name)
        .group_by(Transaction.customer_id, Transaction.customer_name)
        .limit(500)
    ).all()
    if not customers:
        raise ValueError("Chưa có dữ liệu khách hàng để mô phỏng")

    results: list[Transaction] = []
    now = utcnow()
    for index in range(count):
        customer_id, customer_name = rng.choice(customers)
        recent = db.scalars(
            select(Transaction)
            .where(Transaction.customer_id == customer_id)
            .order_by(Transaction.occurred_at.desc())
            .limit(20)
        ).all()
        avg = (
            sum(float(txn.amount) for txn in recent) / len(recent) if recent else 800_000
        )
        device = recent[0].device_id if recent and rng.random() > 0.4 else f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
        ip_country = "VN"
        channel = rng.choices(["online", "pos", "transfer", "atm"], weights=[55, 30, 10, 5], k=1)[0]

        suspicious = rng.random() < fraud_bias
        if suspicious:
            pattern = rng.choice(["takeover", "geo", "card_testing", "burst"])
            if pattern == "takeover":
                amount = rng.randrange(12, 60) * 1_000_000
                merchant = rng.choice(SUSPICIOUS_MERCHANTS)
                ip_country = rng.choice(["RU", "NG", "US", "HK"])
                device = f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
            elif pattern == "geo":
                amount = rng.randrange(4, 25) * 1_000_000
                merchant = rng.choice(MERCHANTS)
                ip_country = rng.choice(["RU", "NG", "HK", "ID"])
            elif pattern == "card_testing":
                amount = rng.randrange(5, 45) * 1000
                merchant = rng.choice([m for m in MERCHANTS if m[1] in {"crypto", "gift_card"}])
                device = f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
            else:
                amount = rng.randrange(2, 9) * 1_000_000
                merchant = rng.choice(MERCHANTS)
                device = f"dev-{rng.randrange(0x100000, 0xFFFFFF):x}"
            channel = "online"
        else:
            amount = max(round(rng.lognormvariate(__import__("math").log(max(avg, 1)), 0.5) / 1000) * 1000, 10_000)
            merchant = rng.choice(MERCHANTS)
            if rng.random() < 0.5:
                channel = "pos"

        payload = TransactionIn(
            external_id=f"SIM-{now.strftime('%Y%m%d%H%M%S')}-{index}-{rng.randrange(1000, 9999)}",
            customer_id=customer_id,
            customer_name=customer_name,
            amount=float(amount),
            channel=channel,
            merchant_name=merchant[0],
            merchant_category=merchant[1],
            merchant_country=merchant[2],
            card_country="VN",
            ip_country=ip_country,
            device_id=device,
            occurred_at=now - timedelta(seconds=rng.randrange(0, 40)),
        )
        results.append(ingest_transaction(db, payload, simulated=True, commit=False))

    db.commit()
    for txn in results:
        db.refresh(txn)
    return results
