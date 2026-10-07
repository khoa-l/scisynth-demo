"""What a node shows: a defect's preview, a sampler's plot, and the rows of a sampler or Observer."""

from fastapi import APIRouter, Request, Response

from pipeline import (
    DATA_ROWS,
    ObserverRequest,
    PlotRequest,
    data_json,
    observer_json,
    plot_json,
    preview_response,
    sampler_response,
)

router = APIRouter(prefix="/api")


@router.get("/preview/{node_type}")
def preview(node_type: str, request: Request) -> Response:
    return preview_response(node_type, request.query_params)


@router.post("/plot")
def plot(req: PlotRequest) -> Response:
    """A sampler's plot: the sampler applied to a GaussianField on the given axes, as Plotly."""
    return sampler_response(plot_json, req)


@router.post("/data")
def data(req: PlotRequest) -> Response:
    """The first rows of what a sampler outputs on the given field: its coordinates, then its
    value (empty where the sample is invalid), and how many rows there are in all."""
    return sampler_response(data_json, req, DATA_ROWS)


@router.post("/observer")
def observer(req: ObserverRequest) -> Response:
    """The first rows of an Observer's output: the sampler and then the stages, on the given field
    (the same rows as ``data``)."""
    return sampler_response(observer_json, req, DATA_ROWS)
