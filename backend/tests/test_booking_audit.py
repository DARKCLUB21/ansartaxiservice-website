from datetime import date, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.core.security import hash_password
from app.models.booking import Booking
from app.models.audit_log import BookingAuditLog


@pytest.fixture
def audit_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    settings.admin_username = "testadmin"
    settings.admin_password_hash = hash_password("TestPassword123!")
    settings.secret_key = "test-secret-key-for-local-testing-only-123456"

    with TestingSession() as db:
        booking = Booking(
            booking_id="ANS-AUDIT12345",
            customer_name="Audit Test",
            customer_phone="9876543210",
            service="Local Taxi",
            pickup="Mapusa",
            destination="Panaji",
            travel_date=date.today() + timedelta(days=2),
            travel_time=time(10, 0),
            trip_type="One-way",
            vehicle="4-seater",
            passengers=2,
            status="Pending",
        )
        db.add(booking)
        db.commit()

    with TestClient(app) as client:
        login = client.post(
            "/api/admin/login",
            json={
                "username": "testadmin",
                "password": "TestPassword123!",
            },
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        yield client, headers, TestingSession

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_status_update_creates_audit_history(audit_client):
    client, headers, TestingSession = audit_client

    response = client.patch(
        "/api/admin/bookings/ANS-AUDIT12345",
        headers=headers,
        json={"status": "Confirmed", "admin_note": "Verified"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Confirmed"

    with TestingSession() as db:
        logs = db.scalars(select(BookingAuditLog)).all()
        assert len(logs) == 1
        assert logs[0].old_status == "Pending"
        assert logs[0].new_status == "Confirmed"
        assert logs[0].changed_by == "testadmin"
        assert logs[0].admin_note == "Verified"


def test_history_endpoint_returns_status_changes(audit_client):
    client, headers, _ = audit_client

    client.patch(
        "/api/admin/bookings/ANS-AUDIT12345",
        headers=headers,
        json={"status": "Confirmed", "admin_note": "Verified"},
    )

    response = client.get(
        "/api/admin/bookings/ANS-AUDIT12345/history",
        headers=headers,
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["old_status"] == "Pending"
    assert response.json()[0]["new_status"] == "Confirmed"


def test_history_endpoint_requires_admin(audit_client):
    client, _, _ = audit_client

    response = client.get(
        "/api/admin/bookings/ANS-AUDIT12345/history"
    )
    assert response.status_code == 401


def test_admin_stats_returns_actual_booking_counts(audit_client):
    client, headers, _ = audit_client

    response = client.get("/api/admin/stats", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "total": 1,
        "pending": 1,
        "confirmed": 0,
        "rejected": 0,
    }

    client.patch(
        "/api/admin/bookings/ANS-AUDIT12345",
        headers=headers,
        json={"status": "Confirmed", "admin_note": "Verified"},
    )

    response = client.get("/api/admin/stats", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "total": 1,
        "pending": 0,
        "confirmed": 1,
        "rejected": 0,
    }


def test_admin_stats_requires_authentication(audit_client):
    client, _, _ = audit_client

    response = client.get("/api/admin/stats")

    assert response.status_code == 401
