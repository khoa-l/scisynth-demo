from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

MAX_NODES = 500
MAX_EDGES = 2000

Ref = Annotated[str, Field(min_length=1, max_length=64)]
ParamValue = int | FiniteFloat | Annotated[str, Field(max_length=200)] | None


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
    position: Position
    preview_hidden: bool = False


class GraphEdge(_Strict):
    id: Ref
    source: Ref
    source_port: Ref
    target: Ref
    target_port: Ref


class DatasetGraph(_Strict):
    version: Literal[1] = 1
    nodes: list[GraphNode] = Field(default_factory=list, max_length=MAX_NODES)
    edges: list[GraphEdge] = Field(default_factory=list, max_length=MAX_EDGES)

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
        return self
