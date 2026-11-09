import pytest
from fastapi.testclient import TestClient

from tests.helpers import sign_in, sign_up

URL = "/api/saved-groups"


def node(node_id: str) -> dict:
    return {
        "id": node_id,
        "kind": "GaussianField",
        "params": {"seed": 1},
        "name": None,
        "position": {"x": 0, "y": 0},
        "preview_hidden": False,
    }


NODES = [node("a"), node("b")]
GROUPED = {
    "id": "g",
    "name": "Noise",
    "position": {"x": 0, "y": 0},
    "width": 300,
    "height": 200,
    "nodes": ["a", "b"],
    "inputs": [],
    "outputs": [{"node": "b", "port": "field"}],
    "input_position": {"x": -200, "y": 0},
    "output_position": None,
}
GROUP = {
    "version": 1,
    "nodes": NODES,
    "edges": [
        {
            "id": "e",
            "source": "a",
            "source_port": "field",
            "target": "b",
            "target_port": "x",
        }
    ],
    "groups": [GROUPED],
}


def test_saves_a_group_to_the_account(signed_in: TestClient) -> None:
    created = signed_in.post(URL, json={"name": "Noise", "content": GROUP})

    assert created.status_code == 201
    assert created.json()["content"] == GROUP
    assert [group["name"] for group in signed_in.get(URL).json()] == ["Noise"]


def test_lists_the_newest_saved_group_first(signed_in: TestClient) -> None:
    for name in ("First", "Second"):
        signed_in.post(URL, json={"name": name, "content": GROUP})

    assert [group["name"] for group in signed_in.get(URL).json()] == ["Second", "First"]


@pytest.mark.parametrize(
    "groups",
    [[], [GROUPED, {**GROUPED, "id": "h", "nodes": []}]],
)
def test_needs_exactly_one_group(signed_in: TestClient, groups: list) -> None:
    response = signed_in.post(
        URL, json={"name": "Noise", "content": {**GROUP, "groups": groups}}
    )

    assert response.status_code == 422


def test_keeps_saved_group_names_short(signed_in: TestClient) -> None:
    response = signed_in.post(URL, json={"name": "x" * 41, "content": GROUP})

    assert response.status_code == 422


def test_needs_every_node_in_the_group(signed_in: TestClient) -> None:
    content = {**GROUP, "nodes": [*NODES, node("c")]}

    response = signed_in.post(URL, json={"name": "Noise", "content": content})

    assert response.status_code == 422


def test_keeps_saved_groups_to_their_owner(client: TestClient) -> None:
    sign_up(client, "ada@example.com")
    group_id = client.post(URL, json={"name": "Noise", "content": GROUP}).json()["id"]
    sign_up(client, "bob@example.com")

    assert client.get(URL).json() == []
    assert client.patch(f"{URL}/{group_id}", json={"name": "Mine"}).status_code == 404
    assert client.delete(f"{URL}/{group_id}").status_code == 404

    sign_in(client, "ada@example.com")
    assert len(client.get(URL).json()) == 1


def test_renames_a_saved_group(signed_in: TestClient) -> None:
    group_id = signed_in.post(URL, json={"name": "Noise", "content": GROUP}).json()[
        "id"
    ]

    renamed = signed_in.patch(f"{URL}/{group_id}", json={"name": "Smooth noise"})

    assert renamed.json()["name"] == "Smooth noise"
    assert renamed.json()["content"] == GROUP


def test_deletes_a_saved_group(signed_in: TestClient) -> None:
    group_id = signed_in.post(URL, json={"name": "Noise", "content": GROUP}).json()[
        "id"
    ]

    assert signed_in.delete(f"{URL}/{group_id}").status_code == 204
    assert signed_in.get(URL).json() == []


def test_needs_a_signed_in_user(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
