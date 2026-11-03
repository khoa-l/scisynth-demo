import type { Edge, Node, XYPosition } from "@vue-flow/core";

import type { DatasetGraphOutput } from "@/client";

import { canConnect, findKind, type DatasetNodeData } from "./catalog";
import { isValidParam } from "./params";
import type { NodeCatalog, NodeKindDef, ParamValues } from "./types";

export type DatasetGraph = DatasetGraphOutput;

export const DATASET_NODE = "dataset-node";

export type FlowNode = Node<DatasetNodeData> & { data: DatasetNodeData };

export function flowNode(id: string, position: XYPosition, data: DatasetNodeData): FlowNode {
  return { id, type: DATASET_NODE, position, data };
}

export function toGraph(nodes: FlowNode[], edges: Edge[]): DatasetGraph {
  return {
    version: 1,
    nodes: nodes.map(({ id, position: { x, y }, data }) => ({
      id,
      kind: data.kind,
      params: { ...data.params },
      position: { x, y },
    })),
    edges: edges.flatMap(({ id, source, sourceHandle, target, targetHandle }) =>
      sourceHandle && targetHandle
        ? [{ id, source, source_port: sourceHandle, target, target_port: targetHandle }]
        : [],
    ),
  };
}

export function fromGraph(
  graph: DatasetGraph,
  catalog: NodeCatalog,
): { nodes: FlowNode[]; edges: Edge[] } {
  const kindOf = new Map(graph.nodes.map((node) => [node.id, node.kind]));

  return {
    nodes: graph.nodes.map(({ id, kind, params, position: { x, y } }) => {
      const def = findKind(catalog, kind);
      return flowNode(id, { x, y }, { kind, params: def ? loadParams(def, params) : params });
    }),
    edges: graph.edges
      .filter((edge) =>
        canConnect(catalog, {
          sourceKind: kindOf.get(edge.source) ?? "",
          sourcePort: edge.source_port,
          targetKind: kindOf.get(edge.target) ?? "",
          targetPort: edge.target_port,
        }),
      )
      .map(({ id, source, source_port, target, target_port }) => ({
        id,
        source,
        sourceHandle: source_port,
        target,
        targetHandle: target_port,
      })),
  };
}

function loadParams(kind: NodeKindDef, saved: ParamValues): ParamValues {
  return Object.fromEntries(
    Object.entries(kind.params).map(([name, def]) => {
      const value = saved[name];
      return [name, isValidParam(def, value) ? value : def.default];
    }),
  );
}
