"""Customer address book (authenticated, owner-scoped)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import AddressIn, AddressOut
from orm import Address, AppUser

router = APIRouter(prefix="/addresses", tags=["addresses"])


def _clear_other_defaults(db: Session, user_id: int, keep_id: int | None = None) -> None:
    stmt = update(Address).where(Address.user_id == user_id, Address.is_default.is_(True))
    if keep_id is not None:
        stmt = stmt.where(Address.address_id != keep_id)
    db.execute(stmt.values(is_default=False))


def _owned(db: Session, address_id: int, user_id: int) -> Address:
    addr = db.get(Address, address_id)
    if addr is None or addr.user_id != user_id:
        raise HTTPException(status_code=404, detail="Address not found")
    return addr


@router.get("", response_model=list[AddressOut])
def list_addresses(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Address).where(Address.user_id == user.user_id)
        .order_by(Address.is_default.desc(), Address.created_at.desc())
    ).all()


@router.post("", response_model=AddressOut, status_code=201)
def create_address(
    payload: AddressIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    addr = Address(user_id=user.user_id, **payload.model_dump())
    db.add(addr)
    db.flush()
    if addr.is_default:
        _clear_other_defaults(db, user.user_id, keep_id=addr.address_id)
    db.commit()
    db.refresh(addr)
    return addr


@router.put("/{address_id}", response_model=AddressOut)
def update_address(
    address_id: int,
    payload: AddressIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    addr = _owned(db, address_id, user.user_id)
    for field, value in payload.model_dump().items():
        setattr(addr, field, value)
    db.flush()
    if addr.is_default:
        _clear_other_defaults(db, user.user_id, keep_id=addr.address_id)
    db.commit()
    db.refresh(addr)
    return addr


@router.delete("/{address_id}", status_code=204)
def delete_address(
    address_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    addr = _owned(db, address_id, user.user_id)
    db.delete(addr)
    db.commit()
