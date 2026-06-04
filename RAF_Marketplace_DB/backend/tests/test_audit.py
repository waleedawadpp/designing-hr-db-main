"""Audit log: mutating requests are recorded and visible to admins."""

from __future__ import annotations


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "U", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _admin(client, db, email):
    from orm import AppUser, Role, UserRole
    h = _auth(client, email)
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key="admin").one()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.commit()
    return h


def test_mutating_requests_are_audited(client, db):
    # Registration + login above already produce POST requests.
    admin = _admin(client, db, "audit-admin@example.com")
    entries = client.get("/admin/activity", headers=admin).json()
    actions = {e["action"] for e in entries}
    assert any(a.startswith("POST /auth/register") for a in actions)
    assert any(a.startswith("POST /auth/login") for a in actions)


def test_activity_requires_permission(client):
    plain = _auth(client, "audit-plain@example.com")
    assert client.get("/admin/activity", headers=plain).status_code == 403
    assert client.get("/admin/activity").status_code == 401
