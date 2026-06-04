"""Returns & refunds.

A buyer requests a return for items they purchased; staff (`order.manage`)
approve, reject, or complete it. Completing a return issues a `refund` for the
returned line value, **debits** the vendor's wallet net of commission, restocks
inventory, and rolls the payment/order status to (partially) refunded.
"""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import ReturnCreateIn, ReturnOut, ReturnResolved, RefundOut
from orm import (
    AppUser, CustomerOrder, Inventory, OrderItem, OrderStatus, Payment,
    PaymentStatus, Refund, ReturnRequest, ReturnStatus, VendorWallet,
    WalletTransaction,
)

router = APIRouter(prefix="/returns", tags=["returns"])

_CENTS = Decimal("0.001")
_ELIGIBLE_ORDER = {OrderStatus.confirmed, OrderStatus.shipped, OrderStatus.delivered}
_ACTIVE_RETURNS = (
    ReturnStatus.requested, ReturnStatus.approved,
    ReturnStatus.received, ReturnStatus.completed,
)


def _owned_return(db: Session, return_id: int, require_staff: bool) -> ReturnRequest:
    ret = db.get(ReturnRequest, return_id)
    if ret is None:
        raise HTTPException(status_code=404, detail="Return not found")
    return ret


@router.post("", response_model=ReturnOut, status_code=201)
def request_return(
    payload: ReturnCreateIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(OrderItem, payload.order_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Order item not found")
    order = db.get(CustomerOrder, item.order_id)
    if order is None or order.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Order item not found")
    if order.status not in _ELIGIBLE_ORDER:
        raise HTTPException(status_code=400, detail="Order is not eligible for returns")

    already = db.scalar(
        select(func.coalesce(func.sum(ReturnRequest.quantity), 0))
        .where(ReturnRequest.order_item_id == item.order_item_id,
               ReturnRequest.status.in_(_ACTIVE_RETURNS))
    )
    if already + payload.quantity > item.quantity:
        raise HTTPException(status_code=400, detail="Return quantity exceeds purchased quantity")

    ret = ReturnRequest(
        order_item_id=item.order_item_id, user_id=user.user_id,
        quantity=payload.quantity, reason=payload.reason, status=ReturnStatus.requested,
    )
    db.add(ret)
    db.commit()
    db.refresh(ret)
    return ret


@router.get("", response_model=list[ReturnOut])
def my_returns(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(ReturnRequest)
        .where(ReturnRequest.user_id == user.user_id)
        .order_by(ReturnRequest.created_at.desc())
    ).all()


@router.post("/{return_id}/approve", response_model=ReturnOut)
def approve_return(
    return_id: int,
    db: Session = Depends(get_db),
    _staff: AppUser = Depends(require_permission("order.manage")),
):
    ret = _owned_return(db, return_id, require_staff=True)
    if ret.status != ReturnStatus.requested:
        raise HTTPException(status_code=409, detail=f"Return is already {ret.status.value}")
    ret.status = ReturnStatus.approved
    db.commit()
    db.refresh(ret)
    return ret


@router.post("/{return_id}/reject", response_model=ReturnOut)
def reject_return(
    return_id: int,
    db: Session = Depends(get_db),
    _staff: AppUser = Depends(require_permission("order.manage")),
):
    ret = _owned_return(db, return_id, require_staff=True)
    if ret.status in (ReturnStatus.completed, ReturnStatus.rejected):
        raise HTTPException(status_code=409, detail=f"Return is already {ret.status.value}")
    ret.status = ReturnStatus.rejected
    ret.resolved_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(ret)
    return ret


@router.post("/{return_id}/complete", response_model=ReturnResolved)
def complete_return(
    return_id: int,
    db: Session = Depends(get_db),
    _staff: AppUser = Depends(require_permission("order.manage")),
):
    ret = _owned_return(db, return_id, require_staff=True)
    if ret.status not in (ReturnStatus.approved, ReturnStatus.received):
        raise HTTPException(status_code=409, detail="Return must be approved before completion")

    item = db.get(OrderItem, ret.order_item_id)
    order = db.get(CustomerOrder, item.order_id)
    payment = db.scalar(select(Payment).where(Payment.order_id == order.order_id))
    if payment is None or payment.status not in (PaymentStatus.paid, PaymentStatus.partially_refunded):
        raise HTTPException(status_code=400, detail="Order payment is not refundable")

    refund_amount = (item.unit_price * ret.quantity).quantize(_CENTS, rounding=ROUND_HALF_UP)
    commission_portion = (refund_amount * item.commission_rate / Decimal(100)).quantize(
        _CENTS, rounding=ROUND_HALF_UP)
    vendor_debit = refund_amount - commission_portion

    # Total already refunded on this order *before* this refund.
    prior_refunded = db.scalar(
        select(func.coalesce(func.sum(Refund.amount), 0))
        .join(Payment, Payment.payment_id == Refund.payment_id)
        .where(Payment.order_id == order.order_id)
    )

    refund = Refund(
        payment_id=payment.payment_id, return_id=ret.return_id,
        amount=refund_amount, reason=ret.reason,
    )
    db.add(refund)

    # Restock the returned units.
    inv = db.get(Inventory, item.variant_id)
    if inv is not None:
        inv.quantity += ret.quantity

    # Debit the vendor's wallet (reverse the net sale proceeds).
    wallet = db.get(VendorWallet, item.vendor_id)
    if wallet is None:
        wallet = VendorWallet(vendor_id=item.vendor_id)
        db.add(wallet)
        db.flush()
    wallet.available_balance -= vendor_debit
    db.add(WalletTransaction(
        vendor_id=item.vendor_id, order_item_id=item.order_item_id,
        direction="debit", amount=vendor_debit,
        description=f"Refund {order.order_number} ({item.sku})",
    ))

    ret.status = ReturnStatus.completed
    ret.resolved_at = dt.datetime.now(dt.timezone.utc)

    # Roll payment/order status forward based on total refunded so far.
    refunded_total = prior_refunded + refund_amount
    if refunded_total >= payment.amount:
        payment.status = PaymentStatus.refunded
        order.status = OrderStatus.refunded
    else:
        payment.status = PaymentStatus.partially_refunded

    db.commit()
    db.refresh(ret)
    db.refresh(refund)
    out = ReturnResolved.model_validate(ret)
    out.refund = RefundOut.model_validate(refund)
    return out
