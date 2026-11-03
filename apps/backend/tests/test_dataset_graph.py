from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session

from app.graph import MAX_NODES
from app.models import Dataset
from tests.helpers import sign_up

EMPTY = {"version": 1, "nodes": [], "edges": []}


def node(node_id: str, kind: str = "GaussianNoise", **params: Any) -> dict:
    return {"id": node_id, "kind": kind, "params": params, "position": {"x": 0, "y": 0}}


def edge(edge_id: str, source: str, target: str) -> dict:
    return {
        "id": edge_id,
        "source": source,
        "source_port": "observation",
        "target": target,
        "target_port": "observation",
    }


GRAPH = {
    "version": 1,
    "nodes": [
        node("a", "GridSampler", shape=64),
        node("b", "Quantize", levels=256, vmin=None, vmax=0.5),
        node("c", "InterpolatedField", mode="grid-wrap"),
    ],
    "edges": [edge("e1", "a", "b")],
}


@pytest.fixture
def dataset_url(client: TestClient) -> str:
    sign_up(client, "ada@example.com")
    project_id = client.post("/api/projects", json={"name": "Project"}).json()["id"]
    url = f"/api/projects/{project_id}/datasets"
    dataset_id = client.post(url, json={"name": "Fields"}).json()["id"]
    return f"{url}/{dataset_id}"


def test_new_dataset_has_an_empty_graph(client: TestClient, dataset_url: str) -> None:
    assert client.get(dataset_url).json()["content"] == EMPTY


def test_saves_the_graph_and_keeps_the_name(
    client: TestClient, dataset_url: str
) -> None:
    response = client.patch(dataset_url, json={"content": GRAPH})

    assert response.status_code == 200
    assert response.json()["name"] == "Fields"
    assert response.json()["content"] == GRAPH
    assert client.get(dataset_url).json()["content"] == GRAPH


def test_keeps_parameter_types_including_blank_values(
    client: TestClient, dataset_url: str
) -> None:
    client.patch(dataset_url, json={"content": GRAPH})

    params = client.get(dataset_url).json()["content"]["nodes"][1]["params"]
    assert params == {"levels": 256, "vmin": None, "vmax": 0.5}
    assert isinstance(params["levels"], int)


def test_renaming_keeps_the_graph(client: TestClient, dataset_url: str) -> None:
    client.patch(dataset_url, json={"content": GRAPH})

    response = client.patch(dataset_url, json={"name": "Renamed"})
    assert response.json()["name"] == "Renamed"
    assert response.json()["content"] == GRAPH


def test_a_dataset_saved_before_graphs_reads_as_empty(
    client: TestClient, dataset_url: str, engine: Engine
) -> None:
    with Session(engine) as db:
        dataset = db.get(Dataset, dataset_url.rsplit("/", 1)[1])
        assert dataset is not None
        assert dataset.content == {}

    assert client.get(dataset_url).json()["content"] == EMPTY


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ({**EMPTY, "nodes": [node("a"), node("a")]}, "Node ids must be unique"),
        (
            {
                **EMPTY,
                "nodes": [node("a"), node("b")],
                "edges": [edge("e", "a", "b")] * 2,
            },
            "Edge ids must be unique",
        ),
        (
            {**EMPTY, "nodes": [node("a")], "edges": [edge("e", "a", "gone")]},
            "connects a node that doesn't exist",
        ),
        (
            {**EMPTY, "nodes": [node("a")], "edges": [edge("e", "a", "a")]},
            "connects a node to itself",
        ),
        ({**EMPTY, "version": 2}, "Input should be 1"),
        ({**EMPTY, "extra": True}, "Extra inputs are not permitted"),
        ({**EMPTY, "nodes": [{**node("a"), "selected": True}]}, "Extra inputs"),
        ({**EMPTY, "nodes": [node("a", sigma=[1, 2])]}, "Input should be"),
        ({**EMPTY, "nodes": [node("a", kind="")]}, "at least 1 character"),
        (
            {**EMPTY, "nodes": [node(str(n)) for n in range(MAX_NODES + 1)]},
            f"at most {MAX_NODES} items",
        ),
    ],
)
def test_rejects_malformed_graphs(
    client: TestClient, dataset_url: str, content: dict, message: str
) -> None:
    client.patch(dataset_url, json={"content": GRAPH})

    response = client.patch(dataset_url, json={"content": content})

    assert response.status_code == 422
    assert message in str(response.json()["detail"])
    assert client.get(dataset_url).json()["content"] == GRAPH
