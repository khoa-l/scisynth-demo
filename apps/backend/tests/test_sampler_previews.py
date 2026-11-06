import io

import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.previews import (
    NODES,
    composite,
    decode,
    field,
    grid,
    link,
    preview,
    sampled,
    sampler,
)


def test_previews_a_grid_sampler_at_its_shape(signed_in: TestClient) -> None:
    nodes = [field("field"), sampler("grid", "GridSampler", shape=16)]

    result = preview(signed_in, "grid", nodes, [sampled("grid")])

    assert result["layout"] == "grid"
    assert grid(result).shape == (16, 16)
    x = decode(result["x"])
    assert len(x) == 16
    assert [x[0], x[-1]] == [0, 1]


def test_downloads_a_nodes_generated_data(signed_in: TestClient) -> None:
    nodes = [field("field"), sampler("grid", "GridSampler", shape=16)]
    body = {"node": "grid", "nodes": nodes, "edges": [sampled("grid")]}

    response = signed_in.post(f"{NODES}/data", json=body)

    assert response.headers["content-type"] == "application/octet-stream"
    arrays = np.load(io.BytesIO(response.content))
    shown = grid(preview(signed_in, "grid", nodes, [sampled("grid")]))
    np.testing.assert_array_equal(arrays["values"][..., 0].T.astype(np.float32), shown)
    assert arrays["truth"].shape == (16, 16, 1)


def test_wont_download_data_it_cant_generate(signed_in: TestClient) -> None:
    body = {"node": "grid", "nodes": [sampler("grid", "GridSampler", shape=16)]}

    assert signed_in.post(f"{NODES}/data", json=body).status_code == 422


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
        (sampler("s", "GridSampler", shape=16), [], "needs one input connected"),
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


@pytest.mark.parametrize(
    ("kind", "params"), [("GridSampler", {"shape": 16}), ("PointSampler", {"n": 100})]
)
def test_samples_every_channel_of_a_multichannel(
    signed_in: TestClient, kind: str, params: dict
) -> None:
    nodes = [field("a", seed=1), field("b", seed=2), composite("field", "Multichannel")]
    nodes += [sampler("s", kind, **params)]
    edges = [link("a", "field", "channels"), link("b", "field", "channels")]

    result = preview(signed_in, "s", nodes, [*edges, sampled("s")])

    assert len(result["channels"]) == 2
    assert not np.array_equal(grid(result, 0), grid(result, 1))


def test_a_point_sampler_follows_its_seed(signed_in: TestClient) -> None:
    def xs(**params: object) -> np.ndarray:
        nodes = [field("field"), sampler("s", "PointSampler", n=100, **params)]
        return decode(preview(signed_in, "s", nodes, [sampled("s")])["x"])

    assert np.array_equal(xs(), xs(seed=0))
    assert np.array_equal(xs(seed=3), xs(seed=3))
    assert not np.array_equal(xs(seed=1), xs(seed=2))
