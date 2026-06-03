"""Auth dependencies: resolve the current user and enforce RBAC permissions."""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import decode_token
from orm import AppUser, Permission, Role, RolePermission, UserRole, UserStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AppUser:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise _CREDENTIALS_EXC
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _CREDENTIALS_EXC

    user = db.get(AppUser, user_id)
    if user is None or user.deleted_at is not None:
        raise _CREDENTIALS_EXC
    if user.status == UserStatus.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
    return user


def user_permissions(db: Session, user_id: int) -> set[str]:
    """All permission keys granted to a user via their roles."""
    rows = db.scalars(
        select(Permission.perm_key)
        .join(RolePermission, RolePermission.permission_id == Permission.permission_id)
        .join(Role, Role.role_id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .where(UserRole.user_id == user_id)
    ).all()
    return set(rows)


def require_permission(perm_key: str):
    """Dependency factory enforcing that the current user holds ``perm_key``."""

    def _checker(
        user: AppUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> AppUser:
        if perm_key not in user_permissions(db, user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {perm_key}",
            )
        return user

    return _checker
