from fastapi.testclient import TestClient
from httpx2 import Response


def create(client: TestClient, name: str = "Untitled project") -> Response:
    return client.post("/api/projects", json={"name": name})


def sign_up(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "correct-horse"}
    )
    assert response.status_code == 201


def test_projects_require_session(client: TestClient) -> None:
    assert client.get("/api/projects").status_code == 401
    assert create(client).status_code == 401


def test_create_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    response = create(client, "  Protein folding  ")
    assert response.status_code == 201
    assert response.json()["name"] == "Protein folding"


def test_create_project_rejects_blank_name(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    assert create(client, "   ").status_code == 422


def test_list_projects_newest_first(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    assert client.get("/api/projects").json() == []

    first = create(client).json()
    second = create(client).json()

    projects = client.get("/api/projects").json()
    assert [project["id"] for project in projects] == [second["id"], first["id"]]


def test_projects_are_private_to_owner(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    create(client)
    client.cookies.clear()

    sign_up(client, "grace@example.com")
    assert client.get("/api/projects").json() == []


def test_rename_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client).json()

    response = client.patch(
        f"/api/projects/{project['id']}", json={"name": "  Protein folding  "}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Protein folding"
    assert client.get("/api/projects").json()[0]["name"] == "Protein folding"


def test_rename_project_rejects_blank_name(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client).json()

    response = client.patch(f"/api/projects/{project['id']}", json={"name": "   "})
    assert response.status_code == 422


def test_rename_project_of_another_user(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client).json()
    client.cookies.clear()

    sign_up(client, "grace@example.com")
    response = client.patch(f"/api/projects/{project['id']}", json={"name": "Mine"})
    assert response.status_code == 404


def test_rename_project_requires_session(client: TestClient) -> None:
    assert client.patch("/api/projects/1", json={"name": "Mine"}).status_code == 401


def test_delete_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    keep = create(client, "Keep").json()
    remove = create(client, "Remove").json()

    response = client.delete(f"/api/projects/{remove['id']}")
    assert response.status_code == 204
    assert [project["id"] for project in client.get("/api/projects").json()] == [
        keep["id"]
    ]


def test_delete_missing_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    assert client.delete("/api/projects/999").status_code == 404


def test_delete_project_of_another_user(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client).json()
    client.cookies.clear()

    sign_up(client, "grace@example.com")
    assert client.delete(f"/api/projects/{project['id']}").status_code == 404
    client.cookies.clear()

    client.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "password": "correct-horse"},
    )
    assert len(client.get("/api/projects").json()) == 1


def test_delete_project_requires_session(client: TestClient) -> None:
    assert client.delete("/api/projects/1").status_code == 401
