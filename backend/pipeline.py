"""scisynth behind the API: the node tables, the pipeline requests, and the cached builders that
run them (seeds are explicit, so equal requests give equal results)."""

import json
import math
from collections.abc import Mapping
from functools import lru_cache
from importlib import import_module
from typing import Any, Literal

import numpy as np
import scisynth
from fastapi import HTTPException, Response
from pydantic import BaseModel
from scisynth.viz import plot_observations

from expressions import lambda_function

# Defect node types -> (scisynth class, exposed parameters: name -> type). Parameters left out keep
# scisynth's defaults.
DEFECTS: dict[str, tuple[type[scisynth.Stage], dict[str, type]]] = {
    "randomDropout": (scisynth.RandomDropout, {"p": float}),
    "gaussianNoise": (scisynth.GaussianNoise, {"sigma": float, "mean": float}),
    "poissonNoise": (scisynth.PoissonNoise, {"scale": float}),
    "quantize": (scisynth.Quantize, {"levels": int, "vmin": float, "vmax": float}),
    "clip": (scisynth.Clip, {"lo": float, "hi": float}),
    "saturate": (scisynth.Saturate, {"ceiling": float}),
    "valueOffset": (scisynth.ValueOffset, {"value": float}),
    "gain": (scisynth.Gain, {"factor": float}),
    "drift": (scisynth.Drift, {"rate": float, "axis": str}),
    "coordinateShift": (scisynth.CoordinateShift, {"shift": float}),
    "positionJitter": (scisynth.PositionJitter, {"sigma": float}),  # needs points
    "randomInsertion": (scisynth.RandomInsertion, {"n": int}),  # needs points
    "downsample": (scisynth.Downsample, {"factor": int}),  # needs a grid
}


@lru_cache(maxsize=256)
def _preview_json(
    node_type: str, params: tuple[tuple[str, Any], ...], seed: int
) -> str:
    # deterministic: the demo signal is fixed and the seed explicit
    figure = DEFECTS[node_type][0](**dict(params)).preview(seed=seed, interactive=False)
    return figure.to_json()


def preview_response(node_type: str, raw_params: Mapping[str, Any]) -> Response:
    """A defect's preview (before / after on its demo signal) as a Plotly figure.

    Parameters (see ``DEFECTS``) are given by name; ``seed`` (default 0) sets the random draw."""
    if node_type not in DEFECTS:
        raise HTTPException(status_code=404, detail=f"No preview for {node_type!r}")
    allowed = DEFECTS[node_type][1]
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
    except ValueError as exc:  # scisynth rejecting a value
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return Response(content=body, media_type="application/json")


# Sampler node types -> scisynth classes (each takes one whole number)
SAMPLERS = {
    "gridSampler": scisynth.GridSampler,
    "pointSampler": scisynth.PointSampler,
}


class AxisSpec(BaseModel):
    name: str
    extent: tuple[float, float]
    unit: str = ""


class FieldSpec(BaseModel):
    """One field: the sum or product of `terms` (themselves fields) when `operation` is set, else an
    AnalyticField when `expression` is a lambda such as ``lambda x, y: 0.1 * x``, else a GaussianField
    (its parameters and random draw)."""

    field_params: dict[str, Any] = {}
    field_seed: int = 0
    expression: str | None = None
    operation: Literal["sum", "product"] | None = None
    terms: list["FieldSpec"] = []


class PlotRequest(FieldSpec):
    sampler: str  # a SAMPLERS key
    sampler_params: dict[str, int] = {}
    # the latent: the field this request's own FieldSpec fields describe, on these axes
    axes: list[AxisSpec]
    # a Multichannel instead: one field per channel (the fields above are then unused), mixed so each
    # pair of channels has this correlation
    channels: list[FieldSpec] = []
    correlation: float = 0.0
    seed: int = 0  # the sampler's, used only by a random one


