import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, SQLModel, select

from app.models import Dataset, Survey
from tests.helpers import is_nanoid, sign_in, sign_up

ITEMS = ["datasets", "surveys"]
MISSING = "missing-item-id-0000000"
MODELS: dict[str, type[SQLModel]] = {"datasets": Dataset, "surveys": Survey}


def create_project(client: TestClient) -> str:
    return client.post("/api/projects", json={"name": "Project"}).json()["id"]


@pytest.fixture
def project_id(client: TestClient) -> str:
    sign_up(client, "ada@example.com")
    return create_project(client)


@pytest.mark.parametrize("items", ITEMS)
def test_items_require_session(client: TestClient, items: str) -> None:
    assert client.get(f"/api/projects/{MISSING}/{items}").status_code == 401
    assert (
        client.post(f"/api/projects/{MISSING}/{items}", json={"name": "x"}).status_code
        == 401
    )
    assert (
        client.patch(
            f"/api/projects/{MISSING}/{items}/{MISSING}", json={"name": "x"}
        ).status_code
        == 401
    )
    assert (
        client.delete(f"/api/projects/{MISSING}/{items}/{MISSING}").status_code == 401
    )


@pytest.mark.parametrize("items", ITEMS)
def test_create_and_list_items_newest_first(
    client: TestClient, project_id: str, items: str
) -> None:
    url = f"/api/projects/{project_id}/{items}"
    assert client.get(url).json() == []

    first = client.post(url, json={"name": "  First  "})
    assert first.status_code == 201
    assert first.json()["name"] == "First"
    second = client.post(url, json={"name": "Second"}).json()

    listed = client.get(url).json()
    assert [item["id"] for item in listed] == [second["id"], first.json()["id"]]


@pytest.mark.parametrize("items", ITEMS)
def test_create_item_rejects_blank_name(
    client: TestClient, project_id: str, items: str
) -> None:
    url = f"/api/projects/{project_id}/{items}"
    assert client.post(url, json={"name": "   "}).status_code == 422


@pytest.mark.parametrize("items", ITEMS)
def test_items_belong_to_their_project(
    client: TestClient, project_id: str, items: str
) -> None:
    other_id = create_project(client)
    item = client.post(
        f"/api/projects/{project_id}/{items}", json={"name": "Mine"}
    ).json()

    assert client.get(f"/api/projects/{other_id}/{items}").json() == []
    other_url = f"/api/projects/{other_id}/{items}/{item['id']}"
    assert client.patch(other_url, json={"name": "x"}).status_code == 404
    assert client.delete(other_url).status_code == 404


@pytest.mark.parametrize("items", ITEMS)
def test_rename_item(client: TestClient, project_id: str, items: str) -> None:
    url = f"/api/projects/{project_id}/{items}"
    item = client.post(url, json={"name": "Old"}).json()

    response = client.patch(f"{url}/{item['id']}", json={"name": "  New  "})
    assert response.status_code == 200
    assert response.json()["name"] == "New"
    assert client.get(url).json()[0]["name"] == "New"
    assert client.patch(f"{url}/{item['id']}", json={"name": " "}).status_code == 422


@pytest.mark.parametrize("items", ITEMS)
def test_delete_item(client: TestClient, project_id: str, items: str) -> None:
    url = f"/api/projects/{project_id}/{items}"
    keep = client.post(url, json={"name": "Keep"}).json()
    remove = client.post(url, json={"name": "Remove"}).json()

    assert client.delete(f"{url}/{remove['id']}").status_code == 204
    assert [item["id"] for item in client.get(url).json()] == [keep["id"]]
    assert client.delete(f"{url}/{remove['id']}").status_code == 404


@pytest.mark.parametrize("items", ITEMS)
def test_items_are_private_to_project_owner(
    client: TestClient, project_id: str, items: str
) -> None:
    url = f"/api/projects/{project_id}/{items}"
    item = client.post(url, json={"name": "Mine"}).json()
    client.cookies.clear()

    sign_up(client, "grace@example.com")
    assert client.get(url).status_code == 404
    assert client.post(url, json={"name": "x"}).status_code == 404
    assert client.patch(f"{url}/{item['id']}", json={"name": "x"}).status_code == 404
    assert client.delete(f"{url}/{item['id']}").status_code == 404

    sign_in(client, "ada@example.com")
    assert client.get(url).json() == [item]


@pytest.mark.parametrize("items", ITEMS)
def test_deleting_project_deletes_its_items(
    client: TestClient, engine: Engine, project_id: str, items: str
) -> None:
    client.post(f"/api/projects/{project_id}/{items}", json={"name": "Mine"})
    assert client.delete(f"/api/projects/{project_id}").status_code == 204

    with Session(engine) as session:
        assert session.exec(select(MODELS[items])).all() == []


@pytest.mark.parametrize("items", ITEMS)
def test_item_ids_are_nanoids(client: TestClient, project_id: str, items: str) -> None:
    url = f"/api/projects/{project_id}/{items}"
    item_id = client.post(url, json={"name": "Mine"}).json()["id"]
    assert is_nanoid(item_id)
    assert client.patch(f"{url}/{item_id}", json={"name": "New"}).status_code == 200
    assert client.patch(f"{url}/1", json={"name": "New"}).status_code == 404
