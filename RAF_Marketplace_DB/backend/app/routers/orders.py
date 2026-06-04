"""Checkout, order retrieval, and payment confirmation.

Checkout turns the user's cart into a multi-vendor order: it snapshots prices,
computes per-line platform commission, reserves inventory, and opens a pending
payment. Confirming the payment deducts stock and credits each vendor's wallet
(net of commission) with a ledger entry.
"""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import get_current_user
from app.schemas import CheckoutIn, OrderOut, OrderWithPayment, PaymentOut
from app.services.coupons import apply_coupon
from app.services.notifications import notify
from orm import (
    AppUser, Cart, CartItem, CustomerOrder, Inventory, OrderItem, OrderStatus,
    Payment, PaymentGateway, PaymentStatus, Product, ProductVariant, Vendor,
    VendorWallet, WalletTransaction,
)

router = APIRouter(prefix="/orders", tags=["orders"])

_CENTS = Decimal("0.001")  # OMR has 3 decimal places


def _commission(line_total: Decimal, rate: Decimal) -> Decimal:
    return (line_total * rate / Decimal(100)).quantize(_CENTS, rounding=ROUND_HALF_UP)


@router.post("/checkout", response_model=OrderWithPayment, status_code=201)
def checkout(
    payload: CheckoutIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        gateway = PaymentGateway(payload.gateway)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Unknown gateway: {payload.gateway}")

    cart = db.scalar(select(Cart).where(Cart.user_id == user.user_id))
    rows = []
    if cart is not None:
        rows = db.execute(
            select(CartItem, ProductVariant, Product, Vendor, Inventory)
            .join(ProductVariant, ProductVariant.variant_id == CartItem.variant_id)
            .join(Product, Product.product_id == ProductVariant.product_id)
            .join(Vendor, Vendor.vendor_id == Product.vendor_id)
            .join(Inventory, Inventory.variant_id == ProductVariant.variant_id)
            .where(CartItem.cart_id == cart.cart_id)
        ).all()
    if not rows:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order = CustomerOrder(
        order_number="PENDING",
        user_id=user.user_id,
        status=OrderStatus.pending,
        shipping_address_id=payload.shipping_address_id,
    )
    db.add(order)
    db.flush()  # assign order_id
    order.order_number = f"RAF-{dt.datetime.now(dt.timezone.utc):%Y}-{order.order_id:06d}"

    subtotal = Decimal("0")
    for ci, variant, product, vendor, inv in rows:
        if inv.quantity - inv.reserved < ci.quantity:
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient stock for SKU {variant.sku}",
            )
        line_total = variant.price * ci.quantity
        commission = _commission(line_total, vendor.commission_rate)
        inv.reserved += ci.quantity  # hold stock until payment confirms
        subtotal += line_total
        db.add(OrderItem(
            order_id=order.order_id,
            variant_id=variant.variant_id,
            vendor_id=vendor.vendor_id,
            product_name=product.name_en,
            sku=variant.sku,
            unit_price=variant.price,
            quantity=ci.quantity,
            line_total=line_total,
            commission_rate=vendor.commission_rate,
            commission_amount=commission,
        ))

    order.subtotal = subtotal

    discount = Decimal("0")
    if payload.coupon_code:
        vendor_subtotals: dict[int, Decimal] = {}
        for _ci, variant, _product, vendor, _inv in rows:
            vendor_subtotals[vendor.vendor_id] = (
                vendor_subtotals.get(vendor.vendor_id, Decimal("0")) + variant.price * _ci.quantity
            )
        discount, coupon = apply_coupon(db, payload.coupon_code, subtotal, vendor_subtotals)
        coupon.used_count += 1
    order.discount_total = discount
    order.grand_total = subtotal - discount  # + shipping/tax (0 for now)

    payment = Payment(
        order_id=order.order_id, gateway=gateway,
        status=PaymentStatus.pending, amount=order.grand_total,
    )
    db.add(payment)

    # Empty the cart.
    for ci, *_ in rows:
        db.delete(ci)

    db.commit()
    db.refresh(order)
    db.refresh(payment)
    out = OrderWithPayment.model_validate(order)
    out.payment = PaymentOut.model_validate(payment)
    return out


@router.post("/{order_id}/pay/confirm", response_model=OrderWithPayment)
def confirm_payment(
    order_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulate a successful gateway callback (idempotent on already-paid orders)."""
    order = db.scalar(
        select(CustomerOrder)
        .options(selectinload(CustomerOrder.items))
        .where(CustomerOrder.order_id == order_id)
    )
    if order is None or order.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = db.scalar(select(Payment).where(Payment.order_id == order_id))
    if payment is None:
        raise HTTPException(status_code=400, detail="No payment for this order")
    if payment.status == PaymentStatus.paid:
        out = OrderWithPayment.model_validate(order)
        out.payment = PaymentOut.model_validate(payment)
        return out

    payment.status = PaymentStatus.paid
    payment.paid_at = dt.datetime.now(dt.timezone.utc)
    order.status = OrderStatus.confirmed
    notify(
        db, order.user_id,
        title_ar="تم تأكيد طلبك", title_en="Your order is confirmed",
        body_ar=f"تم تأكيد الطلب {order.order_number}.",
        body_en=f"Order {order.order_number} has been confirmed.",
        payload={"order_id": order.order_id},
    )

    for item in order.items:
        inv = db.get(Inventory, item.variant_id)
        if inv is not None:
            inv.quantity -= item.quantity
            inv.reserved = max(0, inv.reserved - item.quantity)

        # Credit the vendor's wallet, net of commission.
        net = item.line_total - item.commission_amount
        wallet = db.get(VendorWallet, item.vendor_id)
        if wallet is None:
            wallet = VendorWallet(vendor_id=item.vendor_id)
            db.add(wallet)
            db.flush()
        wallet.available_balance += net
        db.add(WalletTransaction(
            vendor_id=item.vendor_id, order_item_id=item.order_item_id,
            direction="credit", amount=net,
            description=f"Sale {order.order_number} ({item.sku})",
        ))

    db.commit()
    db.refresh(order)
    db.refresh(payment)
    out = OrderWithPayment.model_validate(order)
    out.payment = PaymentOut.model_validate(payment)
    return out


@router.get("", response_model=list[OrderOut])
def my_orders(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.scalars(
        select(CustomerOrder)
        .options(selectinload(CustomerOrder.items))
        .where(CustomerOrder.user_id == user.user_id)
        .order_by(CustomerOrder.placed_at.desc())
    ).all()
    return orders


@router.get("/{order_id}", response_model=OrderWithPayment)
def get_order(
    order_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(CustomerOrder)
        .options(selectinload(CustomerOrder.items))
        .where(CustomerOrder.order_id == order_id)
    )
    if order is None or order.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Order not found")
    payment = db.scalar(select(Payment).where(Payment.order_id == order_id))
    out = OrderWithPayment.model_validate(order)
    out.payment = PaymentOut.model_validate(payment) if payment else None
    return out
