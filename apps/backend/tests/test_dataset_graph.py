import io
import json
import zipfile
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.dataset_graph import MAX_NODES
from tests.helpers import sign_up
from tests.surveys import DROPPED

EMPTY = {"version": 1, "nodes": [], "edges": []}


def node(node_id: str, kind: str = "GaussianNoise", **params: Any) -> dict:
    return {
        "id": node_id,
        "kind": kind,
        "params": params,
        "position": {"x": 0, "y": 0},
        "preview_hidden": False,
    }


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


def test_exports_the_graph_as_a_file(client: TestClient, dataset_url: str) -> None:
    client.patch(dataset_url, json={"content": GRAPH})

    exported = client.get(f"{dataset_url}/export").json()

    assert exported["format"] == "scisynth-dataset"
    assert exported["version"] == 1
    assert exported["name"] == "Fields"
    assert exported["graph"] == GRAPH
    assert set(exported["generator"]) == {"scisynth", "numpy"}


def test_only_the_owner_can_export(client: TestClient, dataset_url: str) -> None:
    sign_up(client, "bob@example.com")

    assert client.get(f"{dataset_url}/export").status_code == 404


def test_downloads_the_generated_data_of_every_node(
    client: TestClient, dataset_url: str
) -> None:
    lonely = node("lonely", "GridSampler", shape=8)
    client.patch(
        dataset_url, json={"content": {**DROPPED, "nodes": [*DROPPED["nodes"], lonely]}}
    )

    response = client.get(f"{dataset_url}/data")

    assert response.headers["content-type"] == "application/zip"
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert set(archive.namelist()) == {
        "Fields.scisynth.json",
        "data/GaussianField-a.npz",
        "data/GaussianField-b.npz",
        "data/Multichannel-field.npz",
        "data/GridSampler-grid.npz",
        "data/RandomDropout-drop.npz",
        "skipped.json",
    }
    arrays = np.load(io.BytesIO(archive.read("data/RandomDropout-drop.npz")))
    assert arrays["values"].shape == (16, 16, 2)
    assert not arrays["mask"].all()
    assert set(json.loads(archive.read("skipped.json"))) == {"lonely"}
    assert json.loads(archive.read("Fields.scisynth.json"))["name"] == "Fields"


def test_only_the_owner_can_download_data(client: TestClient, dataset_url: str) -> None:
    sign_up(client, "bob@example.com")

    assert client.get(f"{dataset_url}/data").status_code == 404


def test_uploading_an_exported_file_makes_a_copy(
    client: TestClient, dataset_url: str
) -> None:
    client.patch(dataset_url, json={"content": GRAPH})
    exported = client.get(f"{dataset_url}/export").json()
    datasets_url = dataset_url.rsplit("/", 1)[0]

    response = client.post(
        f"{datasets_url}/upload", json={**exported, "name": "Fields copy"}
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Fields copy"
    assert response.json()["content"] == GRAPH
    assert response.json()["id"] != dataset_url.rsplit("/", 1)[1]


@pytest.mark.parametrize(
    "changes",
    [
        {"format": "something-else"},
        {"version": 2},
        {"graph": {**GRAPH, "edges": [edge("e1", "a", "missing")]}},
        {"name": " "},
    ],
)
def test_rejects_uploading_a_file_it_cant_open(
    client: TestClient, dataset_url: str, changes: dict
) -> None:
    exported = client.get(f"{dataset_url}/export").json()
    datasets_url = dataset_url.rsplit("/", 1)[0]

    response = client.post(f"{datasets_url}/upload", json={**exported, **changes})

    assert response.status_code == 422
    assert len(client.get(datasets_url).json()) == 1


def test_keeps_parameter_types_including_blank_values(
    client: TestClient, dataset_url: str
) -> None:
    client.patch(dataset_url, json={"content": GRAPH})

    params = client.get(dataset_url).json()["content"]["nodes"][1]["params"]
    assert params == {"levels": 256, "vmin": None, "vmax": 0.5}
    assert isinstance(params["levels"], int)


def test_keeps_switch_parameters_as_booleans(
    client: TestClient, dataset_url: str
) -> None:
    pca = node("a", "PCA", whiten=True, seed=1)
    client.patch(dataset_url, json={"content": {**EMPTY, "nodes": [pca]}})

    params = client.get(dataset_url).json()["content"]["nodes"][0]["params"]
    assert params == {"whiten": True, "seed": 1}
    assert params["whiten"] is True
    assert type(params["seed"]) is int


def test_remembers_which_node_previews_are_hidden(
    client: TestClient, dataset_url: str
) -> None:
    hidden = {**node("a"), "preview_hidden": True}
    client.patch(dataset_url, json={"content": {**EMPTY, "nodes": [hidden]}})

    assert client.get(dataset_url).json()["content"]["nodes"][0]["preview_hidden"]


def test_shows_previews_of_nodes_saved_before_they_could_be_hidden(
    client: TestClient, dataset_url: str
) -> None:
    saved = {k: v for k, v in node("a").items() if k != "preview_hidden"}
    client.patch(dataset_url, json={"content": {**EMPTY, "nodes": [saved]}})

    loaded = client.get(dataset_url).json()["content"]["nodes"][0]
    assert loaded["preview_hidden"] is False


def test_renaming_keeps_the_graph(client: TestClient, dataset_url: str) -> None:
    client.patch(dataset_url, json={"content": GRAPH})

    response = client.patch(dataset_url, json={"name": "Renamed"})
    assert response.json()["name"] == "Renamed"
    assert response.json()["content"] == GRAPH


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
