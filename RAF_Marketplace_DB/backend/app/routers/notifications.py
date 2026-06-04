"""Notification inbox and push-device registration (authenticated)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import (
    DeviceTokenIn, DeviceTokenOut, NotificationOut, UnreadCount,
)
from orm import AppUser, DeviceToken, Notification

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    unread_only: bool = False,
):
    stmt = select(Notification).where(Notification.user_id == user.user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return db.scalars(stmt.order_by(Notification.sent_at.desc())).all()


@router.get("/notifications/unread-count", response_model=UnreadCount)
def unread_count(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == user.user_id, Notification.is_read.is_(False))
    )
    return UnreadCount(unread=n or 0)


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.get(Notification, notification_id)
    if notif is None or notif.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/notifications/read-all", response_model=UnreadCount)
def mark_all_read(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return UnreadCount(unread=0)


@router.post("/devices", response_model=DeviceTokenOut, status_code=201)
def register_device(
    payload: DeviceTokenIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.platform not in ("android", "ios", "web"):
        raise HTTPException(status_code=422, detail="platform must be android, ios or web")
    # Tokens are globally unique; re-registering re-points it at this user.
    existing = db.scalar(select(DeviceToken).where(DeviceToken.token == payload.token))
    if existing is not None:
        existing.user_id = user.user_id
        existing.platform = payload.platform
        db.commit()
        db.refresh(existing)
        return existing
    device = DeviceToken(user_id=user.user_id, token=payload.token, platform=payload.platform)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.delete("/devices/{token}", status_code=204)
def unregister_device(
    token: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = db.scalar(
        select(DeviceToken).where(DeviceToken.token == token, DeviceToken.user_id == user.user_id)
    )
    if device is not None:
        db.delete(device)
        db.commit()
