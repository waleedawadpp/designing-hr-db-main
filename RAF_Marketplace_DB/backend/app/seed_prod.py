"""Idempotent production bootstrap.

Run after migrations (``alembic upgrade head``):

    python -m app.seed_prod

Seeds the RBAC roles + permissions and their mappings, and — when
``RAF_SEED_ADMIN_EMAIL`` / ``RAF_SEED_ADMIN_PASSWORD`` are set — creates a first
administrator account. Safe to run repeatedly.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.security import hash_password
from orm import (
    AppUser, Permission, Role, RolePermission, UserRole, UserStatus,
)

# role_key -> (name_ar, name_en)
ROLES = {
    "customer": ("عميل", "Customer"),
    "vendor_owner": ("صاحب متجر", "Vendor Owner"),
    "vendor_staff": ("موظف متجر", "Vendor Staff"),
    "admin": ("مدير النظام", "Administrator"),
}

PERMISSIONS = [
    "product.create", "product.moderate", "vendor.approve", "order.manage",
    "payout.process", "reports.platform", "marketing.manage", "catalog.manage",
    "ai.monitor",
]

# role_key -> permission keys ("*" = all)
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "vendor_owner": ["product.create", "order.manage", "marketing.manage"],
    "vendor_staff": [],
    "customer": [],
}


def _seed_roles(db: Session) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for key, (name_ar, name_en) in ROLES.items():
        role = db.scalar(select(Role).where(Role.role_key == key))
        if role is None:
            role = Role(role_key=key, name_ar=name_ar, name_en=name_en)
            db.add(role)
        roles[key] = role
    db.flush()
    return roles


def _seed_permissions(db: Session) -> dict[str, Permission]:
    perms: dict[str, Permission] = {}
    for key in PERMISSIONS:
        perm = db.scalar(select(Permission).where(Permission.perm_key == key))
        if perm is None:
            perm = Permission(perm_key=key, description=key)
            db.add(perm)
        perms[key] = perm
    db.flush()
    return perms


def _map_role_permissions(db: Session, roles, perms) -> None:
    for role_key, perm_keys in ROLE_PERMISSIONS.items():
        granted = list(perms.values()) if perm_keys == ["*"] else [perms[k] for k in perm_keys]
        for perm in granted:
            exists = db.get(
                RolePermission,
                {"role_id": roles[role_key].role_id, "permission_id": perm.permission_id},
            )
            if exists is None:
                db.add(RolePermission(role_id=roles[role_key].role_id,
                                      permission_id=perm.permission_id))


def _seed_admin(db: Session, roles) -> str:
    if not settings.seed_admin_email or not settings.seed_admin_password:
        return "skipped (RAF_SEED_ADMIN_EMAIL/PASSWORD not set)"
    user = db.scalar(select(AppUser).where(AppUser.email == settings.seed_admin_email))
    if user is None:
        user = AppUser(
            full_name=settings.seed_admin_name, email=settings.seed_admin_email,
            password_hash=hash_password(settings.seed_admin_password),
            status=UserStatus.active, email_verified=True,
        )
        db.add(user)
        db.flush()
        created = "created"
    else:
        created = "already exists"
    admin_role = roles["admin"]
    if db.get(UserRole, {"user_id": user.user_id, "role_id": admin_role.role_id}) is None:
        db.add(UserRole(user_id=user.user_id, role_id=admin_role.role_id))
    return f"admin {settings.seed_admin_email}: {created}"


def main() -> None:
    with SessionLocal() as db:
        roles = _seed_roles(db)
        perms = _seed_permissions(db)
        _map_role_permissions(db, roles, perms)
        admin_status = _seed_admin(db, roles)
        db.commit()
    print(f"[seed_prod] roles={len(ROLES)} permissions={len(PERMISSIONS)} | {admin_status}")


if __name__ == "__main__":
    main()
