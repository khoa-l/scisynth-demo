import type { Edge, GraphNode, Node, XYPosition } from "@vue-flow/core";

import type { DatasetGraphOutput, NodePreviewRequest } from "@/client";

import { canConnect, findKind, type DatasetNodeData } from "./catalog";
import { isValidParam } from "./params";
import type { NodeCatalog, NodeKindDef, ParamValues } from "./types";

export type DatasetGraph = DatasetGraphOutput;

export const DATASET_NODE = "dataset-node";
export const DATASET_GROUP = "dataset-group";

const GROUP_PADDING = 24;
const GROUP_HEADER = 40;

type FlowNode = Node<DatasetNodeData> & { data: DatasetNodeData };
type GroupNode = Node & { width: number; height: number };

export function flowNode(id: string, position: XYPosition, data: DatasetNodeData): FlowNode {
  return { id, type: DATASET_NODE, position, data };
}

function groupNode(id: string, position: XYPosition, width: number, height: number): GroupNode {
  return { id, type: DATASET_GROUP, position, width, height, data: {} };
}

export function toGraph(nodes: Node[], edges: Edge[]): DatasetGraph {
  const datasetNodes = nodes.filter((node): node is FlowNode => node.type === DATASET_NODE);
  return {
    version: 1,
    nodes: datasetNodes.map(({ id, position: { x, y }, data }) => ({
      id,
      kind: data.kind,
      params: data.params,
      position: { x, y },
      preview_hidden: data.previewHidden ?? false,
    })),
    edges: edges.flatMap(({ id, source, sourceHandle, target, targetHandle }) =>
      sourceHandle && targetHandle
        ? [{ id, source, source_port: sourceHandle, target, target_port: targetHandle }]
        : [],
    ),
    groups: nodes
      .filter((node): node is GroupNode => node.type === DATASET_GROUP)
      .map(({ id, position: { x, y }, width, height }) => ({
        id,
        position: { x, y },
        width,
        height,
        nodes: datasetNodes.filter((node) => node.parentNode === id).map((node) => node.id),
      }))
      .filter((group) => group.nodes.length),
  };
}

export function fromGraph(
  graph: DatasetGraph,
  catalog: NodeCatalog,
): { nodes: (FlowNode | GroupNode)[]; edges: Edge[] } {
  const kindOf = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const parentOf = new Map(
    graph.groups.flatMap((group) => group.nodes.map((node) => [node, group.id])),
  );

  return {
    nodes: [
      ...graph.groups.map(({ id, position: { x, y }, width, height }) =>
        groupNode(id, { x, y }, width, height),
      ),
      ...graph.nodes.map(({ id, kind, params, position: { x, y }, preview_hidden }) => {
        const def = findKind(catalog, kind);
        const node = flowNode(
          id,
          { x, y },
          { kind, params: def ? loadParams(def, params) : params, previewHidden: preview_hidden },
        );
        const parentNode = parentOf.get(id);
        return parentNode ? { ...node, parentNode, extent: "parent" as const } : node;
      }),
    ],
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

export function groupNodes(nodes: GraphNode[], memberIds: string[], groupId: string): Node[] {
  const members = nodes.filter((node) => memberIds.includes(node.id));
  const left = Math.min(...members.map((node) => node.computedPosition.x)) - GROUP_PADDING;
  const top = Math.min(...members.map((node) => node.computedPosition.y)) - GROUP_HEADER;
  const right = Math.max(...members.map((node) => node.computedPosition.x + node.dimensions.width));
  const bottom = Math.max(
    ...members.map((node) => node.computedPosition.y + node.dimensions.height),
  );
  const group = groupNode(
    groupId,
    { x: left, y: top },
    right - left + GROUP_PADDING,
    bottom - top + GROUP_PADDING,
  );
  const regrouped = nodes.map((node) =>
    memberIds.includes(node.id)
      ? {
          ...node,
          parentNode: groupId,
          extent: "parent" as const,
          position: { x: node.computedPosition.x - left, y: node.computedPosition.y - top },
        }
      : node,
  );
  const emptied = new Set(
    members
      .map((node) => node.parentNode)
      .filter((id) => !regrouped.some((node) => node.parentNode === id)),
  );
  return [group, ...regrouped.filter((node) => !emptied.has(node.id))];
}

export function ungroupNodes(nodes: GraphNode[], groupId: string): Node[] {
  return nodes
    .filter((node) => node.id !== groupId)
    .map(({ parentNode, extent, ...node }) =>
      parentNode === groupId
        ? { ...node, position: { x: node.computedPosition.x, y: node.computedPosition.y } }
        : { ...node, parentNode, extent },
    );
}

function loadParams(kind: NodeKindDef, saved: ParamValues): ParamValues {
  return Object.fromEntries(
    Object.entries(kind.params).map(([name, def]) => {
      const value = saved[name];
      return [name, isValidParam(def, value) ? value : def.default];
    }),
  );
}

export function nodePreviewRequest(graph: DatasetGraph, nodeId: string): NodePreviewRequest {
  const upstream = new Set([nodeId]);
  const queue = [nodeId];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const edge of graph.edges) {
      if (edge.target === id && !upstream.has(edge.source)) {
        upstream.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return {
    node: nodeId,
    nodes: graph.nodes
      .filter((node) => upstream.has(node.id))
      .map(({ id, kind, params }) => ({ id, kind, params })),
    edges: graph.edges.filter((edge) => upstream.has(edge.target)),
  };
}
