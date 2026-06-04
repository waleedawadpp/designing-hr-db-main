"""Shipping & tracking: vendors create shipments and post tracking events;
order owners follow the delivery timeline.

Order status is kept in step with its shipments: any shipment in transit moves
the order to `shipped`; once every shipment is delivered the order becomes
`delivered`.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import (
    ShipmentCreateIn, ShipmentDetail, ShipmentEventIn, ShipmentEventOut, ShipmentOut,
)
from app.services.notifications import notify
from orm import (
    AppUser, CarrierCode, CustomerOrder, OrderItem, OrderStatus, Shipment,
    ShipmentEvent, ShipmentStatus,
)

router = APIRouter(tags=["shipping"])

# Statuses that count as "on the way" for order-level roll-up.
_IN_TRANSIT = {
    ShipmentStatus.picked_up, ShipmentStatus.in_transit, ShipmentStatus.out_for_delivery,
}


def _order_or_404(db: Session, order_id: int) -> CustomerOrder:
    order = db.get(CustomerOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _roll_up_order_status(db: Session, order: CustomerOrder) -> None:
    shipments = db.scalars(
        select(Shipment).where(Shipment.order_id == order.order_id)
    ).all()
    if not shipments:
        return
    if all(s.status == ShipmentStatus.delivered for s in shipments):
        order.status = OrderStatus.delivered
    elif any(s.status in _IN_TRANSIT or s.status == ShipmentStatus.delivered for s in shipments):
        order.status = OrderStatus.shipped


@router.post("/orders/{order_id}/shipments", response_model=ShipmentOut, status_code=201)
def create_shipment(
    order_id: int,
    payload: ShipmentCreateIn,
    db: Session = Depends(get_db),
    _user: AppUser = Depends(require_permission("order.manage")),
):
    order = _order_or_404(db, order_id)
    try:
        carrier = CarrierCode(payload.carrier)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Unknown carrier: {payload.carrier}")

    has_items = db.scalar(
        select(OrderItem.order_item_id).where(
            OrderItem.order_id == order_id, OrderItem.vendor_id == payload.vendor_id
        )
    )
    if not has_items:
        raise HTTPException(status_code=400, detail="Order has no items for this vendor")

    shipment = Shipment(
        order_id=order_id, vendor_id=payload.vendor_id, carrier=carrier,
        tracking_number=payload.tracking_number, status=ShipmentStatus.pending,
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.post("/shipments/{shipment_id}/events", response_model=ShipmentDetail, status_code=201)
def add_tracking_event(
    shipment_id: int,
    payload: ShipmentEventIn,
    db: Session = Depends(get_db),
    _user: AppUser = Depends(require_permission("order.manage")),
):
    shipment = db.get(Shipment, shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment not found")
    try:
        status = ShipmentStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Unknown status: {payload.status}")

    now = dt.datetime.now(dt.timezone.utc)
    db.add(ShipmentEvent(
        shipment_id=shipment_id, status=status, location=payload.location, note=payload.note,
    ))
    shipment.status = status
    if status in _IN_TRANSIT and shipment.shipped_at is None:
        shipment.shipped_at = now
    if status == ShipmentStatus.delivered:
        shipment.delivered_at = now

    order = _order_or_404(db, shipment.order_id)
    _roll_up_order_status(db, order)
    if status == ShipmentStatus.delivered:
        notify(
            db, order.user_id,
            title_ar="تم تسليم شحنتك", title_en="Your shipment was delivered",
            body_ar=f"تم تسليم شحنة الطلب {order.order_number}.",
            body_en=f"Shipment for order {order.order_number} was delivered.",
            payload={"order_id": order.order_id, "shipment_id": shipment.shipment_id},
        )
    db.commit()

    shipment = db.scalar(
        select(Shipment).options(selectinload(Shipment.events))
        .where(Shipment.shipment_id == shipment_id)
    )
    return shipment


@router.get("/shipments/{shipment_id}", response_model=ShipmentDetail)
def get_shipment(
    shipment_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shipment = db.scalar(
        select(Shipment).options(selectinload(Shipment.events))
        .where(Shipment.shipment_id == shipment_id)
    )
    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment not found")
    # Only the order owner may view (fulfilment staff use their own dashboards).
    order = db.get(CustomerOrder, shipment.order_id)
    if order is None or order.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment


@router.get("/orders/{order_id}/shipments", response_model=list[ShipmentDetail])
def list_order_shipments(
    order_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = _order_or_404(db, order_id)
    if order.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Order not found")
    return db.scalars(
        select(Shipment).options(selectinload(Shipment.events))
        .where(Shipment.order_id == order_id)
        .order_by(Shipment.created_at)
    ).all()
