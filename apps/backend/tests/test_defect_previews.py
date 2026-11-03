import numpy as np
from fastapi.testclient import TestClient

from tests.previews import NODES, decode, grid, grid_sampled, preview, stage


def test_previews_a_defect_applied_to_its_input(signed_in: TestClient) -> None:
    nodes, edges = grid_sampled()
    before = grid(preview(signed_in, "grid", nodes, edges))
    noise, link_noise = stage("noise", "GaussianNoise", "grid", sigma=0.5, mean=0)

    after = preview(signed_in, "noise", [*nodes, noise], [*edges, link_noise])

    assert after["layout"] == "grid"
    difference = grid(after) - before
    assert difference.shape == (16, 16)
    assert 0.3 < difference.std() < 0.7


def test_previews_chained_stages(signed_in: TestClient) -> None:
    nodes, edges = grid_sampled()
    before = grid(preview(signed_in, "grid", nodes, edges))
    gain, link_gain = stage("gain", "Gain", "grid", factor=2)
    offset, link_offset = stage("offset", "ValueOffset", "gain", value=1)

    after = preview(
        signed_in, "offset", [*nodes, gain, offset], [*edges, link_gain, link_offset]
    )

    assert np.allclose(grid(after), 2 * before + 1, atol=1e-5)


def test_dropped_locations_are_gaps_in_the_preview(signed_in: TestClient) -> None:
    nodes, edges = grid_sampled()
    dropout, link_dropout = stage("drop", "RandomDropout", "grid", p=0.5)

    values = grid(preview(signed_in, "drop", [*nodes, dropout], [*edges, link_dropout]))

    assert 0 < np.isnan(values).sum() < values.size


def test_a_defect_can_turn_a_grid_into_points(signed_in: TestClient) -> None:
    nodes, edges = grid_sampled()
    jitter, link_jitter = stage("jitter", "PositionJitter", "grid", sigma=0.01)

    result = preview(signed_in, "jitter", [*nodes, jitter], [*edges, link_jitter])

    assert result["layout"] == "points"
    assert decode(result["x"]).shape == grid(result).shape == (256,)


def test_rejects_a_defect_without_an_input(signed_in: TestClient) -> None:
    body = {"node": "s", "nodes": [{"id": "s", "kind": "GaussianNoise", "params": {}}]}

    response = signed_in.post(NODES, json=body)

    assert response.status_code == 422
    assert "needs one input connected" in response.json()["detail"]


def test_rejects_a_loop_of_defects(signed_in: TestClient) -> None:
    first, link_first = stage("s", "Gain", "t")
    second, link_second = stage("t", "Gain", "s")
    body = {"node": "s", "nodes": [first, second], "edges": [link_first, link_second]}

    response = signed_in.post(NODES, json=body)

    assert response.status_code == 422
    assert "form a loop" in response.json()["detail"]
