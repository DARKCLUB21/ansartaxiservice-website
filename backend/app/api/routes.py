from fastapi import APIRouter

from app.schemas.routes import RouteRequest, RouteResponse
from app.services.google_routes import calculate_route

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.post("/distance", response_model=RouteResponse)
def get_route_distance(payload: RouteRequest):
    return calculate_route(
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        destination_lat=payload.destination_lat,
        destination_lng=payload.destination_lng,
    )
