import re

from fastapi.testclient import TestClient

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
    assert re.fullmatch(r"[A-Za-z0-9_-]{21}", me.json()["id"])


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