class StageSpec(BaseModel):
    type: str  # a DEFECTS key
    params: dict[str, Any] = {}


class ObserverRequest(PlotRequest):
    """An Observer: the sampler, then the stages (defects) in order, run with `seed`."""

    stages: list[StageSpec] = []


class ProjectionSpec(BaseModel):
    method: str  # a PROJECTIONS key
    params: dict[str, Any] = {}
    seed: int = 0  # the estimator's random_state


class ProjectionRequest(ObserverRequest):
    """A Projection: the Observer's run, embedded in two dimensions."""

    projection: ProjectionSpec


MAX_CELLS = 20_000_000  # about 270 x 270 x 270; more would exhaust memory
MAX_FIELDS = 16  # each GaussianField (a channel, a term) is a realized field in memory


def _leaves(spec: FieldSpec) -> int:
    """How many fields are realized for `spec`."""
    return max(1, sum(map(_leaves, spec.terms))) if spec.operation else 1


def sampler_and_latent(req: PlotRequest) -> tuple[scisynth.Sampler, scisynth.Latent]:
    """The sampler and the field it samples, realized from the field's seed. scisynth refuses a field
    or grid over `MAX_CELLS` cells before allocating, which comes back as a 422."""
    domain = scisynth.Domain.from_extents(
        [a.extent for a in req.axes],
        names=[a.name for a in req.axes],
        units=[a.unit for a in req.axes],
    )
    def realized(spec: FieldSpec) -> scisynth.FieldLatent:
        if spec.operation:
            terms = [realized(t) for t in spec.terms]
            return (scisynth.Sum if spec.operation == "sum" else scisynth.Product)(*terms)
        if spec.expression is not None:
            return scisynth.AnalyticField(lambda_function(spec.expression, domain.ndim), domain)
        field = scisynth.GaussianField(domain, **{**spec.field_params, "max_cells": MAX_CELLS})
        return field.realize(spec.field_seed)

    fields = req.channels or [req]
    if sum(map(_leaves, fields)) > MAX_FIELDS:
        raise ValueError(f"at most {MAX_FIELDS} fields in one latent")
    sampler_params = dict(req.sampler_params)
    if req.sampler == "gridSampler":
        sampler_params["max_cells"] = MAX_CELLS
    sampler = SAMPLERS[req.sampler](**sampler_params)
    if not req.channels:
        return sampler, realized(req)
    corr = np.full((len(req.channels),) * 2, req.correlation)
    np.fill_diagonal(corr, 1.0)
    return sampler, scisynth.Multichannel(*map(realized, req.channels), corr=corr)


@lru_cache(maxsize=64)
def plot_json(request_json: str) -> str:
    req = PlotRequest.model_validate_json(request_json)
    sampler, latent = sampler_and_latent(req)
    return sampler.plot(latent, req.seed, interactive=False).to_json()


