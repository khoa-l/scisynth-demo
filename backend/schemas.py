"""What the API accepts for studies, tasks and the canvas."""

from typing import Any

from pydantic import BaseModel


class StudyCreate(BaseModel):
    name: str | None = None


class Rename(BaseModel):
    name: str


class ComponentState(BaseModel):
    """A component placed in a task: its type and data."""

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
    # container this node sits in (x, y are then relative to it)
    parent: str | None = None
    data: dict[str, Any] = {}


class EdgeState(BaseModel):
    id: str
    source: str
    target: str
    # null is the header's
    sourceHandle: str | None = None
    targetHandle: str | None = None


class GraphState(BaseModel):
    nodes: list[NodeState]
    edges: list[EdgeState] = []
