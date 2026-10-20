"""Studies: their list and order, the canvas each one saves, and which tasks use its nodes."""

import json

from fastapi import APIRouter, Response

from db import db, require_study, set_order
from schemas import GraphState, Order, Rename, StudyCreate

router = APIRouter(prefix="/api")


@router.get("/studies")
def list_studies() -> list[dict]:
    """The studies, each with its tasks."""
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


@router.post("/studies", status_code=201)
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


@router.get("/studies/{study_id}")
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


@router.get("/studies/{study_id}/usage")
def get_usage(study_id: int) -> dict[str, list[int]]:
    """The tasks using each node as a source: node id to task ids."""
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


@router.put("/studies/order", status_code=204)
def order_studies(order: Order) -> Response:
    with db() as conn:
        set_order(conn, "studies", "1 = 1", (), order.ids)
    return Response(status_code=204)


@router.patch("/studies/{study_id}")
def rename_study(study_id: int, body: Rename) -> dict:
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("UPDATE studies SET name = ? WHERE id = ?", (body.name, study_id))
        return {"id": study_id, "name": body.name}


@router.delete("/studies/{study_id}", status_code=204)
def delete_study(study_id: int) -> Response:
    with db() as conn:
        require_study(conn, study_id)
        conn.execute("DELETE FROM studies WHERE id = ?", (study_id,))
    return Response(status_code=204)


@router.put("/studies/{study_id}/graph", status_code=204)
def save_graph(study_id: int, graph: GraphState) -> Response:
    """Replace a study's saved canvas: nodes and connections."""
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
