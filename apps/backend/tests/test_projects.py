from fastapi.testclient import TestClient
from httpx2 import Response

from tests.helpers import is_nanoid, sign_in, sign_up

MISSING = "missing-project-id-0000"


def create(client: TestClient, name: str = "Untitled project") -> Response:
    return client.post("/api/projects", json={"name": name})


def test_projects_require_session(client: TestClient) -> None:
    url = f"/api/projects/{MISSING}"
    assert client.get("/api/projects").status_code == 401
    assert create(client).status_code == 401
    assert client.get(url).status_code == 401
    assert client.patch(url, json={"name": "Mine"}).status_code == 401
    assert client.delete(url).status_code == 401


def test_create_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    response = create(client, "  Protein folding  ")
    assert response.status_code == 201
    assert response.json()["name"] == "Protein folding"


def test_project_names_cannot_be_blank(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    assert create(client, "   ").status_code == 422
    project = create(client).json()
    response = client.patch(f"/api/projects/{project['id']}", json={"name": "   "})
    assert response.status_code == 422


def test_list_projects_newest_first(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    assert client.get("/api/projects").json() == []

    first = create(client).json()
    second = create(client).json()

    projects = client.get("/api/projects").json()
    assert [project["id"] for project in projects] == [second["id"], first["id"]]


def test_projects_are_private_to_owner(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client).json()
    url = f"/api/projects/{project['id']}"
    client.cookies.clear()

    sign_up(client, "grace@example.com")
    assert client.get("/api/projects").json() == []
    assert client.get(url).status_code == 404
    assert client.patch(url, json={"name": "Mine"}).status_code == 404
    assert client.delete(url).status_code == 404

    sign_in(client, "ada@example.com")
    assert client.get("/api/projects").json() == [project]


def test_get_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client, "Protein folding").json()

    response = client.get(f"/api/projects/{project['id']}")
    assert response.status_code == 200
    assert response.json() == project


def test_rename_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    project = create(client).json()

    response = client.patch(
        f"/api/projects/{project['id']}", json={"name": "  Protein folding  "}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Protein folding"
    assert client.get("/api/projects").json()[0]["name"] == "Protein folding"


def test_delete_project(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    keep = create(client, "Keep").json()
    remove = create(client, "Remove").json()

    response = client.delete(f"/api/projects/{remove['id']}")
    assert response.status_code == 204
    assert [project["id"] for project in client.get("/api/projects").json()] == [
        keep["id"]
    ]


def test_missing_projects_are_not_found(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    for project_id in [MISSING, "1"]:
        url = f"/api/projects/{project_id}"
        assert client.get(url).status_code == 404
        assert client.patch(url, json={"name": "Mine"}).status_code == 404
        assert client.delete(url).status_code == 404


def test_project_ids_are_nanoids(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    first = create(client).json()["id"]
    second = create(client).json()["id"]
    assert is_nanoid(first)
    assert is_nanoid(second)
    assert first != second
