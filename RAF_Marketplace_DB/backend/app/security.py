"""Security primitives: password hashing, JWT tokens, and TOTP (2FA)."""

from __future__ import annotations

import datetime as dt
import uuid

import bcrypt
import jwt
import pyotp

from app.config import settings


# ---- password hashing (bcrypt) -------------------------------------------- #
def hash_password(plain: str) -> str:
    # bcrypt operates on <=72 bytes; encode and hash.
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---- JWT ------------------------------------------------------------------- #
def _encode(claims: dict, ttl: dt.timedelta, token_type: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        **claims,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id)},
        dt.timedelta(minutes=settings.access_token_ttl_minutes),
        "access",
    )


def create_refresh_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id)},
        dt.timedelta(days=settings.refresh_token_ttl_days),
        "refresh",
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# ---- TOTP (two-factor authentication) ------------------------------------- #
def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, account_email: str) -> str:
    """otpauth:// URI to render as a QR code in an authenticator app."""
    return pyotp.TOTP(secret).provisioning_uri(name=account_email, issuer_name=settings.totp_issuer)


def verify_totp(secret: str, code: str) -> bool:
    # valid_window=1 tolerates clock drift of one 30s step.
    return pyotp.TOTP(secret).verify(code, valid_window=1)
