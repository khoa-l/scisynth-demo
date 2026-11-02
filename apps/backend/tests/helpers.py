import re

from fastapi.testclient import TestClient

PASSWORD = "correct-horse"


def is_nanoid(value: str) -> bool:
    return re.fullmatch(r"[A-Za-z0-9_-]{21}", value) is not None


def sign_up(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 201


def sign_in(client: TestClient, email: str) -> None:
    client.cookies.clear()
    response = client.post(
        "/api/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200