def sampler_response(build, req: PlotRequest, *args: Any) -> Response:
    """Run the cached `build` for a known sampler; scisynth rejecting the values is a 422."""
    if req.sampler not in SAMPLERS:
        raise HTTPException(status_code=404, detail=f"Unknown sampler {req.sampler!r}")
    try:
        body = build(req.model_dump_json(), *args)
    except (ValueError, TypeError, NotImplementedError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return Response(content=body, media_type="application/json")


DATA_ROWS = 50  # rows sent; the node shows the first few


MAX_POINTS = 5_000  # rows sent to plot them


def rows_json(obs: scisynth.Observation, limit: int) -> str:
    """The first `limit` rows of an observation: coordinates (empty with no position), then values (empty where invalid;
    `value`, or `value_1`, ... for several channels), and the total row count."""
    names = list(obs.coords)
    count = obs.size
    first = np.arange(min(count, limit))
    if obs.layout == "grid":  # one 1-D array per axis
        index = np.unravel_index(first, obs.spatial_shape)
        coords = [
            np.asarray(obs.coords[n])[i] for n, i in zip(names, index, strict=True)
        ]
    else:  # points: one array per axis, of the spatial shape
        coords = [np.asarray(obs.coords[n]).ravel()[first] for n in names]
    values = obs.values.reshape(count, obs.n_channels)[first]
    valid = obs.mask.ravel()[first]
    rows = [
        [float(c[i]) if math.isfinite(c[i]) else None for c in coords]
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


def observer_and_latent(req: ObserverRequest) -> tuple[scisynth.Observer, scisynth.Latent]:
    """The Observer (the sampler, then the stages) and the field it observes."""
    sampler, latent = sampler_and_latent(req)
    unknown = [s.type for s in req.stages if s.type not in DEFECTS]
    if unknown:
        raise ValueError(f"Unknown defect {unknown[0]!r}")
    stages = [DEFECTS[s.type][0](**s.params) for s in req.stages]
    return scisynth.Observer(sampler, stages), latent


@lru_cache(maxsize=64)
def observer_json(request_json: str, limit: int) -> str:
    req = ObserverRequest.model_validate_json(request_json)
    observer, latent = observer_and_latent(req)
    return rows_json(observer.run(latent, req.seed), limit)


@lru_cache(maxsize=64)
def observer_plot_json(request_json: str) -> str:
    """The latent, then each step's output, as panels."""
    req = ObserverRequest.model_validate_json(request_json)
    observer, latent = observer_and_latent(req)
    return observer.plot(latent, req.seed, interactive=False).to_json()


@lru_cache(maxsize=64)
def trace_plot_json(request_json: str) -> str:
    """The 3-D plot of an Observer's trace."""
    req = ObserverRequest.model_validate_json(request_json)
    observer, latent = observer_and_latent(req)
    return observer.plot(latent, req.seed, kind="layers").to_json()


# Projection methods -> (module, class, exposed parameters: name -> type). The embedding is always
# two-dimensional; the modules load only when one runs (umap takes seconds to import).
PROJECTIONS: dict[str, tuple[str, str, dict[str, type]]] = {
    "pca": ("sklearn.decomposition", "PCA", {}),
    "umap": ("umap", "UMAP", {"n_neighbors": int, "min_dist": float}),
}


def build_projection(spec: ProjectionSpec) -> scisynth.Projection:
    """An unfitted scisynth Projection around the method's estimator, in two dimensions."""
    if spec.method not in PROJECTIONS:
        raise ValueError(f"Unknown projection {spec.method!r}")
    module, name, allowed = PROJECTIONS[spec.method]
    unknown = [k for k in spec.params if k not in allowed]
    if unknown:
        raise ValueError(f"Unknown parameter {unknown[0]!r}")
    params = {k: allowed[k](v) for k, v in spec.params.items()}
    estimator = getattr(import_module(module), name)
    return scisynth.Projection(estimator(n_components=2, random_state=spec.seed, **params))


def projection_and_trace(req: ProjectionRequest) -> tuple[scisynth.Projection, scisynth.Trace]:
    """The Observer's trace, and the projection fitted on its first step (the clean samples)."""
    observer, latent = observer_and_latent(req)
    trace = observer.trace(latent, req.seed)
    return build_projection(req.projection).fit(trace[0]), trace


@lru_cache(maxsize=64)
def projection_json(request_json: str, limit: int) -> str:
    """The first rows of the last step in the embedding: its coordinates `c0` and `c1`, then values."""
    req = ProjectionRequest.model_validate_json(request_json)
    projection, trace = projection_and_trace(req)
    return rows_json(projection.transform(trace[-1]), limit)


@lru_cache(maxsize=64)
def projection_plot_json(request_json: str) -> str:
    """The last step in the embedding, as a scatter."""
    req = ProjectionRequest.model_validate_json(request_json)
    projection, trace = projection_and_trace(req)
    embedded = projection.transform(trace[-1])
    return plot_observations([embedded], [req.projection.method], interactive=False).to_json()
