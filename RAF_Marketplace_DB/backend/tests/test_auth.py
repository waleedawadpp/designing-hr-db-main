"""Auth, 2FA, and RBAC tests."""

from __future__ import annotations

import pyotp


def _register(client, email, password="supersecret1"):
    return client.post("/auth/register", json={
        "full_name": "Test User", "email": email, "password": password,
    })


def _login(client, email, password="supersecret1", totp=None):
    data = {"username": email, "password": password}
    if totp is not None:
        data["client_secret"] = totp
    return client.post("/auth/login", data=data)


def test_register_then_login(client):
    r = _register(client, "alice@example.com")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "alice@example.com"
    assert body["twofa_enabled"] is False

    r = _login(client, "alice@example.com")
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"] and tokens["refresh_token"]


def test_duplicate_registration_conflicts(client):
    _register(client, "dup@example.com")
    r = _register(client, "dup@example.com")
    assert r.status_code == 409


def test_login_wrong_password(client):
    _register(client, "bob@example.com")
    r = _login(client, "bob@example.com", password="wrongpassword")
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401

    _register(client, "carol@example.com")
    token = _login(client, "carol@example.com").json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "carol@example.com"


def test_refresh_token_flow(client):
    _register(client, "dan@example.com")
    refresh = _login(client, "dan@example.com").json()["refresh_token"]
    r = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert r.json()["access_token"]

    # An access token must NOT be usable as a refresh token.
    access = _login(client, "dan@example.com").json()["access_token"]
    assert client.post("/auth/refresh", json={"refresh_token": access}).status_code == 401


def test_two_factor_enable_and_enforced(client):
    _register(client, "eve@example.com")
    token = _login(client, "eve@example.com").json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    setup = client.post("/auth/2fa/setup", headers=auth).json()
    secret = setup["secret"]
    assert setup["otpauth_uri"].startswith("otpauth://")

    code = pyotp.TOTP(secret).now()
    r = client.post("/auth/2fa/enable", headers=auth, json={"code": code})
    assert r.status_code == 200 and r.json()["twofa_enabled"] is True

    # Login without a code is now rejected...
    assert _login(client, "eve@example.com").status_code == 401
    # ...and accepted with a valid code.
    good = pyotp.TOTP(secret).now()
    assert _login(client, "eve@example.com", totp=good).status_code == 200


def test_rbac_blocks_and_allows_product_create(client, db):
    from orm import AppUser, Role, UserRole

    # Plain customer is forbidden.
    _register(client, "frank@example.com")
    cust_token = _login(client, "frank@example.com").json()["access_token"]
    payload = {"vendor_id": 1, "name_ar": "س", "name_en": "X",
               "slug": "x-prod", "base_price": "1.000"}
    r = client.post("/products", json=payload,
                    headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 403

    # Grant vendor_owner (has product.create) to a new user.
    _register(client, "store@example.com")
    user = db.query(AppUser).filter_by(email="store@example.com").one()
    vowner = db.query(Role).filter_by(role_key="vendor_owner").one()
    db.add(UserRole(user_id=user.user_id, role_id=vowner.role_id))
    db.commit()

    owner_token = _login(client, "store@example.com").json()["access_token"]
    r = client.post("/products", json=payload,
                    headers={"Authorization": f"Bearer {owner_token}"})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "draft"
