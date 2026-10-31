from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, ACCESS_TOKEN_MINUTES
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.core.security import verify_password
from app.models.booking import Booking
from app.models.audit_log import BookingAuditLog
from app.schemas.admin import AdminLogin, AdminToken, BookingStatusUpdate
from app.schemas.booking import BookingResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/login", response_model=AdminToken)
def admin_login(payload: AdminLogin):
    if not settings.admin_password_hash or not settings.secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured.",
        )

    username_valid = payload.username == settings.admin_username
    password_valid = verify_password(
        payload.password,
        settings.admin_password_hash,
    )

    if not username_valid or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    token = create_access_token(payload.username)

    return AdminToken(
        access_token=token,
        expires_in=ACCESS_TOKEN_MINUTES * 60,
    )


@router.get("/bookings", response_model=list[BookingResponse])
def list_bookings(
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=24),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(Booking)

    if status_filter:
        if status_filter not in {"Pending", "Confirmed", "Rejected"}:
            raise HTTPException(status_code=400, detail="Invalid booking status.")
        query = query.where(Booking.status == status_filter)

    if search:
        query = query.where(Booking.booking_id == search.strip())

    query = query.order_by(Booking.created_at.desc()).limit(limit).offset(offset)
    return db.scalars(query).all()


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: str,
    admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(Booking).where(Booking.booking_id == booking_id)
    )
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking


@router.patch("/bookings/{booking_id}", response_model=BookingResponse)
def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(Booking).where(Booking.booking_id == booking_id)
    )
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")

    old_status = booking.status
    booking.status = payload.status
    booking.admin_note = payload.admin_note

    try:
        if old_status != payload.status:
            db.add(BookingAuditLog(
                booking_id=booking.booking_id,
                old_status=old_status,
                new_status=payload.status,
                changed_by=admin,
                admin_note=payload.admin_note,
            ))
        db.commit()
        db.refresh(booking)
        return booking
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Booking update failed. Please try again.",
        )



@router.get("/bookings/{booking_id}/history")
def get_booking_history(
    booking_id: str,
    admin: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(Booking).where(Booking.booking_id == booking_id)
    )
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")

    logs = db.scalars(
        select(BookingAuditLog)
        .where(BookingAuditLog.booking_id == booking_id)
        .order_by(BookingAuditLog.created_at.desc())
    ).all()

    return [
        {
            "old_status": log.old_status,
            "new_status": log.new_status,
            "changed_by": log.changed_by,
            "admin_note": log.admin_note,
            "created_at": log.created_at,
        }
        for log in logs
    ]
