"""Authentication: registration, login (with optional 2FA), refresh, and 2FA setup."""

from __future__ import annotations

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import (
    MeOut, RefreshIn, RegisterIn, TokenOut, TwoFASetupOut, TwoFAVerifyIn,
)
from app.security import (
    create_access_token, create_refresh_token, decode_token,
    generate_totp_secret, hash_password, totp_provisioning_uri,
    verify_password, verify_totp,
)
from orm import AppUser, Role, UserRole, UserStatus

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(AppUser).where(AppUser.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = AppUser(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        preferred_lang=payload.preferred_lang,
        status=UserStatus.active,
    )
    db.add(user)
    db.flush()  # assign user_id

    # Grant the default 'customer' role if present.
    customer_role = db.scalar(select(Role).where(Role.role_key == "customer"))
    if customer_role:
        db.add(UserRole(user_id=user.user_id, role_id=customer_role.role_id))

    db.commit()
    db.refresh(user)
    return user


def _authenticate(db: Session, email: str, password: str, totp_code: str | None) -> AppUser:
    user = db.scalar(select(AppUser).where(AppUser.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Account is not active")
    if user.twofa_enabled:
        if not totp_code:
            raise HTTPException(status_code=401, detail="2FA code required")
        if not verify_totp(user.twofa_secret or "", totp_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    return user


@router.post("/login", response_model=TokenOut)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """OAuth2 password flow. Pass the 2FA code in the `client_secret` field if enabled."""
    user = _authenticate(db, form.username, form.password, form.client_secret)
    return TokenOut(
        access_token=create_access_token(user.user_id),
        refresh_token=create_refresh_token(user.user_id),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise ValueError("not a refresh token")
        user_id = int(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if db.get(AppUser, user_id) is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return TokenOut(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.get("/me", response_model=MeOut)
def me(user: AppUser = Depends(get_current_user)):
    return user


@router.post("/2fa/setup", response_model=TwoFASetupOut)
def twofa_setup(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a TOTP secret. 2FA is not enforced until verified via /2fa/enable."""
    secret = generate_totp_secret()
    user.twofa_secret = secret
    db.commit()
    return TwoFASetupOut(secret=secret, otpauth_uri=totp_provisioning_uri(secret, user.email))


@router.post("/2fa/enable", response_model=MeOut)
def twofa_enable(
    payload: TwoFAVerifyIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.twofa_secret:
        raise HTTPException(status_code=400, detail="Run /auth/2fa/setup first")
    if not verify_totp(user.twofa_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
    user.twofa_enabled = True
    db.commit()
    db.refresh(user)
    return user


@router.post("/2fa/disable", response_model=MeOut)
def twofa_disable(
    payload: TwoFAVerifyIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.twofa_enabled and not verify_totp(user.twofa_secret or "", payload.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
    user.twofa_enabled = False
    user.twofa_secret = None
    db.commit()
    db.refresh(user)
    return user
