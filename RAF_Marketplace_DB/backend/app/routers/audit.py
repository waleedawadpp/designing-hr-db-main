"""Admin audit log viewer (requires `reports.platform`)."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_permission
from orm import ActivityLog, AppUser

router = APIRouter(tags=["audit"])


class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: int
    user_id: int | None = None
    action: str
    created_at: dt.datetime


@router.get("/admin/activity", response_model=list[ActivityLogOut])
def activity_log(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("reports.platform")),
    limit: int = Query(50, ge=1, le=200),
):
    return db.scalars(
        select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
    ).all()
