import base64
import json
from typing import cast

import numpy as np
from fastapi import APIRouter, HTTPException, status
from scisynth.core import Domain, Observation, registry
from scisynth.latent import FieldLatent, LatentGenerator, Multichannel, Product, Sum
from scisynth.samplers import GridSampler, PointSampler, Sampler
from scisynth.stages import Stage

from app.auth import CurrentUser
from app.dataset_graph import NodeSpec
from app.schemas import (
    NodePreview,
    NodePreviewRequest,
    PlotFigure,
    StagePreviewRequest,
    TypedArray,
)

router = APIRouter(prefix="/previews", tags=["previews"])

PREVIEW_ERRORS = (KeyError, TypeError, ValueError, NotImplementedError)
LATENT_SHAPE = (64, 64)
LATENT_MAX_CELLS = 512 * 512
SAMPLE_MAX_CELLS = 256 * 256
POINTS_LIMIT = 10_000
COMPOSITES = {"Sum": Sum, "Product": Product, "Multichannel": Multichannel}


def invalid(exc: Exception) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


@router.post("/stages")
def preview_stage(body: StagePreviewRequest, user: CurrentUser) -> PlotFigure:
    try:
        stage = Stage.from_dict({"type": body.kind, "params": body.params})
        figure = stage.preview()
    except PREVIEW_ERRORS as exc:
        raise invalid(exc) from exc
    return PlotFigure.model_validate(json.loads(figure.to_json()))


def find_node(body: NodePreviewRequest, node_id: str) -> NodeSpec:
    node = next((n for n in body.nodes if n.id == node_id), None)
    if node is None:
        raise KeyError(f"Node {node_id} isn't part of the preview")
    return node


def inputs(body: NodePreviewRequest, node_id: str) -> list[str]:
    return [edge.source for edge in body.edges if edge.target == node_id]


def build_latent(
    body: NodePreviewRequest, node_id: str, path: tuple[str, ...]
) -> FieldLatent:
    if node_id in path:
        raise ValueError("The latent's inputs form a loop")
    node = find_node(body, node_id)
    terms = [
        build_latent(body, source, (*path, node_id)) for source in inputs(body, node_id)
    ]
    if node.kind in COMPOSITES:
        return COMPOSITES[node.kind](*terms)
    params = dict(node.params)
    seed = params.pop("seed", 0)
    if not isinstance(seed, int) or seed < 0:
        raise ValueError("seed must be a whole number of at least 0")
    domain = Domain.from_extents([(0.0, 1.0), (0.0, 1.0)])
    generator = LatentGenerator.from_dict(
        {
            "type": node.kind,
            "params": {**params, "domain": domain, "max_cells": LATENT_MAX_CELLS},
        }
    )
    return cast(FieldLatent, generator.realize(seed))


def build_sampler(node: NodeSpec) -> Sampler:
    sampler = Sampler.from_dict({"type": node.kind, "params": node.params})
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
        return build_sampler(node).run(latent, seed=0)
    if issubclass(component, Stage):
        before = build_observation(body, source, (*path, node_id))
        return Stage.from_dict({"type": node.kind, "params": node.params}).run(
            before, seed=0
        )
    raise TypeError(f"{node.kind} doesn't produce an observation")


def observe(body: NodePreviewRequest) -> Observation:
    node = find_node(body, body.node)
    if node.kind in COMPOSITES or issubclass(registry.get(node.kind), LatentGenerator):
        return GridSampler(LATENT_SHAPE).run(build_latent(body, node.id, ()), seed=0)
    return build_observation(body, node.id, ())


@router.post("/nodes")
def preview_node(body: NodePreviewRequest, user: CurrentUser) -> NodePreview:
    try:
        observation = observe(body)
        if len(observation.coords) != 2:
            raise ValueError("Only 2-D observations can be previewed")
    except PREVIEW_ERRORS as exc:
        raise invalid(exc) from exc
    x, y = observation.coords.values()
    values = np.where(observation.valid, observation.values, np.nan)
    if observation.layout == "grid":
        channels = [
            typed_array(values[..., i].T) for i in range(observation.n_channels)
        ]
    else:
        x = np.where(observation.mask, x, np.nan)
        y = np.where(observation.mask, y, np.nan)
        channels = [typed_array(values[:, i]) for i in range(observation.n_channels)]
    return NodePreview(
        layout=observation.layout,
        x=typed_array(x),
        y=typed_array(y),
        channels=channels,
    )


def typed_array(values: np.ndarray) -> TypedArray:
    array = np.ascontiguousarray(values, dtype=np.float32)
    return TypedArray(
        dtype="f4",
        bdata=base64.b64encode(array.tobytes()).decode(),
        shape=", ".join(map(str, array.shape)),
    )
