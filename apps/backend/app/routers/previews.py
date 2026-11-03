import base64
import json

import numpy as np
import scisynth.stages
from fastapi import APIRouter, HTTPException, status
from scisynth.core import Domain
from scisynth.latent.base import LatentGenerator
from scisynth.samplers import GridSampler

from app.auth import CurrentUser
from app.schemas import LatentPreview, PlotFigure, PreviewRequest, TypedArray

router = APIRouter(prefix="/previews", tags=["previews"])

PREVIEW_ERRORS = (KeyError, TypeError, ValueError, NotImplementedError)
LATENT_SHAPE = (64, 64)
LATENT_MAX_CELLS = 512 * 512


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


@router.post("/latents")
def preview_latent(body: PreviewRequest, user: CurrentUser) -> LatentPreview:
    domain = Domain.from_extents([(0.0, 1.0), (0.0, 1.0)])
    try:
        params = {**body.params, "domain": domain, "max_cells": LATENT_MAX_CELLS}
        generator = LatentGenerator.from_dict({"type": body.kind, "params": params})
        observation = GridSampler(LATENT_SHAPE).run(generator.realize(0), seed=0)
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
