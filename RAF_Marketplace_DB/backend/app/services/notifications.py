"""Helper for emitting in-app/multi-channel notifications.

Callers add the notification within their own transaction (no commit here).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from orm import Notification, NotificationChannel


def notify(
    db: Session,
    user_id: int,
    *,
    title_ar: str,
    title_en: str,
    body_ar: str | None = None,
    body_en: str | None = None,
    channel: NotificationChannel = NotificationChannel.in_app,
    payload: dict | None = None,
) -> None:
    db.add(Notification(
        user_id=user_id, channel=channel,
        title_ar=title_ar, title_en=title_en,
        body_ar=body_ar, body_en=body_en, payload=payload,
    ))
