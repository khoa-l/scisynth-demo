from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, col, select

from app.models import User, UserSession, utcnow
from tests.helpers import is_nanoid

CREDENTIALS = {"email": "Ada@Example.com", "password": "correct-horse"}


def register(client: TestClient) -> None:
    response = client.post("/api/auth/register", json=CREDENTIALS)
    assert response.status_code == 201


def test_register_starts_session(client: TestClient) -> None:
    response = client.post("/api/auth/register", json=CREDENTIALS)
    assert response.status_code == 201
    assert response.json()["email"] == "ada@example.com"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"
    assert is_nanoid(me.json()["id"])


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    register(client)
    response = client.post(
        "/api/auth/register",
        json={"email": "ada@example.com", "password": "another-password"},
    )
    assert response.status_code == 409


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"email": "ada@example.com", "password": "short"}
    )
    assert response.status_code == 422


def test_me_requires_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_login(client: TestClient) -> None:
    register(client)
    client.cookies.clear()

    wrong = client.post(
        "/api/auth/login", json={**CREDENTIALS, "password": "wrong-password"}
    )
    assert wrong.status_code == 401

    unknown = client.post(
        "/api/auth/login", json={**CREDENTIALS, "email": "nobody@example.com"}
    )
    assert unknown.status_code == 401

    response = client.post("/api/auth/login", json=CREDENTIALS)
    assert response.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_logout_revokes_session(client: TestClient) -> None:
    register(client)
    token = client.cookies.get("session")
    assert token

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    client.cookies.set("session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_signing_in_clears_out_expired_sessions(
    client: TestClient, engine: Engine
) -> None:
    register(client)
    with Session(engine) as session:
        user = session.exec(select(User)).one()
        session.add(
            UserSession(
                token_hash="expired",
                user_id=user.id,
                expires_at=utcnow() - timedelta(seconds=1),
            )
        )
        session.commit()
    client.cookies.clear()

    assert client.post("/api/auth/login", json=CREDENTIALS).status_code == 200

    with Session(engine) as session:
        token_hashes = session.exec(select(col(UserSession.token_hash))).all()
    assert "expired" not in token_hashes
    assert len(token_hashes) == 2
