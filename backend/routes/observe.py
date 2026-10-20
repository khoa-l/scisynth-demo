"""What a node shows: a defect's preview, a plot, or rows."""

from fastapi import APIRouter, Request, Response

from pipeline import (
    DATA_ROWS,
    ObserverRequest,
    PlotRequest,
    data_json,
    observer_json,
    observer_plot_json,
    plot_json,
    preview_response,
    sampler_response,
    trace_plot_json,
)

router = APIRouter(prefix="/api")


@router.get("/preview/{node_type}")
def preview(node_type: str, request: Request) -> Response:
    return preview_response(node_type, request.query_params)


@router.post("/plot")
def plot(req: PlotRequest) -> Response:
    """A sampler's plot on a GaussianField, as Plotly."""
    return sampler_response(plot_json, req)


@router.post("/data")
def data(req: PlotRequest) -> Response:
    """The first rows of what a sampler outputs: coordinates, then value (empty where invalid), and the row count."""
    return sampler_response(data_json, req, DATA_ROWS)


@router.post("/observer")
def observer(req: ObserverRequest) -> Response:
    """The first rows of an Observer's output (like ``data``)."""
    return sampler_response(observer_json, req, DATA_ROWS)


@router.post("/observer/plot")
def observer_plot(req: ObserverRequest) -> Response:
    """The latent, then each step's output, as panels."""
    return sampler_response(observer_plot_json, req)


@router.post("/trace/plot")
def trace_plot(req: ObserverRequest) -> Response:
    """An Observer's trace in one 3-D view."""
    return sampler_response(trace_plot_json, req)
