import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.previews import NODES, composite, decode, field, grid, link, preview


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
