"""Vendor payouts (withdrawals).

A vendor requests a withdrawal up to their available wallet balance; the amount
is held immediately (balance debited + ledger entry). An admin (`payout.process`)
marks it paid, or rejects it — which refunds the held amount to the wallet.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import PayoutCreateIn, PayoutOut
from app.services.access import assert_vendor_access
from app.services.notifications import notify
from orm import AppUser, Payout, PayoutStatus, Vendor, VendorWallet, WalletTransaction

router = APIRouter(tags=["payouts"])


@router.post("/vendors/{vendor_id}/payouts", response_model=PayoutOut, status_code=201)
def request_payout(
    vendor_id: int,
    payload: PayoutCreateIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assert_vendor_access(db, user, vendor_id, admin_perm="payout.process")
    wallet = db.get(VendorWallet, vendor_id)
    if wallet is None or wallet.available_balance < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient available balance")

    wallet.available_balance -= payload.amount  # hold the funds
    payout = Payout(
        vendor_id=vendor_id, amount=payload.amount, bank_iban=payload.bank_iban,
        status=PayoutStatus.requested,
    )
    db.add(payout)
    db.flush()
    db.add(WalletTransaction(
        vendor_id=vendor_id, payout_id=payout.payout_id, direction="debit",
        amount=payload.amount, description=f"Payout request #{payout.payout_id}",
    ))
    db.commit()
    db.refresh(payout)
    return payout


@router.get("/vendors/{vendor_id}/payouts", response_model=list[PayoutOut])
def list_vendor_payouts(
    vendor_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assert_vendor_access(db, user, vendor_id, admin_perm="payout.process")
    return db.scalars(
        select(Payout).where(Payout.vendor_id == vendor_id).order_by(Payout.requested_at.desc())
    ).all()


@router.get("/admin/payouts", response_model=list[PayoutOut])
def payout_queue(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("payout.process")),
    status: PayoutStatus = PayoutStatus.requested,
):
    return db.scalars(
        select(Payout).where(Payout.status == status).order_by(Payout.requested_at)
    ).all()


def _requested_payout(db: Session, payout_id: int) -> Payout:
    payout = db.get(Payout, payout_id)
    if payout is None:
        raise HTTPException(status_code=404, detail="Payout not found")
    if payout.status != PayoutStatus.requested:
        raise HTTPException(status_code=409, detail="Only requested payouts can be processed")
    return payout


@router.post("/payouts/{payout_id}/approve", response_model=PayoutOut)
def approve_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(require_permission("payout.process")),
):
    payout = _requested_payout(db, payout_id)
    payout.status = PayoutStatus.paid
    payout.processed_by = admin.user_id
    payout.processed_at = dt.datetime.now(dt.timezone.utc)
    notify(
        db, db.get(Vendor, payout.vendor_id).owner_user_id,
        title_ar="تم صرف طلب السحب", title_en="Your payout was processed",
        body_ar=f"تم صرف مبلغ {payout.amount} {payout.currency}.",
        body_en=f"Your payout of {payout.amount} {payout.currency} has been paid.",
        payload={"payout_id": payout_id},
    )
    db.commit()
    db.refresh(payout)
    return payout


@router.post("/payouts/{payout_id}/reject", response_model=PayoutOut)
def reject_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(require_permission("payout.process")),
):
    payout = _requested_payout(db, payout_id)
    payout.status = PayoutStatus.rejected
    payout.processed_by = admin.user_id
    payout.processed_at = dt.datetime.now(dt.timezone.utc)

    # Return the held funds to the wallet.
    wallet = db.get(VendorWallet, payout.vendor_id)
    if wallet is not None:
        wallet.available_balance += payout.amount
    db.add(WalletTransaction(
        vendor_id=payout.vendor_id, payout_id=payout.payout_id, direction="credit",
        amount=payout.amount, description=f"Payout #{payout.payout_id} rejected — refunded",
    ))
    db.commit()
    db.refresh(payout)
    return payout
