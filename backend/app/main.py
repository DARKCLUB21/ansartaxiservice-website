from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.api.bookings import router as bookings_router
from app.api.admin import router as admin_router
from app.api.routes import router as routes_router
from app.core.config import settings
from app.core.limiter import limiter

app = FastAPI(
    title="ANSAR TAXI SERVICE API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

allowed_origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ANSAR TAXI SERVICE API"}


app.include_router(bookings_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

app.include_router(routes_router, prefix="/api")
