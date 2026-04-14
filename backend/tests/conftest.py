import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from morphing.database import Base, engine, get_db
from morphing.main import app


@pytest.fixture(autouse=True)
def _reset_db() -> None:
    from morphing import models  # noqa: F401

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db() -> Session:
    s = next(get_db())
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
