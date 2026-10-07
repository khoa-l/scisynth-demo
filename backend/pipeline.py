"""obskit behind the API: the nodes' defects and samplers, the requests that describe a pipeline, and
the cached builders that run them (the same request always gives the same result: seeds are
explicit)."""

import json
import math
from collections.abc import Mapping
from functools import lru_cache
from typing import Any

import numpy as np
import obskit
from fastapi import HTTPException, Response
from pydantic import BaseModel

# Defect node types -> obskit classes (all constructible with their default parameters)
DEFECTS = {
    "randomDropout": obskit.RandomDropout,
    "gaussianNoise": obskit.GaussianNoise,
    "poissonNoise": obskit.PoissonNoise,
    "quantize": obskit.Quantize,
    "clip": obskit.Clip,
    "saturate": obskit.Saturate,
    "valueOffset": obskit.ValueOffset,
    "gain": obskit.Gain,
    "drift": obskit.Drift,
    "coordinateShift": obskit.CoordinateShift,
}


# Parameters a defect node exposes, as query parameters of its preview (name -> type).
# Optional ones (obskit default None) are simply left out of the query when unset.
DEFECT_PARAMS: dict[str, dict[str, type]] = {
    "randomDropout": {"p": float},
    "gaussianNoise": {"sigma": float, "mean": float},
    "poissonNoise": {"scale": float},
    "quantize": {"levels": int, "vmin": float, "vmax": float},
    "clip": {"lo": float, "hi": float},
    "saturate": {"ceiling": float},
    "valueOffset": {"value": float},
    "gain": {"factor": float},
    "drift": {"rate": float, "axis": str},
    "coordinateShift": {"shift": float},
}


@lru_cache(maxsize=256)
def _preview_json(
    node_type: str, params: tuple[tuple[str, Any], ...], seed: int
) -> str:
    # Deterministic (the demo signal is fixed and the seed is explicit), so equal inputs
    # give equal figures
    figure = DEFECTS[node_type](**dict(params)).preview(seed=seed, interactive=False)
    return figure.to_json()


def preview_response(node_type: str, raw_params: Mapping[str, Any]) -> Response:
    """A defect's preview plot (before / after on its demo signal) as a Plotly figure.

    The defect's parameters (see ``DEFECT_PARAMS``) are given by name; any left out keep
    obskit's defaults. ``seed`` (a non-negative integer, default 0) sets the random draw, so
    the same seed always gives the same preview.
    """
    if node_type not in DEFECTS:
        raise HTTPException(status_code=404, detail=f"No preview for {node_type!r}")
    allowed = DEFECT_PARAMS.get(node_type, {})
    params: dict[str, Any] = {}
    seed = 0
    for name, raw in raw_params.items():
        if name == "seed":
            try:
                seed = int(raw)
            except ValueError:
                raise HTTPException(
                    status_code=422, detail=f"Invalid value for 'seed': {raw!r}"
                ) from None
            continue
        if name not in allowed:
            raise HTTPException(status_code=422, detail=f"Unknown parameter {name!r}")
        try:
            value = allowed[name](raw)
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(raw)
        except ValueError:
            raise HTTPException(
                status_code=422, detail=f"Invalid value for {name!r}: {raw!r}"
            ) from None
        params[name] = value
    try:
        body = _preview_json(node_type, tuple(sorted(params.items())), seed)
    except (
        ValueError
    ) as exc:  # obskit rejecting a value (e.g. p outside [0, 1], seed < 0)
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return Response(content=body, media_type="application/json")


# Sampler node types -> obskit classes (each takes one whole number: a shape, a count)
SAMPLERS = {
    "gridSampler": obskit.GridSampler,
    "pointSampler": obskit.PointSampler,
}


class AxisSpec(BaseModel):
    name: str
    extent: tuple[float, float]
    unit: str = ""


class PlotRequest(BaseModel):
    sampler: str  # a SAMPLERS key
    sampler_params: dict[str, int] = {}
    # the latent is a GaussianField on a Domain (the only field the nodes can describe so far)
    axes: list[AxisSpec]
    field_params: dict[str, Any] = {}
    field_seed: int = 0  # the field's random draw
    seed: int = 0  # the sampler's (only a random sampler, like PointSampler, uses it)


