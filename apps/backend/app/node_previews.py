import base64
from typing import cast

import numpy as np
from scisynth.core import Domain, Observation, registry
from scisynth.latent import (
    FieldLatent,
    GaussianField,
    LatentGenerator,
    Multichannel,
    Product,
    Sum,
    Threshold,
)
from scisynth.projection import Projection
from scisynth.samplers import GridSampler, PointSampler, Sampler
from scisynth.stages import Stage
from sklearn.decomposition import PCA
from sklearn.manifold import Isomap
from sklearn.random_projection import GaussianRandomProjection

from app.dataset_graph import NodeSpec
from app.schemas import NodePreview, NodePreviewRequest, TypedArray

PREVIEW_ERRORS = (KeyError, TypeError, ValueError, NotImplementedError)
LATENT_SHAPE = (64, 64)
LATENT_MAX_CELLS = 512 * 512
SAMPLE_MAX_CELLS = 256 * 256
POINTS_LIMIT = 10_000
ISOMAP_POINTS_LIMIT = 5_000
COUNT_LIMITS = {"GaussianBumps": ("bumps", 100), "VoronoiRegions": ("regions", 10_000)}
COMPOSITES = {"Sum": Sum, "Product": Product, "Multichannel": Multichannel}
PROJECTIONS = ("PCA", "UMAP", "Isomap", "GaussianRandomProjection")
LINEAR_PROJECTIONS = ("PCA", "GaussianRandomProjection")


def find_node(body: NodePreviewRequest, node_id: str) -> NodeSpec:
    node = next((n for n in body.nodes if n.id == node_id), None)
    if node is None:
        raise KeyError(f"Node {node_id} isn't part of the preview")
    return node


def inputs(body: NodePreviewRequest, node_id: str) -> list[str]:
    return [edge.source for edge in body.edges if edge.target == node_id]


def split_seed(node: NodeSpec) -> tuple[dict, int]:
    params = dict(node.params)
    seed = params.pop("seed", 0)
    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
        raise ValueError("seed must be a whole number of at least 0")
    return params, seed


def build_latent(
    body: NodePreviewRequest, node_id: str, path: tuple[str, ...]
) -> FieldLatent:
    if node_id in path:
        raise ValueError("The latent's inputs form a loop")
    node = find_node(body, node_id)
    terms = [
        build_latent(body, source, (*path, node_id)) for source in inputs(body, node_id)
    ]
    if node.kind == "Threshold":
        if len(terms) != 1:
            raise ValueError("Threshold needs one field connected")
        level = node.params.get("level", 0.0)
        if isinstance(level, bool) or not isinstance(level, int | float):
            raise ValueError("level must be a number")
        return Threshold(terms[0], float(level))
    if node.kind in COMPOSITES:
        return COMPOSITES[node.kind](*terms)
    params, seed = split_seed(node)
    if node.kind in COUNT_LIMITS:
        noun, limit = COUNT_LIMITS[node.kind]
        count = params.get("count")
        if isinstance(count, int) and count > limit:
            raise ValueError(
                f"Too many {noun} to preview: {count:,}, at most {limit:,}"
            )
    domain = Domain.from_extents([(0.0, 1.0), (0.0, 1.0)])
    generator = LatentGenerator.from_dict(
        {"type": node.kind, "params": {**params, "domain": domain}}
    )
    if isinstance(generator, GaussianField):
        generator.max_cells = LATENT_MAX_CELLS
    return cast(FieldLatent, generator.realize(seed))


def build_sampler(kind: str, params: dict) -> Sampler:
    sampler = Sampler.from_dict({"type": kind, "params": params})
    if isinstance(sampler, GridSampler):
        sampler.max_cells = SAMPLE_MAX_CELLS
    if (
        isinstance(sampler, PointSampler)
        and isinstance(sampler.n, int)
        and sampler.n > POINTS_LIMIT
    ):
        raise ValueError(
            f"Too many points to preview: {sampler.n:,}, at most {POINTS_LIMIT:,}"
        )
    return sampler


