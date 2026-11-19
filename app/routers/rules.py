from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_action
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import Rule, Transaction, User
from app.rules import evaluate_condition
from app.schemas import RuleCreate, RuleOut, RuleTestRequest, RuleUpdate

router = APIRouter(prefix="/rules", tags=["rules"])

FIELDS: list[dict] = [
    {"key": "amount", "label": "Số tiền (VND)", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "amount_ratio", "label": "Số tiền / trung bình 30 ngày", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "velocity_1h", "label": "Số giao dịch trong 1 giờ", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "velocity_24h", "label": "Số giao dịch trong 24 giờ", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "distinct_merchants_24d", "label": "Số merchant trong 24 giờ", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "account_age_days", "label": "Tuổi tài khoản (ngày)", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "hour", "label": "Giờ giao dịch (0-23)", "type": "number", "ops": [">", ">=", "<", "<="]},
    {"key": "is_night", "label": "Giao dịch ban đêm", "type": "bool", "ops": ["=="]},
    {"key": "country_mismatch", "label": "Lệch quốc gia IP/thẻ", "type": "bool", "ops": ["=="]},
    {"key": "new_device", "label": "Thiết bị mới", "type": "bool", "ops": ["=="]},
    {
        "key": "merchant_category",
        "label": "Ngành hàng",
        "type": "enum",
        "ops": ["in", "not_in"],
        "options": [
            "crypto", "gift_card", "gambling", "cash_advance", "jewelry", "electronics",
            "travel", "ecommerce", "fashion", "entertainment", "grocery", "food",
            "subscription", "utilities", "healthcare", "education", "transport", "other",
        ],
    },
    {"key": "channel", "label": "Kênh giao dịch", "type": "enum", "ops": ["in", "not_in"], "options": ["online", "pos", "atm", "transfer"]},
    {"key": "card_country", "label": "Quốc gia thẻ", "type": "string", "ops": ["==", "!="]},
    {"key": "ip_country", "label": "Quốc gia IP", "type": "string", "ops": ["==", "!="]},
    {"key": "merchant_country", "label": "Quốc gia merchant", "type": "string", "ops": ["==", "!="]},
]

FIELD_MAP = {field["key"]: field for field in FIELDS}


def _validate_conditions(conditions: list) -> None:
    for condition in conditions:
        field = FIELD_MAP.get(condition.field)
        if field is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Field không hỗ trợ: {condition.field}")
        if condition.op not in field["ops"]:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Toán tử {condition.op} không hợp lệ cho {condition.field}",
            )
        if field["type"] == "enum" and isinstance(condition.value, str):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Giá trị enum phải là danh sách")


def _serialize(rule: Rule) -> RuleOut:
    return RuleOut.model_validate(rule)


@router.get("/fields")
def list_fields(_: User = Depends(get_current_user)) -> dict:
    return {"fields": FIELDS, "ops": [">", ">=", "<", "<=", "==", "!=", "in", "not_in"]}


@router.get("", response_model=list[RuleOut])
def list_rules(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Rule]:
    return list(db.scalars(select(Rule).order_by(Rule.weight.desc(), Rule.name)).all())


@router.post("", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: RuleCreate,
    request: Request,
    actor: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> Rule:
    _validate_conditions(payload.conditions)
    rule = Rule(
        name=payload.name.strip(),
        description=payload.description.strip(),
        conditions=[condition.model_dump() for condition in payload.conditions],
        weight=payload.weight,
        severity=payload.severity,
        category=payload.category,
        enabled=payload.enabled,
    )
    db.add(rule)
    db.flush()
    log_action(
        db,
        actor=actor,
        action="rule.create",
        entity_type="rule",
        entity_id=rule.id,
        after={"name": rule.name, "weight": rule.weight, "conditions": rule.conditions},
        request=request,
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/{rule_id}", response_model=RuleOut)
def update_rule(
    rule_id: str,
    payload: RuleUpdate,
    request: Request,
    actor: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> Rule:
    rule = db.get(Rule, rule_id)
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy rule")
    if payload.conditions is not None:
        _validate_conditions(payload.conditions)
    before = {
        "name": rule.name,
        "weight": rule.weight,
        "enabled": rule.enabled,
        "conditions": rule.conditions,
        "severity": rule.severity,
    }
    if payload.name is not None:
        rule.name = payload.name.strip()
    if payload.description is not None:
        rule.description = payload.description.strip()
    if payload.conditions is not None:
        rule.conditions = [condition.model_dump() for condition in payload.conditions]
    if payload.weight is not None:
        rule.weight = payload.weight
    if payload.severity is not None:
        rule.severity = payload.severity
    if payload.category is not None:
        rule.category = payload.category
    if payload.enabled is not None:
        rule.enabled = payload.enabled

    log_action(
        db,
        actor=actor,
        action="rule.update",
        entity_type="rule",
        entity_id=rule.id,
        before=before,
        after={
            "name": rule.name,
            "weight": rule.weight,
            "enabled": rule.enabled,
            "conditions": rule.conditions,
            "severity": rule.severity,
        },
        request=request,
    )
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: str,
    request: Request,
    actor: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> None:
    rule = db.get(Rule, rule_id)
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy rule")
    log_action(
        db,
        actor=actor,
        action="rule.delete",
        entity_type="rule",
        entity_id=rule.id,
        before={"name": rule.name, "conditions": rule.conditions, "weight": rule.weight},
        request=request,
    )
    db.delete(rule)
    db.commit()


@router.post("/{rule_id}/test")
def test_rule(
    rule_id: str,
    payload: RuleTestRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    rule = db.get(Rule, rule_id)
    txn = db.get(Transaction, payload.transaction_id)
    if rule is None or txn is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy rule hoặc giao dịch")
    ctx = {
        "amount": float(txn.amount),
        "amount_ratio": txn.amount_ratio,
        "velocity_1h": txn.velocity_1h,
        "velocity_24h": txn.velocity_24h,
        "distinct_merchants_24d": txn.distinct_merchants_24d,
        "account_age_days": txn.account_age_days,
        "hour": txn.hour,
        "is_night": txn.is_night,
        "country_mismatch": txn.country_mismatch,
        "new_device": txn.new_device,
        "merchant_category": txn.merchant_category,
        "channel": txn.channel,
        "card_country": txn.card_country,
        "ip_country": txn.ip_country,
        "merchant_country": txn.merchant_country,
    }
    results = [
        {
            "field": condition.get("field"),
            "op": condition.get("op"),
            "expected": condition.get("value"),
            "actual": ctx.get(condition.get("field")),
            "matched": evaluate_condition(condition, ctx),
        }
        for condition in rule.conditions
    ]
    return {"rule_id": rule.id, "name": rule.name, "matched": all(item["matched"] for item in results), "conditions": results}
