import io

import numpy as np
from fastapi.testclient import TestClient

from tests.previews import NODES, decode, field, grid, sampler

CUBE = [
    {"name": "x", "extent": [0, 1]},
    {"name": "y", "extent": [0, 1]},
    {"name": "z", "extent": [0, 2]},
]


def in_domain(*nodes: dict, axes: list = CUBE) -> tuple[list, list]:
    domain = {"id": "d", "kind": "Domain", "params": {"axes": axes}}
    to_field = {
        "id": "d-a",
        "source": "d",
        "source_port": "domain",
        "target": "a",
        "target_port": "domain",
    }
    return [domain, field("a"), *nodes], [to_field]


def viewed(client: TestClient, node: str, nodes: list, edges: list, **view: object):
    body = {"node": node, "nodes": nodes, "edges": edges, "view": view or None}
    response = client.post(NODES, json=body)
    assert response.status_code == 200, response.json()
    return response.json()


def full_data(client: TestClient, node: str, nodes: list, edges: list) -> dict:
    body = {"node": node, "nodes": nodes, "edges": edges}
    arrays = np.load(io.BytesIO(client.post(f"{NODES}/data", json=body).content))
    return {name: arrays[name].astype(np.float32) for name in arrays if name != "meta"}


def test_lays_a_latent_out_in_its_domain(signed_in: TestClient) -> None:
    axes = [{"name": "depth", "extent": [-1, 1]}, {"name": "time", "extent": [0, 10]}]
    nodes, edges = in_domain(axes=axes)

    result = viewed(signed_in, "a", nodes, edges)

    assert result["axes"] == ["depth", "time"]
    assert result["domain"] == [
        {"name": "depth", "start": -1, "end": 1},
        {"name": "time", "start": 0, "end": 10},
    ]
    x, y = decode(result["x"]), decode(result["y"])
    assert [x[0], x[-1], y[0], y[-1]] == [-1, 1, 0, 10]


def test_previews_the_first_two_axes_sliced_through_the_middle_of_the_rest(
    signed_in: TestClient,
) -> None:
    nodes, edges = in_domain()

    result = viewed(signed_in, "a", nodes, edges)

    assert result["axes"] == ["x", "y"]
    assert [axis["name"] for axis in result["domain"]] == ["x", "y", "z"]
    at_middle = viewed(signed_in, "a", nodes, edges, x="x", y="y", at={"z": 1})
    at_start = viewed(signed_in, "a", nodes, edges, x="x", y="y", at={"z": 0})
    assert np.array_equal(grid(result), grid(at_middle))
    assert not np.array_equal(grid(result), grid(at_start))


def test_shows_the_chosen_axes_and_slice(signed_in: TestClient) -> None:
    nodes, edges = in_domain()
    full = full_data(signed_in, "a", nodes, edges)

    def slice_at(y: float) -> np.ndarray:
        result = viewed(signed_in, "a", nodes, edges, x="z", y="x", at={"y": y})
        assert result["axes"] == ["z", "x"]
        assert np.array_equal(decode(result["x"]), full["coord_z"])
        return grid(result)

    index = int(np.abs(full["coord_y"] - 0.25).argmin())
    assert np.array_equal(slice_at(0.25), full["values"][:, index, :, 0])
    assert not np.array_equal(slice_at(0.25), slice_at(0.75))


def test_keeps_points_near_the_slice(signed_in: TestClient) -> None:
    nodes, edges = in_domain(sampler("p", "PointSampler", n=1000))
    edges += [
        {
            "id": "a-p",
            "source": "a",
            "source_port": "field",
            "target": "p",
            "target_port": "latent",
        }
    ]
    full = full_data(signed_in, "p", nodes, edges)

    result = viewed(signed_in, "p", nodes, edges, x="x", y="y", at={"z": 0.5})

    shown = ~np.isnan(decode(result["x"]))
    z = full["coord_z"]
    assert 0 < shown.sum() < 1000
    assert np.array_equal(shown, np.abs(z - 0.5) <= (z.max() - z.min()) / 16)


def test_falls_back_to_the_first_two_axes_for_a_view_it_cannot_show(
    signed_in: TestClient,
) -> None:
    nodes, edges = in_domain()

    for view in ({"x": "x", "y": "x"}, {"x": "gone", "y": "y"}):
        assert viewed(signed_in, "a", nodes, edges, **view)["axes"] == ["x", "y"]


def test_needs_two_axes_to_preview(signed_in: TestClient) -> None:
    nodes, edges = in_domain(axes=[{"name": "x", "extent": [0, 1]}])
    body = {"node": "a", "nodes": nodes, "edges": edges}

    response = signed_in.post(NODES, json=body)

    assert response.status_code == 422
    assert "at least two axes" in response.json()["detail"]
