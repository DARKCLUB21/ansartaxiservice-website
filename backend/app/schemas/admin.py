from typing import Literal

from pydantic import BaseModel, Field


class AdminLogin(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=12, max_length=256)


class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class BookingStatusUpdate(BaseModel):
    status: Literal["Confirmed", "Rejected"]
    admin_note: str | None = Field(default=None, max_length=1000)
