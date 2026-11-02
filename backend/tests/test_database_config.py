from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.core.database import get_db


def test_get_db_returns_503_when_database_is_not_configured():
    with patch("app.core.database.SessionLocal", None):
        with pytest.raises(HTTPException) as exc:
            next(get_db())

    assert exc.value.status_code == 503
    assert exc.value.detail == "Database is not configured. Please try again later."
