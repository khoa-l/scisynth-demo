import base64

import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.helpers import sign_up

URL = "/api/previews/stages"


@pytest.fixture
def signed_in(client: TestClient) -> TestClient:
    sign_up(client, "ada@example.com")
    return client


def test_previews_a_stage_as_a_before_and_after_figure(signed_in: TestClient) -> None:
    response = signed_in.post(
        URL, json={"kind": "GaussianNoise", "params": {"sigma": 0.5}}
    )

    assert response.status_code == 200
    figure = response.json()
    assert [trace["type"] for trace in figure["data"]] == ["scatter", "scatter"]
    titles = [note["text"] for note in figure["layout"]["annotations"]]
    assert titles == ["before", "after GaussianNoise"]


def test_uses_the_given_parameters(signed_in: TestClient) -> None:
    def after(params: dict) -> list:
        body = {"kind": "Gain", "params": params}
        return signed_in.post(URL, json=body).json()["data"][1]["marker"]

    assert after({"factor": 1}) != after({"factor": 3})


def test_accepts_blank_optional_parameters(signed_in: TestClient) -> None:
    body = {"kind": "Quantize", "params": {"levels": 4, "vmin": None, "vmax": None}}
    assert signed_in.post(URL, json=body).status_code == 200


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"kind": "NoSuchStage", "params": {}}, "Unknown component"),
        ({"kind": "GaussianField", "params": {}}, "is not a Stage"),
        ({"kind": "GaussianNoise", "params": {"strength": 1}}, "strength"),
        ({"kind": "GaussianNoise", "params": {"sigma": -1}}, "non-negative"),
    ],
)
def test_rejects_what_it_cannot_preview(
    signed_in: TestClient, body: dict, message: str
) -> None:
    response = signed_in.post(URL, json=body)

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_requires_a_session(client: TestClient) -> None:
    response = client.post(URL, json={"kind": "Gain", "params": {}})
    assert response.status_code == 401


NODES = "/api/previews/nodes"
FIELD = {"length_scale": 0.1, "amplitude": 1, "mean": 0, "resolution": 128, "order": 1}


def field(node_id: str, **params: object) -> dict:
    return {
        "id": node_id,
        "kind": "GaussianField",
        "params": {**FIELD, "seed": 0, **params},
    }


def composite(node_id: str, kind: str) -> dict:
    return {"id": node_id, "kind": kind, "params": {}}


def link(source: str, target: str, port: str = "terms") -> dict:
    return {
        "id": f"{source}-{target}",
        "source": source,
        "source_port": "field",
        "target": target,
        "target_port": port,
    }


def decode(array: dict) -> np.ndarray:
    assert array["dtype"] == "f4"
    shape = tuple(int(n) for n in array["shape"].split(","))
    return np.frombuffer(base64.b64decode(array["bdata"]), np.float32).reshape(shape)


def grid(preview: dict, channel: int = 0) -> np.ndarray:
    return decode(preview["channels"][channel])


def preview(
    client: TestClient, node: str, nodes: list, edges: list | None = None
) -> dict:
    body = {"node": node, "nodes": nodes, "edges": edges or []}
    response = client.post(NODES, json=body)
    assert response.status_code == 200, response.json()
    return response.json()


def test_previews_a_field_as_a_heatmap_grid(signed_in: TestClient) -> None:
    result = preview(signed_in, "a", [field("a")])

    assert result["layout"] == "grid"
    assert len(result["channels"]) == 1
    assert grid(result).shape == (64, 64)
    x, y = decode(result["x"]), decode(result["y"])
    assert len(x) == len(y) == 64
    assert [x[0], x[-1], y[0], y[-1]] == [0, 1, 0, 1]


def test_field_preview_follows_its_parameters_and_seed(signed_in: TestClient) -> None:
    def values(**changes: object) -> np.ndarray:
        return grid(preview(signed_in, "a", [field("a", **changes)]))

    assert np.array_equal(values(), values())
    assert np.allclose(values(amplitude=2), 2 * values())
    assert not np.array_equal(values(seed=1), values(seed=2))


def test_previews_composites_from_their_connected_terms(signed_in: TestClient) -> None:
    a, b = field("a", seed=1), field("b", seed=2)
    one = grid(preview(signed_in, "a", [a]))
    two = grid(preview(signed_in, "b", [b]))

    def combined(kind: str) -> np.ndarray:
        nodes = [a, b, composite("c", kind)]
        return grid(preview(signed_in, "c", nodes, [link("a", "c"), link("b", "c")]))

    assert np.allclose(combined("Sum"), one + two, atol=1e-5)
    assert np.allclose(combined("Product"), one * two, atol=1e-5)
    channels = [a, b, composite("m", "Multichannel")]
    edges = [link("a", "m", "channels"), link("b", "m", "channels")]
    stacked = preview(signed_in, "m", channels, edges)
    assert len(stacked["channels"]) == 2
    assert np.allclose(grid(stacked, 0), one)
    assert np.allclose(grid(stacked, 1), two)


