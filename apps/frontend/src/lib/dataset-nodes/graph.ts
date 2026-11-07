import type { CoordinateExtent, Edge, GraphNode, Node, XYPosition } from "@vue-flow/core";

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
type GroupData = { collapsed: boolean };
type GroupNode = Node<GroupData> & { width: number; height: number; data: GroupData };

export function flowNode(id: string, position: XYPosition, data: DatasetNodeData): FlowNode {
  return { id, type: DATASET_NODE, position, data };
}

function groupNode(
  id: string,
  position: XYPosition,
  width: number,
  height: number,
  collapsed = false,
): GroupNode {
  return {
    id,
    type: DATASET_GROUP,
    position,
    width,
    height,
    data: { collapsed },
    style: groupStyle(collapsed),
  };
}

function groupExtent({
  width,
  height,
}: GroupNode | DatasetGraph["groups"][number]): CoordinateExtent {
  return [
    [0, 0],
    [width, height],
  ];
}

function groupStyle(collapsed: boolean) {
  return collapsed ? { width: "auto", height: "auto" } : undefined;
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
      .map(({ id, position: { x, y }, width, height, data }) => ({
        id,
        position: { x, y },
        width,
        height,
        nodes: datasetNodes.filter((node) => node.parentNode === id).map((node) => node.id),
        collapsed: data.collapsed,
      }))
      .filter((group) => group.nodes.length),
  };
}

export function fromGraph(
  graph: DatasetGraph,
  catalog: NodeCatalog,
): { nodes: Node[]; edges: Edge[] } {
  const kindOf = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const groupOf = new Map(
    graph.groups.flatMap((group) => group.nodes.map((node) => [node, group])),
  );

  return {
    nodes: [
      ...graph.groups.map(({ id, position: { x, y }, width, height, collapsed }) =>
        groupNode(id, { x, y }, width, height, collapsed),
      ),
      ...graph.nodes.map(({ id, kind, params, position: { x, y }, preview_hidden }) => {
        const def = findKind(catalog, kind);
        const node = flowNode(
          id,
          { x, y },
          { kind, params: def ? loadParams(def, params) : params, previewHidden: preview_hidden },
        );
        const group = groupOf.get(id);
        return group
          ? { ...node, parentNode: group.id, extent: groupExtent(group), hidden: group.collapsed }
          : node;
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
          extent: groupExtent(group),
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
  const group = nodes.find((node) => node.id === groupId)!;
  return nodes
    .filter((node) => node.id !== groupId)
    .map(({ parentNode, extent, ...node }) =>
      parentNode === groupId
        ? {
            ...node,
            hidden: false,
            position: {
              x: group.position.x + node.position.x,
              y: group.position.y + node.position.y,
            },
          }
        : { ...node, parentNode, extent },
    );
}

export function collapseGroup(nodes: GraphNode[], groupId: string, collapsed: boolean): Node[] {
  return nodes.map((node) => {
    if (node.id === groupId) {
      return { ...node, data: { ...node.data, collapsed }, style: groupStyle(collapsed) };
    }
    return node.parentNode === groupId ? { ...node, hidden: collapsed } : node;
  });
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
