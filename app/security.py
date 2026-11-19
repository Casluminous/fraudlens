from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import RefreshSession, User

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(bytes.fromhex(digest_hex)),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> tuple[str, int]:
    expires_in = settings.access_token_minutes * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, expires_in


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Phiên đăng nhập đã hết hạn") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token không hợp lệ") from exc
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sai loại token")
    return payload


def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue_refresh_token(db: Session, user: User, ip: str, user_agent: str) -> str:
    raw = secrets.token_urlsafe(48)
    session = RefreshSession(
        user_id=user.id,
        token_hash=_token_hash(raw),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=settings.refresh_token_days),
        ip=ip,
        user_agent=user_agent[:255],
    )
    db.add(session)
    db.commit()
    return raw


def consume_refresh_token(db: Session, raw: str) -> User:
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == _token_hash(raw)))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if session is None or session.revoked:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Phiên làm việc không hợp lệ")
    if session.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Phiên làm việc đã hết hạn")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tài khoản không còn hoạt động")

    session.revoked = True
    db.commit()
    return user


def revoke_refresh_token(db: Session, raw: str) -> None:
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == _token_hash(raw)))
    if session is not None:
        session.revoked = True
        db.commit()


def revoke_all_sessions(db: Session, user_id: str) -> None:
    sessions = db.scalars(
        select(RefreshSession).where(RefreshSession.user_id == user_id, RefreshSession.revoked.is_(False))
    ).all()
    for session in sessions:
        session.revoked = True
    db.commit()