def only_input(body: NodePreviewRequest, node: NodeSpec) -> str:
    sources = inputs(body, node.id)
    if len(sources) != 1:
        raise ValueError(f"{node.kind} needs one input connected")
    return sources[0]


def build_observation(
    body: NodePreviewRequest, node_id: str, path: tuple[str, ...]
) -> Observation:
    if node_id in path:
        raise ValueError("The observation's inputs form a loop")
    node = find_node(body, node_id)
    component = registry.get(node.kind)
    source = only_input(body, node)
    if issubclass(component, Sampler):
        latent = build_latent(body, source, (*path, node_id))
        params, seed = split_seed(node)
        return build_sampler(node.kind, params).run(latent, seed=seed)
    if issubclass(component, Stage):
        before = build_observation(body, source, (*path, node_id))
        params, seed = split_seed(node)
        stage = Stage.from_dict({"type": node.kind, "params": params})
        return stage.run(before, seed=seed)
    raise TypeError(f"{node.kind} doesn't produce an observation")


def build_estimator(kind: str, params: dict, seed: int) -> object:
    if kind == "PCA":
        return PCA(n_components=2, random_state=seed, **params)
    if kind == "Isomap":
        return Isomap(n_components=2, **params)
    if kind == "GaussianRandomProjection":
        return GaussianRandomProjection(n_components=2, random_state=seed, **params)
    from umap import UMAP

    return UMAP(n_components=2, random_state=seed, n_jobs=1, **params)


def project(body: NodePreviewRequest, node: NodeSpec) -> Observation:
    before = build_observation(body, only_input(body, node), (node.id,))
    valid = int(before.mask.sum())
    limit = ISOMAP_POINTS_LIMIT if node.kind == "Isomap" else POINTS_LIMIT
    if valid > limit:
        raise ValueError(f"Too many locations to project: {valid:,}, at most {limit:,}")
    if node.kind in LINEAR_PROJECTIONS and before.n_channels < 2:
        raise ValueError(f"{node.kind} needs an observation with at least two channels")
    params, seed = split_seed(node)
    projection = Projection(build_estimator(node.kind, params, seed))
    return projection.fit(before).transform(before)


def observe(body: NodePreviewRequest) -> Observation:
    node = find_node(body, body.node)
    if node.kind in PROJECTIONS:
        return project(body, node)
    if node.kind in (*COMPOSITES, "Threshold") or issubclass(
        registry.get(node.kind), LatentGenerator
    ):
        return GridSampler(LATENT_SHAPE).run(build_latent(body, node.id, ()), seed=0)
    return build_observation(body, node.id, ())


def channel_values(observation: Observation) -> list[np.ndarray]:
    values = np.where(observation.valid, observation.values, np.nan)
    if observation.layout == "grid":
        return [values[..., i].T for i in range(observation.n_channels)]
    return [values[:, i] for i in range(observation.n_channels)]


def node_preview(observation: Observation, channels: list[np.ndarray]) -> NodePreview:
    if len(observation.coords) != 2:
        raise ValueError("Only 2-D observations can be previewed")
    x, y = observation.coords.values()
    if observation.layout == "points":
        x = np.where(observation.mask, x, np.nan)
        y = np.where(observation.mask, y, np.nan)
    return NodePreview(
        layout=observation.layout,
        axes=list(observation.coords),
        x=typed_array(x),
        y=typed_array(y),
        channels=[typed_array(values) for values in channels],
    )


def typed_array(values: np.ndarray) -> TypedArray:
    array = np.ascontiguousarray(values, dtype=np.float32)
    return TypedArray(
        dtype="f4",
        bdata=base64.b64encode(array.tobytes()).decode(),
        shape=", ".join(map(str, array.shape)),
    )
