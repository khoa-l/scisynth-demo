"""The SQLite database: schema, connections and shared lookups."""

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException

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
    """Add a column older databases lack."""
    existing = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def require_study(conn: sqlite3.Connection, study_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id, name FROM studies WHERE id = ?", (study_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Study not found")
    return row


def task_components(conn: sqlite3.Connection, task_id: int) -> list[dict]:
    row = conn.execute(
        "SELECT components FROM tasks WHERE id = ?", (task_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return json.loads(row["components"])


def set_order(
    conn: sqlite3.Connection, table: str, where: str, args: tuple, ids: list[int]
) -> None:
    """Save a list's order; `ids` must be exactly its rows."""
    current = {
        r["id"] for r in conn.execute(f"SELECT id FROM {table} WHERE {where}", args)
    }
    if sorted(ids) != sorted(current):
        raise HTTPException(
            status_code=422, detail="ids must be exactly the items of the list"
        )
    conn.executemany(
        f"UPDATE {table} SET position = ? WHERE id = ?",
        [(i, id_) for i, id_ in enumerate(ids)],
    )


def init_db() -> None:
    """Create the tables and add columns older databases lack."""
    with db() as conn:
        conn.executescript(SCHEMA)
        ensure_column(conn, "studies", "position", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "tasks", "position", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "tasks", "components", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(conn, "nodes", "type", "TEXT NOT NULL DEFAULT 'placeholder'")
        ensure_column(conn, "nodes", "data", "TEXT NOT NULL DEFAULT '{}'")
        ensure_column(conn, "nodes", "parent", "TEXT")
        ensure_column(conn, "edges", "source_handle", "TEXT")
        ensure_column(conn, "edges", "target_handle", "TEXT")