class StageSpec(BaseModel):
    type: str  # a DEFECTS key
    params: dict[str, Any] = {}


class ObserverRequest(PlotRequest):
    """An Observer: the sampler, then the stages (defects) in order, run with `seed`."""

    stages: list[StageSpec] = []


MAX_CELLS = 20_000_000  # about 270 x 270 x 270; more than this would exhaust memory


def sampler_and_latent(req: PlotRequest):
    """The sampler, and the field it samples realized from its own seed (seeds are explicit, so
    equal requests give equal results). obskit refuses a field or grid over `MAX_CELLS` cells before
    allocating (a field on 5 axes at 128 each is 34 billion), which comes back as a 422."""
    domain = obskit.Domain.from_extents(
        [a.extent for a in req.axes],
        names=[a.name for a in req.axes],
        units=[a.unit for a in req.axes],
    )
    field = obskit.GaussianField(domain, **{**req.field_params, "max_cells": MAX_CELLS})
    sampler_params = dict(req.sampler_params)
    if req.sampler == "gridSampler":
        sampler_params["max_cells"] = MAX_CELLS
    return SAMPLERS[req.sampler](**sampler_params), field.realize(req.field_seed)


@lru_cache(maxsize=64)
def plot_json(request_json: str) -> str:
    req = PlotRequest.model_validate_json(request_json)
    sampler, latent = sampler_and_latent(req)
    return sampler.plot(latent, req.seed, interactive=False).to_json()


def sampler_response(build, req: PlotRequest, *args: Any) -> Response:
    """Run `build` (a cached function of the request, and any `args`) for a known sampler; obskit
    rejecting the values is the caller's 422."""
    if req.sampler not in SAMPLERS:
        raise HTTPException(status_code=404, detail=f"Unknown sampler {req.sampler!r}")
    try:
        body = build(req.model_dump_json(), *args)
    except (ValueError, TypeError, NotImplementedError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return Response(content=body, media_type="application/json")


DATA_ROWS = 50  # how many rows are sent; the node shows the first few of them


MAX_POINTS = 5_000  # how many are sent when a component needs them all (to plot them)


def rows_json(obs: obskit.Observation, limit: int) -> str:
    """The first `limit` rows of an observation, one per location: its coordinates, then its values
    (empty where invalid; a column `value`, or `value_1`, `value_2`... for several channels), and
    how many rows there are in all."""
    names = list(obs.coords)
    count = int(np.prod(obs.spatial_shape))
    first = np.arange(min(count, limit))
    if obs.layout == "grid":  # one 1-D coordinate array per axis: row i is a grid point
        index = np.unravel_index(first, obs.spatial_shape)
        coords = [
            np.asarray(obs.coords[n])[i] for n, i in zip(names, index, strict=True)
        ]
    else:  # points: every coordinate array has the spatial shape
        coords = [np.asarray(obs.coords[n]).ravel()[first] for n in names]
    values = obs.values.reshape(count, obs.n_channels)[first]
    valid = obs.mask.ravel()[first]
    rows = [
        [float(c[i]) for c in coords]
        + [float(v) if valid[i] else None for v in values[i]]
        for i in range(first.size)
    ]
    channels = (
        ["value"]
        if obs.n_channels == 1
        else [f"value_{k + 1}" for k in range(obs.n_channels)]
    )
    return json.dumps({"columns": [*names, *channels], "rowCount": count, "rows": rows})


@lru_cache(maxsize=64)
def data_json(request_json: str, limit: int) -> str:
    req = PlotRequest.model_validate_json(request_json)
    sampler, latent = sampler_and_latent(req)
    return rows_json(sampler.run(latent, req.seed), limit)


@lru_cache(maxsize=64)
def observer_json(request_json: str, limit: int) -> str:
    req = ObserverRequest.model_validate_json(request_json)
    sampler, latent = sampler_and_latent(req)
    unknown = [s.type for s in req.stages if s.type not in DEFECTS]
    if unknown:
        raise ValueError(f"Unknown defect {unknown[0]!r}")
    stages = [DEFECTS[s.type](**s.params) for s in req.stages]
    return rows_json(obskit.Observer(sampler, stages).run(latent, req.seed), limit)
