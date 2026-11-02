from fastapi.testclient import TestClient


def sign_up(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "correct-horse"}
    )
    assert response.status_code == 201


def test_projects_require_session(client: TestClient) -> None:
    assert client.get("/api/projects").status_code == 401
    assert client.post("/api/projects").status_code == 401


def test_create_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    response = client.post("/api/projects")
    assert response.status_code == 201
    assert response.json()["name"] == "Untitled project"


def test_list_projects_newest_first(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    assert client.get("/api/projects").json() == []

    first = client.post("/api/projects").json()
    second = client.post("/api/projects").json()

    projects = client.get("/api/projects").json()
    assert [project["id"] for project in projects] == [second["id"], first["id"]]


def test_projects_are_private_to_owner(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    client.post("/api/projects")
    client.cookies.clear()

    sign_up(client, "grace@example.com")
    assert client.get("/api/projects").json() == []
