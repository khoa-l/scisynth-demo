"""What a task's components show: the copy of a source each one keeps.

A component holds a copy of the request that made its source (`data.source.request`, saved with the
task), and these run it. They take only the task and the component, never a request, so what a
component can show is only what was copied into it."""

from fastapi import APIRouter, HTTPException, Response

from db import db, task_components
from pipeline import (
    DATA_ROWS,
    MAX_POINTS,
    ObserverRequest,
    PlotRequest,
    data_json,
    observer_json,
    observer_plot_json,
    plot_json,
    preview_response,
    sampler_response,
)

router = APIRouter(prefix="/api")


def _copied_request(task_id: int, uid: int, kinds: tuple[str, ...]) -> dict:
    with db() as conn:
        components = task_components(conn, task_id)
    component = next((c for c in components if c["uid"] == uid), None)
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")
    source = component["data"].get("source")
    if not source:
        raise HTTPException(status_code=404, detail="The component has no source")
    request = source["request"]
    if request["kind"] not in kinds:
        raise HTTPException(
            status_code=422, detail=f"A {request['kind']} source cannot be shown here"
        )
    return request


def _run(request: dict, limit: int) -> Response:
    """Run a copied request the way its own endpoint (see ``observe``) would."""
    if request["kind"] == "preview":
        query = {k: str(v) for k, v in request.get("query", {}).items()}
        return preview_response(request["type"], query)
    observer = request["type"] == "observer"  # an Observer, or a Plot of one
    model = ObserverRequest if observer else PlotRequest
    try:
        req = model.model_validate(request["body"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    if request["kind"] == "plot":
        return sampler_response(observer_plot_json if observer else plot_json, req)
    return sampler_response(observer_json if observer else data_json, req, limit)


@router.get("/tasks/{task_id}/components/{uid}/data")
def component_data(task_id: int, uid: int) -> Response:
    """The first rows of the Data node or Observer a component copied (see ``data``, ``observer``)."""
    return _run(_copied_request(task_id, uid, ("data", "observer")), DATA_ROWS)


@router.get("/tasks/{task_id}/components/{uid}/points")
def component_points(task_id: int, uid: int) -> Response:
    """The same rows, up to ``MAX_POINTS`` of them: what a component needs to plot every point."""
    return _run(_copied_request(task_id, uid, ("data", "observer")), MAX_POINTS)


@router.get("/tasks/{task_id}/components/{uid}/figure")
def component_figure(task_id: int, uid: int) -> Response:
    """The plot of the Plot or Preview node a component copied (see ``plot`` and ``preview``)."""
    return _run(_copied_request(task_id, uid, ("plot", "preview")), 0)
