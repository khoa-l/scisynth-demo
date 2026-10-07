import json
import math
import os
import sqlite3
from collections.abc import Mapping
from contextlib import asynccontextmanager, contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import obskit
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel

DB_PATH = Path(os.environ.get("SCISYNTH_DB", Path(__file__).parent / "scisynth.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS studies (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tasks (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    name     TEXT NOT NULL DEFAULT 'Task',
    position INTEGER NOT NULL DEFAULT 0,
    components TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS nodes (
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    id       TEXT NOT NULL,
    type     TEXT NOT NULL DEFAULT 'placeholder',
    label    TEXT NOT NULL,
    x        REAL NOT NULL,
    y        REAL NOT NULL,
    parent   TEXT,
    data     TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (study_id, id)
);
CREATE TABLE IF NOT EXISTS edges (
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    id       TEXT NOT NULL,
    source   TEXT NOT NULL,
    target   TEXT NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    PRIMARY KEY (study_id, id)
);
"""

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


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:  # commit on success, roll back on error
            yield conn
    finally:
        conn.close()


def ensure_column(
    conn: sqlite3.Connection, table: str, column: str, definition: str
) -> None:
    """Add a column that databases created before it existed do not have."""
    existing = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    with db() as conn:
        conn.executescript(SCHEMA)
        # columns that older databases do not have yet
        ensure_column(conn, "studies", "position", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "tasks", "position", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "tasks", "components", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(conn, "nodes", "type", "TEXT NOT NULL DEFAULT 'placeholder'")
        ensure_column(conn, "nodes", "data", "TEXT NOT NULL DEFAULT '{}'")
        ensure_column(conn, "nodes", "parent", "TEXT")
        ensure_column(conn, "edges", "source_handle", "TEXT")
        ensure_column(conn, "edges", "target_handle", "TEXT")
    yield


app = FastAPI(title="SciSynth API", lifespan=lifespan)


class StudyCreate(BaseModel):
    name: str | None = None


class Rename(BaseModel):
    name: str


class ComponentState(BaseModel):
    """A component placed in a task: its kind and what it keeps (a text, a copy of a source...)."""

    uid: int
    type: str
    data: dict[str, Any] = {}


class Order(BaseModel):
    ids: list[int]  # every id of the list, in the new order


class NodeState(BaseModel):
    id: str
    type: str
    label: str
    x: float
    y: float
    # id of the node this one sits inside (x and y are then relative to it), or null
    parent: str | None = None
    data: dict[str, Any] = {}


class EdgeState(BaseModel):
    id: str
    source: str
    target: str
    # which output / input of the nodes the connection uses (null = the header's)
    sourceHandle: str | None = None
    targetHandle: str | None = None


class GraphState(BaseModel):
    nodes: list[NodeState]
    edges: list[EdgeState] = []


def require_study(conn: sqlite3.Connection, study_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id, name FROM studies WHERE id = ?", (study_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Study not found")
    return row


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/studies")
def list_studies() -> list[dict]:
    """The studies, each with its tasks (the user study tasks made from its workflow)."""
    with db() as conn:
        tasks: dict[int, list[dict]] = {}
        for t in conn.execute(
            "SELECT id, study_id, name FROM tasks ORDER BY position, id"
        ):
            tasks.setdefault(t["study_id"], []).append(
                {"id": t["id"], "name": t["name"]}
            )
        return [
            {**dict(s), "tasks": tasks.get(s["id"], [])}
            for s in conn.execute("SELECT id, name FROM studies ORDER BY position, id")
        ]


@app.post("/api/studies", status_code=201)
def create_study(body: StudyCreate | None = None) -> dict:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO studies (name, position) "
            "VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM studies))",
            ((body and body.name) or "",),
        )
        study_id = cur.lastrowid
        if not (body and body.name):
            conn.execute(
                "UPDATE studies SET name = ? WHERE id = ?",
                (f"Study {study_id}", study_id),
            )
        return dict(require_study(conn, study_id))


@app.get("/api/studies/{study_id}")
def get_study(study_id: int) -> dict:
    with db() as conn:
        study = require_study(conn, study_id)
        nodes = conn.execute(
            "SELECT id, type, label, x, y, parent, data FROM nodes WHERE study_id = ? ORDER BY rowid",
            (study_id,),
        )
        edges = conn.execute(
            "SELECT id, source, target, source_handle AS sourceHandle, "
            "target_handle AS targetHandle FROM edges WHERE study_id = ? ORDER BY rowid",
            (study_id,),
        )
        return {
            **dict(study),
            "nodes": [{**dict(n), "data": json.loads(n["data"])} for n in nodes],
            "edges": [dict(e) for e in edges],
        }


@app.get("/api/studies/{study_id}/usage")
def get_usage(study_id: int) -> dict[str, list[int]]:
    """The tasks that use each node of the study as a source: node id -> task ids, in task order."""
    with db() as conn:
        require_study(conn, study_id)
        tasks = conn.execute(
            "SELECT id, components FROM tasks WHERE study_id = ? ORDER BY position, id",
            (study_id,),
        ).fetchall()
    usage: dict[str, list[int]] = {}
    for task in tasks:
        for component in json.loads(task["components"]):
            source = component["data"].get("source")
            if source:
                ids = usage.setdefault(source["nodeId"], [])
                if task["id"] not in ids:
                    ids.append(task["id"])
    return usage


def set_order(
    conn: sqlite3.Connection, table: str, where: str, args: tuple, order: Order
) -> None:
    """Save the order of a list (the studies, or one study's tasks): ids must be exactly its rows."""
    current = {
        r["id"] for r in conn.execute(f"SELECT id FROM {table} WHERE {where}", args)
    }
    if sorted(order.ids) != sorted(current):
        raise HTTPException(
            status_code=422, detail="ids must be exactly the items of the list"
        )
    conn.executemany(
        f"UPDATE {table} SET position = ? WHERE id = ?",
        [(i, id_) for i, id_ in enumerate(order.ids)],
    )


@app.put("/api/studies/order", status_code=204)
def order_studies(order: Order) -> Response:
    with db() as conn:
        set_order(conn, "studies", "1 = 1", (), order)
    return Response(status_code=204)


@app.post("/api/studies/{study_id}/tasks", status_code=201)
def create_task(study_id: int) -> dict:
    """Add a task to a study, last in its list, named "Task <n>" (one more than the highest n)."""
    with db() as conn:
        require_study(conn, study_id)
        names = [
            r["name"]
            for r in conn.execute(
                "SELECT name FROM tasks WHERE study_id = ?", (study_id,)
            )
        ]
        numbers = [
            int(n[5:]) for n in names if n.startswith("Task ") and n[5:].isdigit()
        ]
        name = f"Task {max(numbers, default=0) + 1}"
        cur = conn.execute(
            "INSERT INTO tasks (study_id, name, position) VALUES "
            "(?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE study_id = ?))",
            (study_id, name, study_id),
        )
        return {"id": cur.lastrowid, "name": name}


@app.put("/api/studies/{study_id}/tasks/order", status_code=204)
def order_tasks(study_id: int, order: Order) -> Response:
    with db() as conn:
        require_study(conn, study_id)
        set_order(conn, "tasks", "study_id = ?", (study_id,), order)
    return Response(status_code=204)


def task_components(conn: sqlite3.Connection, task_id: int) -> list[dict]:
    row = conn.execute(
        "SELECT components FROM tasks WHERE id = ?", (task_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return json.loads(row["components"])


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int) -> dict:
    with db() as conn:
        return {"id": task_id, "components": task_components(conn, task_id)}


@app.put("/api/tasks/{task_id}/components", status_code=204)
def save_components(task_id: int, components: list[ComponentState]) -> Response:
    """Replace what a task holds: its components, in order."""
    with db() as conn:
        task_components(conn, task_id)  # 404 for a task that is not there
        conn.execute(
            "UPDATE tasks SET components = ? WHERE id = ?",
            (json.dumps([c.model_dump() for c in components]), task_id),
        )
    return Response(status_code=204)


@app.patch("/api/tasks/{task_id}")
def rename_task(task_id: int, body: Rename) -> dict:
    with db() as conn:
        if (
            conn.execute(
                "UPDATE tasks SET name = ? WHERE id = ?", (body.name, task_id)
            ).rowcount
            == 0
        ):
            raise HTTPException(status_code=404, detail="Task not found")
        return {"id": task_id, "name": body.name}


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int) -> Response:
    with db() as conn:
        if conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)


@app.patch("/api/studies/{study_id}")
def rename_study(study_id: int, body: Rename) -> dict:
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("UPDATE studies SET name = ? WHERE id = ?", (body.name, study_id))
        return {"id": study_id, "name": body.name}


@app.delete("/api/studies/{study_id}", status_code=204)
def delete_study(study_id: int) -> Response:
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("DELETE FROM studies WHERE id = ?", (study_id,))
    return Response(status_code=204)


@app.put("/api/studies/{study_id}/graph", status_code=204)
def save_graph(study_id: int, graph: GraphState) -> Response:
    """Replace the saved state of a study's canvas: its nodes and the connections between them."""
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("DELETE FROM nodes WHERE study_id = ?", (study_id,))
        conn.execute("DELETE FROM edges WHERE study_id = ?", (study_id,))
        conn.executemany(
            "INSERT INTO nodes (study_id, id, type, label, x, y, parent, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    study_id,
                    n.id,
                    n.type,
                    n.label,
                    n.x,
                    n.y,
                    n.parent,
                    json.dumps(n.data),
                )
                for n in graph.nodes
            ],
        )
        conn.executemany(
            "INSERT INTO edges (study_id, id, source, target, source_handle, target_handle) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (study_id, e.id, e.source, e.target, e.sourceHandle, e.targetHandle)
                for e in graph.edges
            ],
        )
    return Response(status_code=204)


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


