import httpx
from fastapi import HTTPException

from app.core.config import settings


ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def calculate_route(
    pickup_lat: float,
    pickup_lng: float,
    destination_lat: float,
    destination_lng: float,
) -> dict:
    if not settings.google_routes_api_key:
        raise HTTPException(
            status_code=503,
            detail="Route calculation is not configured.",
        )

    payload = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": pickup_lat,
                    "longitude": pickup_lng,
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": destination_lat,
                    "longitude": destination_lng,
                }
            }
        },
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_UNAWARE",
        "units": "METRIC",
    }

    try:
        response = httpx.post(
            ROUTES_URL,
            headers={
                "X-Goog-Api-Key": settings.google_routes_api_key,
                "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Route service timed out.")
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Google Maps route request failed.")
    except (httpx.RequestError, ValueError):
        raise HTTPException(status_code=502, detail="Route service is temporarily unavailable.")

    routes = data.get("routes") or []
    if not routes:
        raise HTTPException(status_code=404, detail="No driving route found.")

    route = routes[0]
    distance_meters = route.get("distanceMeters")
    duration = route.get("duration")

    if not isinstance(distance_meters, (int, float)) or not duration:
        raise HTTPException(status_code=502, detail="Invalid route response.")

    return {
        "distance_km": round(distance_meters / 1000, 2),
        "duration": duration,
    }
