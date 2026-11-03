import pytest
from fastapi.testclient import TestClient

from tests.previews import NODES, decode, field, grid, preview, sampled, sampler


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
