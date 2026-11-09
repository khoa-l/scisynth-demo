import numpy as np
import pytest
from fastapi.testclient import TestClient
from sklearn.decomposition import PCA
from sklearn.manifold import Isomap
from sklearn.random_projection import GaussianRandomProjection

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


def channel_values(client: TestClient, nodes: list, edges: list) -> np.ndarray:
    channels = preview(client, "grid", nodes[:-1], edges[:-1])["channels"]
    return np.stack([decode(c).T.ravel() for c in channels], axis=1)


def embedded(result: dict) -> np.ndarray:
    return np.stack([decode(result["x"]), decode(result["y"])], axis=1)


def test_previews_pca_as_points_placed_by_their_channels(signed_in: TestClient) -> None:
    nodes, edges = projected("PCA")
    values = channel_values(signed_in, nodes, edges)

    result = preview(signed_in, "p", nodes, edges)

    assert result["layout"] == "points"
    assert result["axes"] == ["c0", "c1"]
    assert [grid(result, i).shape for i in range(2)] == [(256,), (256,)]
    assert np.allclose(np.stack([grid(result, 0), grid(result, 1)], 1), values)
    expected = PCA(n_components=2, random_state=0).fit_transform(values)
    assert np.allclose(np.abs(embedded(result)), np.abs(expected), atol=1e-4)


def test_pca_preview_follows_its_options(signed_in: TestClient) -> None:
    nodes, edges = projected("PCA")
    values = channel_values(signed_in, nodes, edges)

    def embedding(whiten: bool, svd_solver: str = "auto") -> np.ndarray:
        nodes, edges = projected("PCA", whiten=whiten, svd_solver=svd_solver)
        return embedded(preview(signed_in, "p", nodes, edges))

    whitened = embedding(whiten=True, svd_solver="full")
    expected = PCA(n_components=2, whiten=True, svd_solver="full").fit_transform(values)
    assert np.allclose(np.abs(whitened), np.abs(expected), atol=1e-3)
    assert np.allclose(whitened.std(axis=0), 1, atol=1e-2)
    assert not np.allclose(np.abs(embedding(whiten=False)), np.abs(whitened))


def test_previews_umap_and_follows_its_seed(signed_in: TestClient) -> None:
    def embedding(seed: int) -> np.ndarray:
        nodes, edges = projected("UMAP", shape=8, n_neighbors=10, seed=seed)
        result = preview(signed_in, "p", nodes, edges)
        assert result["layout"] == "points"
        return embedded(result)

    first = embedding(1)
    assert first.shape == (64, 2)
    assert np.isfinite(first).all()
    assert np.array_equal(first, embedding(1))
    assert not np.array_equal(first, embedding(2))


def test_previews_isomap_with_its_neighbours(signed_in: TestClient) -> None:
    values = channel_values(signed_in, *projected("Isomap"))

    def embedding(n_neighbors: int) -> np.ndarray:
        nodes, edges = projected("Isomap", n_neighbors=n_neighbors)
        result = embedded(preview(signed_in, "p", nodes, edges))
        expected = Isomap(n_components=2, n_neighbors=n_neighbors).fit_transform(values)
        assert np.allclose(np.abs(result), np.abs(expected), atol=1e-4)
        return result

    assert not np.allclose(np.abs(embedding(5)), np.abs(embedding(20)))


def test_previews_a_random_gaussian_projection_from_its_seed(
    signed_in: TestClient,
) -> None:
    values = channel_values(signed_in, *projected("GaussianRandomProjection"))

    def embedding(seed: int) -> np.ndarray:
        nodes, edges = projected("GaussianRandomProjection", seed=seed)
        result = embedded(preview(signed_in, "p", nodes, edges))
        projection = GaussianRandomProjection(n_components=2, random_state=seed)
        assert np.allclose(result, projection.fit_transform(values), atol=1e-4)
        return result

    assert not np.allclose(embedding(1), embedding(2))


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
        (
            [
                field("field"),
                sampler("grid", "GridSampler", shape=8),
                stage("p", "GaussianRandomProjection", "grid")[0],
            ],
            [sampled("grid"), stage("p", "GaussianRandomProjection", "grid")[1]],
            "GaussianRandomProjection needs an observation with at least two channels",
        ),
        (*projected("Isomap", shape=71), "at most 5,000"),
        ([stage("p", "UMAP", "grid")[0]], [], "needs one input connected"),
        (*projected("UMAP", shape=8, n_neighbours=10), "n_neighbours"),
        (*projected("PCA", svd_solver="fastest"), "svd_solver"),
        (*projected("PCA", seed=True), "seed must be"),
    ],
)
def test_rejects_projections_it_cannot_preview(
    signed_in: TestClient, nodes: list, edges: list, message: str
) -> None:
    response = signed_in.post(NODES, json={"node": "p", "nodes": nodes, "edges": edges})

    assert response.status_code == 422
    assert message in response.json()["detail"]
