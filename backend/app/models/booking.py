import uuid
from datetime import datetime, date, time, timezone

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    Time,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    __table_args__ = (
        CheckConstraint(
            "status IN ('Pending', 'Confirmed', 'Rejected')",
            name="valid_booking_status",
        ),
        CheckConstraint(
            "passengers >= 1 AND passengers <= 7",
            name="valid_passenger_count",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    booking_id: Mapped[str] = mapped_column(
        String(24),
        unique=True,
        index=True,
        default=lambda: f"ANS-{uuid.uuid4().hex[:12].upper()}",
    )

    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False)

    service: Mapped[str] = mapped_column(String(50), nullable=False)

    pickup: Mapped[str] = mapped_column(String(200), nullable=False)
    destination: Mapped[str] = mapped_column(String(200), nullable=False)

    pickup_place_id: Mapped[str | None] = mapped_column(String(255))
    destination_place_id: Mapped[str | None] = mapped_column(String(255))

    pickup_lat: Mapped[float | None] = mapped_column(Float)
    pickup_lng: Mapped[float | None] = mapped_column(Float)
    destination_lat: Mapped[float | None] = mapped_column(Float)
    destination_lng: Mapped[float | None] = mapped_column(Float)

    travel_date: Mapped[date] = mapped_column(Date, nullable=False)
    travel_time: Mapped[time] = mapped_column(Time, nullable=False)

    trip_type: Mapped[str] = mapped_column(String(20), nullable=False)
    vehicle: Mapped[str] = mapped_column(String(60), nullable=False)
    passengers: Mapped[int] = mapped_column(Integer, nullable=False)

    distance_km: Mapped[float | None] = mapped_column(Float)
    estimated_fare: Mapped[float | None] = mapped_column(Float)

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="Pending"
    )

    admin_note: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
