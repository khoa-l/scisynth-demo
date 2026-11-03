import numpy as np
import pytest
from fastapi.testclient import TestClient
from sklearn.decomposition import PCA

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
    stage,
)


def projected(kind: str, shape: int = 16, **params: object) -> tuple[list, list]:
    nodes = [field("a", seed=1), field("b", seed=2), composite("field", "Multichannel")]
    nodes += [sampler("grid", "GridSampler", shape=shape)]
    edges = [link("a", "field", "channels"), link("b", "field", "channels")]
    edges += [sampled("grid")]
    projection, link_projection = stage("p", kind, "grid", **params)
    return [*nodes, projection], [*edges, link_projection]


def test_previews_pca_as_points_placed_by_their_channels(signed_in: TestClient) -> None:
    nodes, edges = projected("PCA")
    channels = preview(signed_in, "grid", nodes[:-1], edges[:-1])["channels"]
    values = np.stack([decode(c).T.ravel() for c in channels], axis=1)

    result = preview(signed_in, "p", nodes, edges)

    assert result["layout"] == "points"
    assert result["axes"] == ["c0", "c1"]
    assert [grid(result, i).shape for i in range(2)] == [(256,), (256,)]
    assert np.allclose(np.stack([grid(result, 0), grid(result, 1)], 1), values)
    expected = PCA(n_components=2, random_state=0).fit_transform(values)
    embedded = np.stack([decode(result["x"]), decode(result["y"])], axis=1)
    assert np.allclose(np.abs(embedded), np.abs(expected), atol=1e-4)


def test_previews_umap_and_follows_its_seed(signed_in: TestClient) -> None:
    def embedding(seed: int) -> np.ndarray:
        nodes, edges = projected("UMAP", shape=8, n_neighbors=10, seed=seed)
        result = preview(signed_in, "p", nodes, edges)
        assert result["layout"] == "points"
        return np.stack([decode(result["x"]), decode(result["y"])], axis=1)

    first = embedding(1)
    assert first.shape == (64, 2)
    assert np.isfinite(first).all()
    assert np.array_equal(first, embedding(1))
    assert not np.array_equal(first, embedding(2))


def test_dropped_locations_have_no_place_in_the_projection(
    signed_in: TestClient,
) -> None:
    nodes, edges = projected("PCA")
    dropout, link_dropout = stage("drop", "RandomDropout", "grid", p=0.5)
    projection = {**nodes[-1]}
    to_projection = {**edges[-1], "id": "drop-p", "source": "drop"}

    result = preview(
        signed_in,
        "p",
        [*nodes[:-1], dropout, projection],
        [*edges[:-1], link_dropout, to_projection],
    )

    assert 0 < np.isnan(decode(result["x"])).sum() < 256


@pytest.mark.parametrize(
    ("nodes", "edges", "message"),
    [
        (*projected("PCA", shape=128), "Too many locations to project"),
        (
            [
                field("field"),
                sampler("grid", "GridSampler", shape=8),
                stage("p", "PCA", "grid")[0],
            ],
            [sampled("grid"), stage("p", "PCA", "grid")[1]],
            "PCA needs an observation with at least two channels",
        ),
        ([stage("p", "UMAP", "grid")[0]], [], "needs one input connected"),
        (*projected("UMAP", shape=8, n_neighbours=10), "n_neighbours"),
    ],
)
def test_rejects_projections_it_cannot_preview(
    signed_in: TestClient, nodes: list, edges: list, message: str
) -> None:
    response = signed_in.post(NODES, json={"node": "p", "nodes": nodes, "edges": edges})

    assert response.status_code == 422
    assert message in response.json()["detail"]
