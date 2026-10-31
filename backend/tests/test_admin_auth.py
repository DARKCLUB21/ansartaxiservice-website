from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import hash_password
from app.core.auth import decode_access_token

client = TestClient(app)


def setup_credentials():
    settings.admin_username = "testadmin"
    settings.admin_password_hash = hash_password("TestPassword123!")
    settings.secret_key = "test-secret-key-for-local-testing-only-123456"


def test_successful_admin_login():
    setup_credentials()

    response = client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "TestPassword123!"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 1800
    assert decode_access_token(data["access_token"])["sub"] == "testadmin"


def test_wrong_password_is_rejected():
    setup_credentials()

    response = client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "WrongPassword123!"},
    )

    assert response.status_code == 401


def test_unconfigured_admin_is_rejected():
    settings.admin_password_hash = ""
    settings.secret_key = ""

    response = client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "TestPassword123!"},
    )

    assert response.status_code == 503


def test_admin_booking_list_requires_token():
    setup_credentials()
    response = client.get("/api/admin/bookings")
    assert response.status_code == 401


def test_admin_booking_detail_requires_token():
    setup_credentials()
    response = client.get("/api/admin/bookings/ANS-UNKNOWN")
    assert response.status_code == 401


def test_admin_booking_update_requires_token():
    setup_credentials()
    response = client.patch(
        "/api/admin/bookings/ANS-UNKNOWN",
        json={"status": "Confirmed", "admin_note": "Test"},
    )
    assert response.status_code == 401


def test_admin_booking_list_rejects_invalid_token():
    settings.secret_key = "test-secret-key-for-local-testing-only-123456"
    settings.admin_username = "testadmin"

    response = client.get(
        "/api/admin/bookings",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401
