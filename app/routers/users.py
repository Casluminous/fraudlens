from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit import log_action
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import Case, User, utcnow
from app.schemas import PasswordReset, UserCreate, UserOut, UserUpdate
from app.security import hash_password, revoke_all_sessions

router = APIRouter(prefix="/users", tags=["users"])


def _active_admin_count(db: Session, exclude_id: str | None = None) -> int:
    query = select(func.count()).select_from(User).where(User.role == "admin", User.is_active.is_(True))
    if exclude_id:
        query = query.where(User.id != exclude_id)
    return db.scalar(query) or 0


@router.get("", response_model=list[UserOut])
def list_users(
    _: User = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    actor: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> User:
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã tồn tại")
    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    log_action(
        db,
        actor=actor,
        action="user.create",
        entity_type="user",
        entity_id=user.id,
        after={"email": email, "role": payload.role, "full_name": payload.full_name},
        request=request,
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    actor: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy người dùng")

    before = {"full_name": user.full_name, "role": user.role, "is_active": user.is_active}
    if (
        payload.role is not None
        and payload.role != "admin"
        and user.role == "admin"
        and _active_admin_count(db, exclude_id=user.id) == 0
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Không thể hạ quyền admin cuối cùng")
    if payload.is_active is False and user.id == actor.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Không thể tự vô hiệu hoá tài khoản đang đăng nhập")
    if payload.is_active is False and user.role == "admin" and _active_admin_count(db, exclude_id=user.id) == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Không thể vô hiệu hoá admin cuối cùng")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            revoke_all_sessions(db, user.id)

    log_action(
        db,
        actor=actor,
        action="user.update",
        entity_type="user",
        entity_id=user.id,
        before=before,
        after={"full_name": user.full_name, "role": user.role, "is_active": user.is_active},
        request=request,
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    user_id: str,
    payload: PasswordReset,
    request: Request,
    actor: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy người dùng")
    user.password_hash = hash_password(payload.new_password)
    revoke_all_sessions(db, user.id)
    log_action(
        db,
        actor=actor,
        action="user.reset_password",
        entity_type="user",
        entity_id=user.id,
        request=request,
    )
    db.commit()


@router.get("/analysts", response_model=list[UserOut])
def list_analysts(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.role.in_(("admin", "analyst")), User.is_active.is_(True))
            .order_by(User.full_name)
        ).all()
    )


@router.get("/{user_id}/workload")
def user_workload(
    user_id: str,
    _: User = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
) -> dict:
    open_cases = db.scalar(
        select(func.count()).select_from(Case).where(Case.assigned_to == user_id, Case.status != "resolved")
    ) or 0
    resolved = db.scalar(
        select(func.count()).select_from(Case).where(Case.assigned_to == user_id, Case.status == "resolved")
    ) or 0
    return {"open_cases": open_cases, "resolved_cases": resolved, "checked_at": utcnow()}
