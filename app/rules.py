from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Rule

NUMERIC_OPS = {">", ">=", "<", "<="}


def _coerce(value: Any, target: Any) -> Any:
    if isinstance(target, bool):
        if isinstance(value, str):
            return value.lower() in {"true", "1", "yes"}
        return bool(value)
    if isinstance(target, (int, float)) and not isinstance(target, bool):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    return str(value) if value is not None else None


def evaluate_condition(condition: dict[str, Any], ctx: dict[str, Any]) -> bool:
    field = condition.get("field")
    op = condition.get("op")
    expected = condition.get("value")
    if field not in ctx or ctx.get(field) is None:
        return False
    actual = ctx[field]

    if op in NUMERIC_OPS:
        actual_number = _coerce(actual, 0.0)
        expected_number = _coerce(expected, 0.0)
        if actual_number is None or expected_number is None:
            return False
        return {
            ">": actual_number > expected_number,
            ">=": actual_number >= expected_number,
            "<": actual_number < expected_number,
            "<=": actual_number <= expected_number,
        }[op]

    if op in {"in", "not_in"}:
        options = expected if isinstance(expected, list) else [expected]
        normalized_options = {str(option).lower() for option in options}
        matched = str(actual).lower() in normalized_options
        return matched if op == "in" else not matched

    if op == "==":
        if isinstance(expected, bool) or isinstance(actual, bool):
            return _coerce(actual, expected) == _coerce(expected, actual)
        if isinstance(expected, (int, float)) and not isinstance(expected, bool):
            return _coerce(actual, 0.0) == float(expected)
        return str(actual) == str(expected)

    if op == "!=":
        return not evaluate_condition({**condition, "op": "=="}, ctx)

    return False


def evaluate_rules(rules: list[Rule], ctx: dict[str, Any]) -> tuple[float, list[dict[str, Any]]]:
    hits: list[dict[str, Any]] = []
    total = 0
    for rule in rules:
        if not rule.enabled:
            continue
        conditions = rule.conditions or []
        if not conditions:
            continue
        if all(evaluate_condition(condition, ctx) for condition in conditions):
            total += rule.weight
            hits.append(
                {
                    "rule_id": rule.id,
                    "name": rule.name,
                    "severity": rule.severity,
                    "weight": rule.weight,
                    "category": rule.category,
                    "conditions": conditions,
                }
            )
    return float(min(total, 100)), hits


def load_enabled_rules(db: Session) -> list[Rule]:
    return list(db.scalars(select(Rule).where(Rule.enabled.is_(True)).order_by(Rule.weight.desc())).all())