def _preview_response(node_type: str, raw_params: Mapping[str, Any]) -> Response:
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


@app.get("/api/preview/{node_type}")
def preview(node_type: str, request: Request) -> Response:
    return _preview_response(node_type, request.query_params)


# ---- the Plot node: a sampler's plot, on the latent it is given

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


def _cells(per_axis: Any, ndim: int) -> int:
    """How many cells a grid has: a whole number is repeated for every axis, a list gives one per
    axis (obskit's rule for a field's ``resolution`` and a grid sampler's ``shape``)."""
    sizes = per_axis if isinstance(per_axis, list | tuple) else [per_axis] * ndim
    total = 1
    for size in sizes:
        total *= max(int(size), 1)
    return total


def _check_size(req: PlotRequest) -> None:
    """Refuse a field or grid too big to build, before anything is allocated (a field on 5 axes at
    128 each is 34 billion cells)."""
    ndim = len(req.axes)
    grids = {"the field": req.field_params.get("resolution", 128)}
    if req.sampler == "gridSampler" and "shape" in req.sampler_params:
        grids["the grid"] = req.sampler_params["shape"]
    for what, per_axis in grids.items():
        cells = _cells(per_axis, ndim)
        if cells > MAX_CELLS:
            raise ValueError(
                f"{what} would have {cells:,} cells on {ndim} axes (at most {MAX_CELLS:,}); "
                "lower the resolution or the number of axes"
            )


