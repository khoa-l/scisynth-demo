import numpy as np
from fastapi.testclient import TestClient

from tests.previews import (
    decode,
    field,
    grid,
    grid_sampled,
    preview,
    sampled,
    sampler,
    stage,
)


def test_previews_a_downsampled_grid_at_its_reduced_size(signed_in: TestClient) -> None:
    nodes, edges = grid_sampled()
    before = grid(preview(signed_in, "grid", nodes, edges))
    down, link_down = stage("down", "Downsample", "grid", factor=4)

    after = preview(signed_in, "down", [*nodes, down], [*edges, link_down])

    assert after["layout"] == "grid"
    assert grid(after).shape == (4, 4)
    assert len(decode(after["x"])) == len(decode(after["y"])) == 4
    blocks = before.reshape(4, 4, 4, 4).mean(axis=(1, 3))
    assert np.allclose(grid(after), blocks, atol=1e-5)


def test_previews_downsampled_points_as_fewer_points(signed_in: TestClient) -> None:
    nodes = [field("field"), sampler("points", "PointSampler", n=400)]
    down, link_down = stage("down", "Downsample", "points", factor=2)

    after = preview(signed_in, "down", [*nodes, down], [sampled("points"), link_down])

    assert after["layout"] == "points"
    assert 0 < len(decode(after["x"])) < 400
