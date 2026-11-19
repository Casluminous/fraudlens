from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.deps import client_meta
from app.models import AuditLog, User


def log_action(
    db: Session,
    *,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: str = "",
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    ip, user_agent = client_meta(request) if request is not None else ("", "")
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else "system",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
        ip=ip,
        user_agent=user_agent,
    )
    db.add(entry)
    return entry
