import base64
from typing import cast

import numpy as np
from scisynth.core import Axis, Domain, Observation, registry
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
from app.schemas import (
    AxisRange,
    NodePreview,
    NodePreviewRequest,
    PreviewView,
    TypedArray,
)

PREVIEW_ERRORS = (KeyError, TypeError, ValueError, NotImplementedError)
LATENT_SIDE = 64
LATENT_MAX_SAMPLES = 64**3
LATENT_MAX_CELLS = 128**3
SAMPLE_MAX_CELLS = 64**3
POINTS_LIMIT = 10_000
FIT_POINTS = 10_000
ISOMAP_FIT_POINTS = 5_000
TRANSFORM_LIMITS = {"UMAP": 20_000, "Isomap": 20_000}
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
    return [
        edge.source
        for edge in body.edges
        if edge.target == node_id and edge.target_port != "domain"
    ]


def domain_of(body: NodePreviewRequest, node_id: str) -> Domain:
    for edge in body.edges:
        if edge.target == node_id and edge.target_port == "domain":
            axes = find_node(body, edge.source).params.get("axes")
            if isinstance(axes, list):
                return Domain([Axis(axis.name, axis.extent) for axis in axes])
    return Domain.from_extents([(0.0, 1.0), (0.0, 1.0)])


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
    generator = LatentGenerator.from_dict(
        {"type": node.kind, "params": {**params, "domain": domain_of(body, node_id)}}
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


def fit_sample(observation: Observation, limit: int, seed: int) -> Observation:
    valid = np.flatnonzero(observation.mask)
    if len(valid) <= limit:
        return observation
    keep = np.zeros(observation.mask.size, dtype=bool)
    keep[np.random.default_rng(seed).choice(valid, limit, replace=False)] = True
    keep = keep.reshape(observation.mask.shape)
    values = np.where(keep[..., None], observation.values, np.nan)
    return Observation(values, observation.coords, keep)


def project(body: NodePreviewRequest, node: NodeSpec) -> Observation:
    before = build_observation(body, only_input(body, node), (node.id,))
    valid = int(before.mask.sum())
    limit = TRANSFORM_LIMITS.get(node.kind)
    if limit and valid > limit:
        raise ValueError(
            f"Too many locations to project with {node.kind}: {valid:,}, "
            f"at most {limit:,}"
        )
    if node.kind in LINEAR_PROJECTIONS and before.n_channels < 2:
        raise ValueError(f"{node.kind} needs an observation with at least two channels")
    params, seed = split_seed(node)
    projection = Projection(build_estimator(node.kind, params, seed))
    fit_points = ISOMAP_FIT_POINTS if node.kind == "Isomap" else FIT_POINTS
    return projection.fit(fit_sample(before, fit_points, seed)).transform(before)


def observe(body: NodePreviewRequest) -> Observation:
    node = find_node(body, body.node)
    if node.kind in PROJECTIONS:
        return project(body, node)
    if node.kind in (*COMPOSITES, "Threshold") or issubclass(
        registry.get(node.kind), LatentGenerator
    ):
        latent = build_latent(body, node.id, ())
        side = min(LATENT_SIDE, round(LATENT_MAX_SAMPLES ** (1 / latent.domain.ndim)))
        return GridSampler(side).run(latent, seed=0)
    return build_observation(body, node.id, ())


def axis_ranges(observation: Observation) -> list[AxisRange]:
    return [
        AxisRange(
            name=name, start=float(np.nanmin(values)), end=float(np.nanmax(values))
        )
        for name, values in observation.coords.items()
    ]


def sliced(observation: Observation, view: PreviewView | None) -> Observation:
    names = list(observation.coords)
    if len(names) < 2:
        raise ValueError("Previews need a domain with at least two axes")
    x, y = names[:2]
    if view and view.x in names and view.y in names and view.x != view.y:
        x, y = view.x, view.y
    ranges = {axis.name: axis for axis in axis_ranges(observation)}

    def at(name: str) -> float:
        middle = (ranges[name].start + ranges[name].end) / 2
        return view.at.get(name, middle) if view else middle

    hidden = [name for name in names if name not in (x, y)]
    coords = {x: observation.coords[x], y: observation.coords[y]}
    if observation.layout == "grid":
        index = tuple(
            int(np.abs(observation.coords[name] - at(name)).argmin())
            if name in hidden
            else slice(None)
            for name in names
        )
        values, mask = observation.values[index], observation.mask[index]
        if names.index(x) > names.index(y):
            values, mask = values.swapaxes(0, 1), mask.T
        return Observation(values, coords, mask)
    mask = observation.mask.copy()
    for name in hidden:
        band = (ranges[name].end - ranges[name].start) / 16
        mask &= np.abs(observation.coords[name] - at(name)) <= band
    return Observation(
        np.where(mask[:, None], observation.values, np.nan), coords, mask
    )


def channel_values(observation: Observation) -> list[np.ndarray]:
    values = np.where(observation.valid, observation.values, np.nan)
    if observation.layout == "grid":
        return [values[..., i].T for i in range(observation.n_channels)]
    return [values[:, i] for i in range(observation.n_channels)]


def node_preview(observation: Observation, channels: list[np.ndarray]) -> NodePreview:
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
