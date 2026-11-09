import json
from importlib.metadata import distribution, version
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    StrictBool,
    StringConstraints,
    model_validator,
)


def scisynth_version() -> str:
    source = json.loads(distribution("scisynth").read_text("direct_url.json") or "{}")
    return source.get("vcs_info", {}).get("commit_id") or version("scisynth")


GENERATOR = {"scisynth": scisynth_version(), "numpy": version("numpy")}

MAX_NODES = 500
MAX_EDGES = 2000

NAME_MAX_LENGTH = 40

Ref = Annotated[str, Field(min_length=1, max_length=64)]
NodeName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH),
]
ParamValue = (
    StrictBool | int | FiniteFloat | Annotated[str, Field(max_length=200)] | None
)


class _Strict(BaseModel):
    model_config = ConfigDict(
        extra="forbid", json_schema_serialization_defaults_required=True
    )


class Position(_Strict):
    x: FiniteFloat
    y: FiniteFloat


class NodeSpec(_Strict):
    id: Ref
    kind: Ref
    params: dict[Ref, ParamValue] = Field(default_factory=dict, max_length=50)


class GraphNode(NodeSpec):
    name: NodeName | None = None
    position: Position
    preview_hidden: bool = False


class GraphEdge(_Strict):
    id: Ref
    source: Ref
    source_port: Ref
    target: Ref
    target_port: Ref


class GroupPort(_Strict):
    node: Ref
    port: Ref


class GraphGroup(_Strict):
    id: Ref
    name: NodeName | None = None
    position: Position
    nodes: list[Ref] = Field(min_length=1, max_length=MAX_NODES)
    inputs: list[GroupPort] = Field(default_factory=list, max_length=MAX_EDGES)
    outputs: list[GroupPort] = Field(default_factory=list, max_length=MAX_EDGES)
    input_position: Position | None = None
    output_position: Position | None = None


class DatasetGraph(_Strict):
    version: Literal[1] = 1
    nodes: list[GraphNode] = Field(default_factory=list, max_length=MAX_NODES)
    edges: list[GraphEdge] = Field(default_factory=list, max_length=MAX_EDGES)
    groups: list[GraphGroup] = Field(default_factory=list, max_length=MAX_NODES)

    @model_validator(mode="after")
    def check_references(self) -> Self:
        node_ids = {node.id for node in self.nodes}
        if len(node_ids) != len(self.nodes):
            raise ValueError("Node ids must be unique")
        if len({edge.id for edge in self.edges}) != len(self.edges):
            raise ValueError("Edge ids must be unique")
        for edge in self.edges:
            if edge.source not in node_ids or edge.target not in node_ids:
                raise ValueError(f"Edge {edge.id} connects a node that doesn't exist")
            if edge.source == edge.target:
                raise ValueError(f"Edge {edge.id} connects a node to itself")
        group_ids = {group.id for group in self.groups}
        if len(group_ids) != len(self.groups) or group_ids & node_ids:
            raise ValueError("Group ids must be unique")
        members = [member for group in self.groups for member in group.nodes]
        if len(set(members)) != len(members):
            raise ValueError("A node can only be in one group")
        if not set(members) <= node_ids:
            raise ValueError("A group contains a node that doesn't exist")
        for group in self.groups:
            if any(
                port.node not in group.nodes for port in group.inputs + group.outputs
            ):
                raise ValueError(
                    f"Group {group.id} exposes a port of a node outside it"
                )
        return self


class GroupGraph(DatasetGraph):
    @model_validator(mode="after")
    def check_one_group(self) -> Self:
        if len(self.groups) != 1 or set(self.groups[0].nodes) != {
            node.id for node in self.nodes
        }:
            raise ValueError("A saved group holds one group with all of its nodes")
        return self