def test_previews_composites_only_with_enough_terms(signed_in: TestClient) -> None:
    a = field("a")
    body = {"node": "c", "nodes": [a, composite("c", "Sum")], "edges": [link("a", "c")]}

    response = signed_in.post(NODES, json=body)
    assert response.status_code == 422
    assert response.json()["detail"] == "Sum needs at least two fields"

    channels = [a, composite("m", "Multichannel")]
    result = preview(signed_in, "m", channels, [link("a", "m", "channels")])
    assert np.allclose(grid(result), grid(preview(signed_in, "a", [a])))


def test_previews_composites_of_composites(signed_in: TestClient) -> None:
    nodes = [field("a", seed=1), field("b", seed=2), composite("s", "Sum")]
    nodes += [composite("p", "Product")]
    edges = [link("a", "s"), link("b", "s"), link("s", "p"), link("a", "p")]

    nested = grid(preview(signed_in, "p", nodes, edges))
    summed = grid(preview(signed_in, "s", nodes[:3], edges[:2]))
    alone = grid(preview(signed_in, "a", [nodes[0]]))
    assert np.allclose(nested, summed * alone, atol=1e-5)


def test_latent_preview_caps_the_resolution(signed_in: TestClient) -> None:
    body = {"node": "a", "nodes": [field("a", resolution=4096, max_cells=10**12)]}

    response = signed_in.post(NODES, json=body)

    assert response.status_code == 422
    assert "over the limit of 262,144" in response.json()["detail"]


@pytest.mark.parametrize(
    ("node", "nodes", "edges", "message"),
    [
        ("c", [composite("c", "Sum")], [], "Sum needs at least two fields"),
        ("c", [composite("c", "Multichannel")], [], "needs at least one channel"),
        (
            "p",
            [composite("s", "Sum"), composite("p", "Product")],
            [link("s", "p"), link("p", "s")],
            "form a loop",
        ),
        (
            "c",
            [composite("c", "Sum")],
            [link("gone", "c")],
            "isn't part of the preview",
        ),
        (
            "c",
            [{"id": "c", "kind": "NoSuchLatent", "params": {}}],
            [],
            "Unknown component",
        ),
        (
            "c",
            [{"id": "c", "kind": "GaussianNoise", "params": {}}],
            [],
            "is not a Latent",
        ),
        ("c", [field("c", length_scale=0)], [], "length_scale"),
        ("c", [field("c", seed=-1)], [], "seed must be"),
        (
            "c",
            [{"id": "c", "kind": "AnalyticField", "params": {}}],
            [],
            "Unknown component",
        ),
    ],
)
def test_rejects_latents_it_cannot_preview(
    signed_in: TestClient, node: str, nodes: list, edges: list, message: str
) -> None:
    response = signed_in.post(
        NODES, json={"node": node, "nodes": nodes, "edges": edges}
    )

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_latent_preview_requires_a_session(client: TestClient) -> None:
    response = client.post(NODES, json={"node": "a", "nodes": [field("a")]})
    assert response.status_code == 401


def sampler(node_id: str, kind: str, **params: object) -> dict:
    return {"id": node_id, "kind": kind, "params": params}


def sampled(node_id: str) -> dict:
    return {
        "id": f"field-{node_id}",
        "source": "field",
        "source_port": "field",
        "target": node_id,
        "target_port": "latent",
    }


def test_previews_a_grid_sampler_at_its_shape(signed_in: TestClient) -> None:
    nodes = [field("field"), sampler("grid", "GridSampler", shape=16)]

    result = preview(signed_in, "grid", nodes, [sampled("grid")])

    assert result["layout"] == "grid"
    assert grid(result).shape == (16, 16)
    x = decode(result["x"])
    assert len(x) == 16
    assert [x[0], x[-1]] == [0, 1]


def test_previews_a_point_sampler_as_points(signed_in: TestClient) -> None:
    nodes = [field("field"), sampler("points", "PointSampler", n=500)]

    result = preview(signed_in, "points", nodes, [sampled("points")])

    assert result["layout"] == "points"
    x, y, values = decode(result["x"]), decode(result["y"]), grid(result)
    assert x.shape == y.shape == values.shape == (500,)
    assert x.min() >= 0 and x.max() <= 1
    assert y.min() >= 0 and y.max() <= 1


@pytest.mark.parametrize(
    ("node", "edges", "message"),
    [
        (sampler("s", "GridSampler", shape=16), [], "needs one latent connected"),
        (
            sampler("s", "GridSampler", shape=1024),
            [sampled("s")],
            "over the limit of 65,536",
        ),
        (
            sampler("s", "PointSampler", n=20_000),
            [sampled("s")],
            "Too many points to preview",
        ),
    ],
)
def test_rejects_samplers_it_cannot_preview(
    signed_in: TestClient, node: dict, edges: list, message: str
) -> None:
    body = {"node": "s", "nodes": [field("field"), node], "edges": edges}

    response = signed_in.post(NODES, json=body)

    assert response.status_code == 422
    assert message in response.json()["detail"]
