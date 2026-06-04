"""Vendor payouts: request (hold funds), approve, reject (refund), access."""

from __future__ import annotations

from decimal import Decimal


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


def _vendor_with_balance(client, db, email, balance):
    """A fresh approved vendor whose owner can manage it, with a known balance."""
    from orm import AppUser, Role, Vendor, VendorStaff, VendorStatus, VendorWallet
    h = _auth(client, email)
    user = db.query(AppUser).filter_by(email=email).one()
    vendor = Vendor(owner_user_id=user.user_id, store_name_ar="م", store_name_en="Payout Store",
                    slug=f"payout-{email}", status=VendorStatus.approved)
    db.add(vendor)
    db.flush()
    db.add(VendorWallet(vendor_id=vendor.vendor_id, available_balance=str(balance)))
    role = db.query(Role).filter_by(role_key="vendor_owner").one()
    db.add(VendorStaff(vendor_id=vendor.vendor_id, user_id=user.user_id, role_id=role.role_id))
    db.commit()
    return h, vendor.vendor_id


def _balance(db, vendor_id):
    from orm import VendorWallet
    db.expire_all()
    return db.get(VendorWallet, vendor_id).available_balance


def test_request_holds_funds_and_approve_pays(client, db):
    h, vid = _vendor_with_balance(client, db, "po-vendor@example.com", 100)
    admin = _admin(client, db, "po-admin@example.com")

    r = client.post(f"/vendors/{vid}/payouts", headers=h,
                    json={"amount": "30.000", "bank_iban": "OM12345"})
    assert r.status_code == 201, r.text
    pid = r.json()["payout_id"]
    assert r.json()["status"] == "requested"
    assert _balance(db, vid) == Decimal("70.000")  # held

    # In the admin queue, then paid.
    assert any(p["payout_id"] == pid for p in client.get("/admin/payouts", headers=admin).json())
    assert client.post(f"/payouts/{pid}/approve", headers=admin).json()["status"] == "paid"
    assert _balance(db, vid) == Decimal("70.000")  # stays held/paid

    # Re-processing is a conflict.
    assert client.post(f"/payouts/{pid}/approve", headers=admin).status_code == 409


def test_over_balance_rejected_and_reject_refunds(client, db):
    h, vid = _vendor_with_balance(client, db, "po-vendor2@example.com", 50)
    admin = _admin(client, db, "po-admin2@example.com")

    # Over available balance.
    assert client.post(f"/vendors/{vid}/payouts", headers=h,
                       json={"amount": "1000.000"}).status_code == 400

    pid = client.post(f"/vendors/{vid}/payouts", headers=h,
                      json={"amount": "20.000"}).json()["payout_id"]
    assert _balance(db, vid) == Decimal("30.000")

    # Rejecting refunds the held amount.
    assert client.post(f"/payouts/{pid}/reject", headers=admin).json()["status"] == "rejected"
    assert _balance(db, vid) == Decimal("50.000")


def test_payout_access_control(client, db):
    h, vid = _vendor_with_balance(client, db, "po-owner@example.com", 40)

    # An outsider cannot request a payout for this vendor.
    outsider = _auth(client, "po-outsider@example.com")
    assert client.post(f"/vendors/{vid}/payouts", headers=outsider,
                       json={"amount": "5.000"}).status_code == 403

    # The owner can request, but cannot approve (no payout.process).
    pid = client.post(f"/vendors/{vid}/payouts", headers=h,
                      json={"amount": "5.000"}).json()["payout_id"]
    assert client.post(f"/payouts/{pid}/approve", headers=h).status_code == 403
