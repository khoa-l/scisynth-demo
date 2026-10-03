import json
import math
import os
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

import obskit
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel

DB_PATH = Path(os.environ.get("SCISYNTH_DB", Path(__file__).parent / "scisynth.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS studies (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    id       TEXT NOT NULL,
    type     TEXT NOT NULL DEFAULT 'placeholder',
    label    TEXT NOT NULL,
    x        REAL NOT NULL,
    y        REAL NOT NULL,
    data     TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (study_id, id)
);
CREATE TABLE IF NOT EXISTS edges (
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    id       TEXT NOT NULL,
    source   TEXT NOT NULL,
    target   TEXT NOT NULL,
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    with db() as conn:
        conn.executescript(SCHEMA)
        # databases created before nodes had a type
        columns = [r["name"] for r in conn.execute("PRAGMA table_info(nodes)")]
        if "type" not in columns:
            conn.execute("ALTER TABLE nodes ADD COLUMN type TEXT NOT NULL DEFAULT 'placeholder'")
        # databases created before nodes carried their own data (e.g. a Domain's axes)
        if "data" not in columns:
            conn.execute("ALTER TABLE nodes ADD COLUMN data TEXT NOT NULL DEFAULT '{}'")
        # GaussianRandomField was renamed GaussianField in obskit
        conn.execute(
            "UPDATE nodes SET type = 'gaussianField', label = 'GaussianField' "
            "WHERE type = 'gaussianRandomField'"
        )
    yield


app = FastAPI(title="SciSynth API", lifespan=lifespan)


class StudyCreate(BaseModel):
    name: str | None = None


class StudyUpdate(BaseModel):
    name: str


class NodeState(BaseModel):
    id: str
    type: str
    label: str
    x: float
    y: float
    data: dict[str, Any] = {}


class EdgeState(BaseModel):
    id: str
    source: str
    target: str


class GraphState(BaseModel):
    nodes: list[NodeState]
    edges: list[EdgeState] = []


def require_study(conn: sqlite3.Connection, study_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT id, name FROM studies WHERE id = ?", (study_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Study not found")
    return row


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/studies")
def list_studies() -> list[dict]:
    with db() as conn:
        return [dict(r) for r in conn.execute("SELECT id, name FROM studies ORDER BY id")]


@app.post("/api/studies", status_code=201)
def create_study(body: StudyCreate | None = None) -> dict:
    with db() as conn:
        cur = conn.execute("INSERT INTO studies (name) VALUES (?)", ((body and body.name) or "",))
        study_id = cur.lastrowid
        if not (body and body.name):
            conn.execute("UPDATE studies SET name = ? WHERE id = ?", (f"Study {study_id}", study_id))
        return dict(require_study(conn, study_id))


@app.get("/api/studies/{study_id}")
def get_study(study_id: int) -> dict:
    with db() as conn:
        study = require_study(conn, study_id)
        nodes = conn.execute(
            "SELECT id, type, label, x, y, data FROM nodes WHERE study_id = ? ORDER BY rowid",
            (study_id,),
        )
        edges = conn.execute(
            "SELECT id, source, target FROM edges WHERE study_id = ? ORDER BY rowid", (study_id,)
        )
        return {
            **dict(study),
            "nodes": [{**dict(n), "data": json.loads(n["data"])} for n in nodes],
            "edges": [dict(e) for e in edges],
        }


@app.patch("/api/studies/{study_id}")
def rename_study(study_id: int, body: StudyUpdate) -> dict:
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("UPDATE studies SET name = ? WHERE id = ?", (body.name, study_id))
        return dict(require_study(conn, study_id))


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
            "INSERT INTO nodes (study_id, id, type, label, x, y, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (study_id, n.id, n.type, n.label, n.x, n.y, json.dumps(n.data))
                for n in graph.nodes
            ],
        )
        conn.executemany(
            "INSERT INTO edges (study_id, id, source, target) VALUES (?, ?, ?, ?)",
            [(study_id, e.id, e.source, e.target) for e in graph.edges],
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
def _preview_json(node_type: str, params: tuple[tuple[str, Any], ...], seed: int) -> str:
    # Deterministic (the demo signal is fixed and the seed is explicit), so equal inputs
    # give equal figures
    figure = DEFECTS[node_type](**dict(params)).preview(seed=seed, interactive=False)
    return figure.to_json()


@app.get("/api/preview/{node_type}")
def preview(node_type: str, request: Request) -> Response:
    """A defect's preview plot (before / after on its demo signal) as a Plotly figure.

    The defect's parameters (see ``DEFECT_PARAMS``) are given as query parameters; any
    left out keep obskit's defaults. ``seed`` (a non-negative integer, default 0) sets the
    random draw, so the same seed always gives the same preview.
    """
    if node_type not in DEFECTS:
        raise HTTPException(status_code=404, detail=f"No preview for {node_type!r}")
    allowed = DEFECT_PARAMS.get(node_type, {})
    params: dict[str, Any] = {}
    seed = 0
    for name, raw in request.query_params.items():
        if name == "seed":
            try:
                seed = int(raw)
            except ValueError:
                raise HTTPException(status_code=422, detail=f"Invalid value for 'seed': {raw!r}")
            continue
        if name not in allowed:
            raise HTTPException(status_code=422, detail=f"Unknown parameter {name!r}")
        try:
            value = allowed[name](raw)
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(raw)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid value for {name!r}: {raw!r}")
        params[name] = value
    try:
        body = _preview_json(node_type, tuple(sorted(params.items())), seed)
    except ValueError as exc:  # obskit rejecting a value (e.g. p outside [0, 1], seed < 0)
        raise HTTPException(status_code=422, detail=str(exc))
    return Response(content=body, media_type="application/json")
