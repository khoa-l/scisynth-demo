import base64
import json
from typing import cast

import numpy as np
import scisynth.stages
from fastapi import APIRouter, HTTPException, status
from scisynth.core import Domain
from scisynth.latent import FieldLatent, LatentGenerator, Multichannel, Product, Sum
from scisynth.samplers import GridSampler

from app.auth import CurrentUser
from app.schemas import (
    LatentPreview,
    LatentPreviewRequest,
    PlotFigure,
    PreviewRequest,
    TypedArray,
)

router = APIRouter(prefix="/previews", tags=["previews"])

PREVIEW_ERRORS = (KeyError, TypeError, ValueError, NotImplementedError)
LATENT_SHAPE = (64, 64)
LATENT_MAX_CELLS = 512 * 512
COMPOSITES = {"Sum": Sum, "Product": Product, "Multichannel": Multichannel}


def invalid(exc: Exception) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


@router.post("/stages")
def preview_stage(body: PreviewRequest, user: CurrentUser) -> PlotFigure:
    try:
        stage = scisynth.stages.Stage.from_dict(
            {"type": body.kind, "params": body.params}
        )
        figure = stage.preview()
    except PREVIEW_ERRORS as exc:
        raise invalid(exc) from exc
    return PlotFigure.model_validate(json.loads(figure.to_json()))


def build_latent(
    body: LatentPreviewRequest, node_id: str, path: tuple[str, ...]
) -> FieldLatent:
    if node_id in path:
        raise ValueError("The latent's inputs form a loop")
    node = next((n for n in body.nodes if n.id == node_id), None)
    if node is None:
        raise KeyError(f"Node {node_id} isn't part of the preview")
    terms = [
        build_latent(body, edge.source, (*path, node_id))
        for edge in body.edges
        if edge.target == node_id
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


@router.post("/latents")
def preview_latent(body: LatentPreviewRequest, user: CurrentUser) -> LatentPreview:
    try:
        latent = build_latent(body, body.node, ())
        observation = GridSampler(LATENT_SHAPE).run(latent, seed=0)
    except PREVIEW_ERRORS as exc:
        raise invalid(exc) from exc
    x, y = observation.coords.values()
    z = np.ascontiguousarray(observation.values[..., 0].T, dtype=np.float32)
    return LatentPreview(
        x=x.tolist(),
        y=y.tolist(),
        z=TypedArray(
            dtype="f4",
            bdata=base64.b64encode(z.tobytes()).decode(),
            shape=", ".join(map(str, z.shape)),
        ),
    )
