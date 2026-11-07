"""Marketing campaigns, including AI-generated copy (`marketing.manage`)."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_permission
from app.schemas import CampaignCreateIn, CampaignGenIn, CampaignOut
from app.services.ai import get_ai_provider
from orm import (
    AIJob, AIJobStatus, AIJobType, AppUser, CampaignChannel, MarketingCampaign,
)

router = APIRouter(prefix="/campaigns", tags=["marketing"])


def _validate_channel(value: str) -> CampaignChannel:
    try:
        return CampaignChannel(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Unknown channel: {value}")


@router.post("/generate", response_model=CampaignOut, status_code=201)
def generate_campaign(
    payload: CampaignGenIn,
    db: Session = Depends(get_db),
    user: AppUser = Depends(require_permission("marketing.manage")),
):
    _validate_channel(payload.channel)
    provider = get_ai_provider()
    content = provider.generate_campaign(channel=payload.channel, topic=payload.topic)

    db.add(AIJob(
        job_type=AIJobType.marketing, status=AIJobStatus.succeeded,
        requested_by=user.user_id, vendor_id=payload.vendor_id,
        input=payload.model_dump(), output=content,
        model=getattr(provider, "model", None),
        completed_at=dt.datetime.now(dt.timezone.utc),
    ))
    campaign = MarketingCampaign(
        vendor_id=payload.vendor_id, name=content["name"], channel=payload.channel,
        content_ar=content["content_ar"], content_en=content["content_en"],
        is_ai_generated=True, created_by=user.user_id,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("", response_model=CampaignOut, status_code=201)
def create_campaign(
    payload: CampaignCreateIn,
    db: Session = Depends(get_db),
    user: AppUser = Depends(require_permission("marketing.manage")),
):
    _validate_channel(payload.channel)
    campaign = MarketingCampaign(
        vendor_id=payload.vendor_id, name=payload.name, channel=payload.channel,
        content_ar=payload.content_ar, content_en=payload.content_en,
        is_ai_generated=False, created_by=user.user_id,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    db: Session = Depends(get_db),
    _user: AppUser = Depends(require_permission("marketing.manage")),
    vendor_id: int | None = None,
):
    stmt = select(MarketingCampaign)
    if vendor_id is not None:
        stmt = stmt.where(MarketingCampaign.vendor_id == vendor_id)
    return db.scalars(stmt.order_by(MarketingCampaign.created_at.desc())).all()


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    _user: AppUser = Depends(require_permission("marketing.manage")),
):
    campaign = db.get(MarketingCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
