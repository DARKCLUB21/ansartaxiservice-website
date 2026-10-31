import re
from datetime import date, time, datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BookingCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=100)
    customer_phone: str = Field(min_length=8, max_length=20)

    service: str = Field(min_length=2, max_length=50)

    pickup: str = Field(min_length=2, max_length=200)
    destination: str = Field(min_length=2, max_length=200)

    pickup_place_id: str | None = Field(default=None, max_length=255)
    destination_place_id: str | None = Field(default=None, max_length=255)

    pickup_lat: float | None = Field(default=None, ge=-90, le=90)
    pickup_lng: float | None = Field(default=None, ge=-180, le=180)
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lng: float | None = Field(default=None, ge=-180, le=180)

    travel_date: date
    travel_time: time

    trip_type: str
    vehicle: str
    passengers: int = Field(ge=1, le=7)

    @field_validator("customer_name", "pickup", "destination")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("customer_phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"\+?[0-9 ()-]{8,20}", value):
            raise ValueError("Invalid phone number.")
        digits = re.sub(r"\D", "", value)
        if not 8 <= len(digits) <= 15:
            raise ValueError("Invalid phone number length.")
        return value

    @field_validator("service")
    @classmethod
    def validate_service(cls, value: str) -> str:
        allowed = {
            "Airport Transfer",
            "Local Taxi",
            "Goa Sightseeing",
            "Outstation Trip",
        }
        if value not in allowed:
            raise ValueError("Unsupported service.")
        return value

    @field_validator("trip_type")
    @classmethod
    def validate_trip_type(cls, value: str) -> str:
        if value not in {"One-way", "Round trip"}:
            raise ValueError("Invalid trip type.")
        return value

    @field_validator("vehicle")
    @classmethod
    def validate_vehicle(cls, value: str) -> str:
        allowed = {
            "4-seater",
            "Maruti Ertiga",
            "Toyota Innova",
            "Kia Carens",
            "Toyota Innova Crysta",
            "Toyota Innova Hycross",
        }
        if value not in allowed:
            raise ValueError("Unsupported vehicle.")
        return value

    @model_validator(mode="after")
    def validate_locations(self):
        if self.pickup.strip().casefold() == self.destination.strip().casefold():
            raise ValueError("Pickup and destination must be different.")

        if (self.pickup_lat is None) != (self.pickup_lng is None):
            raise ValueError("Pickup coordinates must be supplied together.")

        if (self.destination_lat is None) != (self.destination_lng is None):
            raise ValueError("Destination coordinates must be supplied together.")

        return self

    @model_validator(mode="after")
    def validate_travel_datetime(self):
        india_tz = ZoneInfo("Asia/Kolkata")
        requested = datetime.combine(self.travel_date, self.travel_time, tzinfo=india_tz)
        if requested < datetime.now(india_tz):
            raise ValueError("Travel date and time must be in the future.")
        return self


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    booking_id: str
    status: str
    customer_name: str
    pickup: str
    destination: str
    travel_date: date
    travel_time: time
    distance_km: float | None
    estimated_fare: float | None
