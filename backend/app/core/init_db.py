from app.core.database import Base, engine
from app.models.booking import Booking
from app.models.audit_log import BookingAuditLog


def initialize_database():
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    initialize_database()
    print("Database tables initialized successfully.")
