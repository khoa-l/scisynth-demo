import json
import os
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Response
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
"""


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
        return {
            **dict(study),
            "nodes": [{**dict(n), "data": json.loads(n["data"])} for n in nodes],
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


@app.put("/api/studies/{study_id}/nodes", status_code=204)
def save_nodes(study_id: int, nodes: list[NodeState]) -> Response:
    """Replace the saved state of a study's canvas with the given nodes."""
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("DELETE FROM nodes WHERE study_id = ?", (study_id,))
        conn.executemany(
            "INSERT INTO nodes (study_id, id, type, label, x, y, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(study_id, n.id, n.type, n.label, n.x, n.y, json.dumps(n.data)) for n in nodes],
        )
    return Response(status_code=204)
