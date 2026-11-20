import os
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures" / "content"
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ["CONTENT_DIR"] = str(FIXTURES)
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth(client):
    r = client.post("/api/auth/register", json={"email": "a@b.cz", "password": "heslo12345", "display_name": "Test"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
