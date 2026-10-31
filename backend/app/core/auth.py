from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 30


def create_access_token(username: str) -> str:
    if not settings.secret_key or len(settings.secret_key) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters.")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    if not settings.secret_key or len(settings.secret_key) < 32:
        raise RuntimeError("SECRET_KEY is not configured securely.")

    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