def _sampler_and_latent(req: PlotRequest):
    """The sampler, and the field it samples realized from its own seed (seeds are explicit, so
    equal requests give equal results)."""
    _check_size(req)
    domain = obskit.Domain.from_extents(
        [a.extent for a in req.axes],
        names=[a.name for a in req.axes],
        units=[a.unit for a in req.axes],
    )
    latent = obskit.GaussianField(domain, **req.field_params).realize(req.field_seed)
    return SAMPLERS[req.sampler](**req.sampler_params), latent


@lru_cache(maxsize=64)
def _plot_json(request_json: str) -> str:
    req = PlotRequest.model_validate_json(request_json)
    sampler, latent = _sampler_and_latent(req)
    return sampler.plot(latent, req.seed, interactive=False).to_json()


def _sampler_response(build, req: PlotRequest, *args: Any) -> Response:
    """Run `build` (a cached function of the request, and any `args`) for a known sampler; obskit
    rejecting the values is the caller's 422."""
    if req.sampler not in SAMPLERS:
        raise HTTPException(status_code=404, detail=f"Unknown sampler {req.sampler!r}")
    try:
        body = build(req.model_dump_json(), *args)
    except (ValueError, TypeError, NotImplementedError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return Response(content=body, media_type="application/json")


@app.post("/api/plot")
def plot(req: PlotRequest) -> Response:
    """A sampler's plot: the sampler applied to a GaussianField on the given axes, as Plotly."""
    return _sampler_response(_plot_json, req)


# ---- the Data node: what a sampler outputs, as rows

DATA_ROWS = 50  # how many rows are sent; the node shows the first few of them
MAX_POINTS = 5_000  # how many are sent when a component needs them all (to plot them)


def _rows_json(obs: obskit.Observation, limit: int) -> str:
    """The first `limit` rows of an observation: its coordinates, then its value (empty where invalid), and
    how many rows there are in all."""
    names = list(obs.coords)
    count = int(obs.values.size)
    first = np.arange(min(count, limit))
    if obs.layout == "grid":  # one 1-D coordinate array per axis: row i is a grid point
        index = np.unravel_index(first, obs.values.shape)
        coords = [
            np.asarray(obs.coords[n])[i] for n, i in zip(names, index, strict=True)
        ]
    else:  # points: every coordinate array is as long as the values
        coords = [np.asarray(obs.coords[n]).ravel()[first] for n in names]
    values = obs.values.ravel()[first]
    valid = obs.mask.ravel()[first]
    rows = [
        [float(c[i]) for c in coords] + [float(values[i]) if valid[i] else None]
        for i in range(first.size)
    ]
    return json.dumps({"columns": [*names, "value"], "rowCount": count, "rows": rows})


@lru_cache(maxsize=64)
def _data_json(request_json: str, limit: int) -> str:
    req = PlotRequest.model_validate_json(request_json)
    sampler, latent = _sampler_and_latent(req)
    return _rows_json(sampler.run(latent, req.seed), limit)


@lru_cache(maxsize=64)
def _observer_json(request_json: str, limit: int) -> str:
    req = ObserverRequest.model_validate_json(request_json)
    sampler, latent = _sampler_and_latent(req)
    unknown = [s.type for s in req.stages if s.type not in DEFECTS]
    if unknown:
        raise ValueError(f"Unknown defect {unknown[0]!r}")
    stages = [DEFECTS[s.type](**s.params) for s in req.stages]
    return _rows_json(obskit.Observer(sampler, stages).run(latent, req.seed), limit)


@app.post("/api/data")
def data(req: PlotRequest) -> Response:
    """The first rows of what a sampler outputs on the given field: its coordinates, then its
    value (empty where the sample is invalid), and how many rows there are in all."""
    return _sampler_response(_data_json, req, DATA_ROWS)


@app.post("/api/observer")
def observer(req: ObserverRequest) -> Response:
    """The first rows of an Observer's output: the sampler and then the stages, on the given field
    (the same rows as ``data``)."""
    return _sampler_response(_observer_json, req, DATA_ROWS)


# ---- what a task's components show: the copy of a source each one keeps
#
# A component holds a copy of the request that made its source (`data.source.request`, saved with the
# task), and these run it. They take only the task and the component, never a request, so what a
# component can show is only what was copied into it.


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


def _sampler_request(request: dict, model: type[PlotRequest]) -> PlotRequest:
    try:
        return model.model_validate(request["body"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


def _component_rows(task_id: int, uid: int, limit: int) -> Response:
    request = _copied_request(task_id, uid, ("data", "observer"))
    if request["kind"] == "observer":
        build, model = _observer_json, ObserverRequest
    else:
        build, model = _data_json, PlotRequest
    return _sampler_response(build, _sampler_request(request, model), limit)


@app.get("/api/tasks/{task_id}/components/{uid}/data")
def component_data(task_id: int, uid: int) -> Response:
    """The first rows of the Data node or Observer a component copied (see ``data``, ``observer``)."""
    return _component_rows(task_id, uid, DATA_ROWS)


@app.get("/api/tasks/{task_id}/components/{uid}/points")
def component_points(task_id: int, uid: int) -> Response:
    """The same rows, up to ``MAX_POINTS`` of them: what a component needs to plot every point."""
    return _component_rows(task_id, uid, MAX_POINTS)


@app.get("/api/tasks/{task_id}/components/{uid}/figure")
def component_figure(task_id: int, uid: int) -> Response:
    """The plot of the Plot or Preview node a component copied (see ``plot`` and ``preview``)."""
    request = _copied_request(task_id, uid, ("plot", "preview"))
    if request["kind"] == "preview":
        query = {k: str(v) for k, v in request.get("query", {}).items()}
        return _preview_response(request["type"], query)
    return _sampler_response(_plot_json, _sampler_request(request, PlotRequest))
