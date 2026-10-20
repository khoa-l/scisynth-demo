"""Tasks: a study's list of them, and the components each one holds."""

import json

from fastapi import APIRouter, HTTPException, Response

from db import db, require_study, set_order, task_components
from schemas import ComponentState, Order, Rename

router = APIRouter(prefix="/api")


@router.post("/studies/{study_id}/tasks", status_code=201)
def create_task(study_id: int) -> dict:
    """Add a task, last in the list, named "Task <n>" (one more than the highest)."""
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


@router.put("/studies/{study_id}/tasks/order", status_code=204)
def order_tasks(study_id: int, order: Order) -> Response:
    with db() as conn:
        require_study(conn, study_id)
        set_order(conn, "tasks", "study_id = ?", (study_id,), order.ids)
    return Response(status_code=204)


@router.get("/tasks/{task_id}")
def get_task(task_id: int) -> dict:
    with db() as conn:
        return {"id": task_id, "components": task_components(conn, task_id)}


@router.put("/tasks/{task_id}/components", status_code=204)
def save_components(task_id: int, components: list[ComponentState]) -> Response:
    """Replace a task's components, in order."""
    with db() as conn:
        task_components(conn, task_id)  # 404 for a task that is not there
        conn.execute(
            "UPDATE tasks SET components = ? WHERE id = ?",
            (json.dumps([c.model_dump() for c in components]), task_id),
        )
    return Response(status_code=204)


@router.patch("/tasks/{task_id}")
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


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int) -> Response:
    with db() as conn:
        if conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)
