from datetime import date, time, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.booking import BookingCreate


def valid_booking():
    future_date = date.today() + timedelta(days=2)
    return {
        "customer_name": "Mohammed",
        "customer_phone": "+919876543210",
        "service": "Airport Transfer",
        "pickup": "Mapusa",
        "destination": "Dabolim Airport",
        "travel_date": future_date,
        "travel_time": time(10, 30),
        "trip_type": "One-way",
        "vehicle": "Maruti Ertiga",
        "passengers": 4,
    }


def test_valid_booking_is_accepted():
    booking = BookingCreate(**valid_booking())
    assert booking.customer_name == "Mohammed"
    assert booking.passengers == 4


def test_same_pickup_and_destination_is_rejected():
    data = valid_booking()
    data["destination"] = data["pickup"]

    with pytest.raises(ValidationError):
        BookingCreate(**data)


def test_invalid_passenger_count_is_rejected():
    data = valid_booking()
    data["passengers"] = 8

    with pytest.raises(ValidationError):
        BookingCreate(**data)


def test_invalid_service_is_rejected():
    data = valid_booking()
    data["service"] = "Unknown Service"

    with pytest.raises(ValidationError):
        BookingCreate(**data)


def test_invalid_phone_is_rejected():
    data = valid_booking()
    data["customer_phone"] = "abc123"

    with pytest.raises(ValidationError):
        BookingCreate(**data)
