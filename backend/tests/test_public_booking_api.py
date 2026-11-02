from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models.booking import Booking


@pytest.fixture
def public_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(
        bind=engine,
        expire_on_commit=False,
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as client:
            yield client, TestingSession
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_public_booking_saves_record_without_exposing_phone(public_client):
    client, TestingSession = public_client

    response = client.post("/api/bookings", json={
        "customer_name": "Test Customer",
        "customer_phone": "+919876543210",
        "service": "Airport Transfer",
        "pickup": "Mapusa",
        "destination": "Dabolim Airport",
        "travel_date": (date.today() + timedelta(days=2)).isoformat(),
        "travel_time": "10:30",
        "trip_type": "One-way",
        "vehicle": "Maruti Ertiga",
        "passengers": 4,
    })

    assert response.status_code == 201
    data = response.json()
    assert data["booking_id"].startswith("ANS-")
    assert "customer_phone" not in data

    with TestingSession() as db:
        saved = db.scalar(
            select(Booking).where(Booking.booking_id == data["booking_id"])
        )
        assert saved is not None
        assert saved.customer_phone == "+919876543210"
