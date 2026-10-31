from pydantic import BaseModel, Field


class RouteRequest(BaseModel):
    pickup_lat: float = Field(ge=-90, le=90)
    pickup_lng: float = Field(ge=-180, le=180)
    destination_lat: float = Field(ge=-90, le=90)
    destination_lng: float = Field(ge=-180, le=180)


class RouteResponse(BaseModel):
    distance_km: float
    duration: str
