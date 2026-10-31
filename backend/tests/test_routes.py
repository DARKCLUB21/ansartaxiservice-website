from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.api import routes as route_api
from app.services import google_routes

client = TestClient(app)


def test_route_endpoint_returns_distance(monkeypatch):
    monkeypatch.setattr(
        route_api,
        "calculate_route",
        lambda **kwargs: {"distance_km": 12.5, "duration": "900s"},
    )

    response = client.post(
        "/api/routes/distance",
        json={
            "pickup_lat": 15.59,
            "pickup_lng": 73.81,
            "destination_lat": 15.49,
            "destination_lng": 73.82,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "distance_km": 12.5,
        "duration": "900s",
    }


def test_route_endpoint_rejects_invalid_coordinates():
    response = client.post(
        "/api/routes/distance",
        json={
            "pickup_lat": 150,
            "pickup_lng": 73.81,
            "destination_lat": 15.49,
            "destination_lng": 73.82,
        },
    )
    assert response.status_code == 422


def test_missing_google_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "google_routes_api_key", "")

    with pytest.raises(HTTPException) as error:
        google_routes.calculate_route(15.59, 73.81, 15.49, 73.82)

    assert error.value.status_code == 503


def test_google_routes_response_is_converted_to_km(monkeypatch):
    monkeypatch.setattr(settings, "google_routes_api_key", "test-key")

    fake_response = Mock()
    fake_response.json.return_value = {
        "routes": [{"distanceMeters": 12500, "duration": "900s"}]
    }
    fake_response.raise_for_status.return_value = None

    monkeypatch.setattr(
        google_routes.httpx,
        "post",
        lambda *args, **kwargs: fake_response,
    )

    result = google_routes.calculate_route(15.59, 73.81, 15.49, 73.82)
    assert result == {"distance_km": 12.5, "duration": "900s"}
