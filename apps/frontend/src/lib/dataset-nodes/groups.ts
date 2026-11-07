import type {
  Connection,
  CoordinateExtent,
  Edge,
  GraphNode,
  Node,
  XYPosition,
} from "@vue-flow/core";

import { findKind } from "./catalog";
import type { FlowNode } from "./graph";
import type { NodeCatalog } from "./types";

export const DATASET_GROUP = "dataset-group";

const GROUP_PADDING = 24;
const GROUP_HEADER = 40;

type GroupData = { collapsed: boolean };
export type GroupNode = Node<GroupData> & { width: number; height: number; data: GroupData };

export function groupNode(
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
    deletable: false,
  };
}

export function groupExtent({
  width,
  height,
}: {
  width: number;
  height: number;
}): CoordinateExtent {
  return [
    [0, 0],
    [width, height],
  ];
}

function groupStyle(collapsed: boolean) {
  return collapsed ? { width: "auto", height: "auto" } : undefined;
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
    .map((node) =>
      node.parentNode === groupId
        ? {
            ...node,
            parentNode: undefined,
            extent: undefined,
            hidden: false,
            position: {
              x: group.position.x + node.position.x,
              y: group.position.y + node.position.y,
            },
          }
        : node,
    );
}

export function setGroupCollapsed(nodes: GraphNode[], groupId: string, collapsed: boolean): Node[] {
  return nodes.map((node) => {
    if (node.id === groupId) {
      return { ...node, data: { ...node.data, collapsed }, style: groupStyle(collapsed) };
    }
    return node.parentNode === groupId ? { ...node, hidden: collapsed } : node;
  });
}

export function isStandIn(edge: Edge) {
  return !!edge.data?.standsFor;
}

export function withCollapsedEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const real = edges.filter((edge) => !isStandIn(edge));
  const collapsed = new Set(
    nodes
      .filter((node) => node.type === DATASET_GROUP && node.data.collapsed)
      .map((node) => node.id),
  );
  const shownAs = new Map(
    nodes.flatMap((node) =>
      node.parentNode && collapsed.has(node.parentNode) ? [[node.id, node.parentNode]] : [],
    ),
  );
  const standIns = real
    .filter((edge) => shownAs.get(edge.source) !== shownAs.get(edge.target))
    .map((edge) => {
      const source = shownAs.get(edge.source);
      const target = shownAs.get(edge.target);
      return {
        id: standInId(edge.id),
        source: source ?? edge.source,
        sourceHandle: source ? memberHandle(edge.source, edge.sourceHandle) : edge.sourceHandle,
        target: target ?? edge.target,
        targetHandle: target ? memberHandle(edge.target, edge.targetHandle) : edge.targetHandle,
        data: { standsFor: edge.id },
      };
    });
  return [...real, ...standIns];
}

export function standInId(edgeId: string) {
  return `${edgeId}:collapsed`;
}

function memberHandle(nodeId: string, portId: string | null | undefined) {
  return `${nodeId}.${portId}`;
}

export function memberPorts(nodes: Node[], edges: Edge[], catalog: NodeCatalog, groupId: string) {
  const members = nodes.filter((node): node is FlowNode => node.parentNode === groupId);
  const memberIds = new Set(members.map((node) => node.id));
  const real = edges.filter((edge) => !isStandIn(edge));
  const onlyInside = (links: Edge[]) =>
    links.length > 0 &&
    links.every((edge) => memberIds.has(edge.source) && memberIds.has(edge.target));

  return members.flatMap((node) => {
    const kind = findKind(catalog, node.data.kind);
    if (!kind) return [];
    const inputs = kind.inputs.filter(
      (port) =>
        !onlyInside(
          real.filter((edge) => edge.target === node.id && edge.targetHandle === port.id),
        ),
    );
    const outputs = kind.outputs.filter(
      (port) =>
        !onlyInside(
          real.filter((edge) => edge.source === node.id && edge.sourceHandle === port.id),
        ),
    );
    if (!inputs.length && !outputs.length) return [];
    return [
      {
        id: node.id,
        label: kind.label,
        inputs: inputs.map((port) => ({ ...port, id: memberHandle(node.id, port.id) })),
        outputs: outputs.map((port) => ({ ...port, id: memberHandle(node.id, port.id) })),
      },
    ];
  });
}

export function memberConnection(connection: Connection, nodes: Node[]): Connection {
  const member = (nodeId: string, handle: string | null | undefined) => {
    const node = nodes.find((node) => node.id === nodeId);
    if (node?.type !== DATASET_GROUP || !handle) return { nodeId, handle };
    const split = handle.lastIndexOf(".");
    return { nodeId: handle.slice(0, split), handle: handle.slice(split + 1) };
  };
  const source = member(connection.source, connection.sourceHandle);
  const target = member(connection.target, connection.targetHandle);
  return {
    source: source.nodeId,
    sourceHandle: source.handle,
    target: target.nodeId,
    targetHandle: target.handle,
  };
}
