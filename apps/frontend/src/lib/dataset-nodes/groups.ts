import type { Connection, Edge, GraphNode, Node, XYPosition } from "@vue-flow/core";

import { findKind } from "./catalog";
import type { FlowNode } from "./graph";
import type { NodeCatalog } from "./types";

export const DATASET_GROUP = "dataset-group";
export const GROUP_VIEW_NODE = "group-view-node";
export const GROUP_INPUT = "group-input";
export const GROUP_OUTPUT = "group-output";

const VIEW_NODE_WIDTH = 256;
const VIEW_GAP = 96;

type GroupData = { width: number; height: number };
export type GroupNode = Node<GroupData> & { data: GroupData };

export function groupNode(id: string, position: XYPosition, data: GroupData): GroupNode {
  return { id, type: DATASET_GROUP, position, data, deletable: false };
}

export function groupNodes(nodes: GraphNode[], memberIds: string[], groupId: string): Node[] {
  const members = nodes.filter((node) => memberIds.includes(node.id));
  const left = Math.min(...members.map((node) => node.computedPosition.x));
  const top = Math.min(...members.map((node) => node.computedPosition.y));
  const right = Math.max(...members.map((node) => node.computedPosition.x + node.dimensions.width));
  const bottom = Math.max(
    ...members.map((node) => node.computedPosition.y + node.dimensions.height),
  );
  return [
    groupNode(groupId, { x: left, y: top }, { width: right - left, height: bottom - top }),
    ...nodes.map((node) =>
      memberIds.includes(node.id)
        ? {
            ...node,
            parentNode: groupId,
            hidden: true,
            position: { x: node.computedPosition.x - left, y: node.computedPosition.y - top },
          }
        : node,
    ),
  ];
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
            hidden: false,
            position: {
              x: group.position.x + node.position.x,
              y: group.position.y + node.position.y,
            },
          }
        : node,
    );
}

export function isStandIn(edge: Edge) {
  return !!edge.data?.standsFor;
}

export function withGroupEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const real = edges.filter((edge) => !isStandIn(edge));
  const shownAs = new Map(
    nodes.flatMap((node) => (node.parentNode ? [[node.id, node.parentNode]] : [])),
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
  return `${edgeId}:group`;
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
        inputs: inputs.map((port) => ({ ...port, handle: memberHandle(node.id, port.id) })),
        outputs: outputs.map((port) => ({ ...port, handle: memberHandle(node.id, port.id) })),
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

type ViewPort = { id: string; label: string };
export type GroupViewData = {
  label: string;
  group?: string;
  inputs: ViewPort[];
  outputs: ViewPort[];
};

function viewNode(
  id: string,
  position: XYPosition,
  data: GroupViewData,
): Node<GroupViewData> & { data: GroupViewData } {
  return { id, type: GROUP_VIEW_NODE, position, data };
}

export function groupView(nodes: Node[], edges: Edge[], catalog: NodeCatalog, groupId: string) {
  const members = nodes.filter((node): node is FlowNode => node.parentNode === groupId);
  const memberIds = new Set(members.map((node) => node.id));
  const ports = memberPorts(nodes, edges, catalog, groupId);
  const left = Math.min(...members.map((node) => node.position.x)) - VIEW_NODE_WIDTH - VIEW_GAP;
  const right = Math.max(...members.map((node) => node.position.x)) + VIEW_NODE_WIDTH + VIEW_GAP;
  const top = Math.min(...members.map((node) => node.position.y));
  const groupPort = (member: string, port: { handle: string; label: string }) => ({
    id: port.handle,
    label: `${member}: ${port.label}`,
  });

  return {
    nodes: [
      viewNode(
        GROUP_INPUT,
        { x: left, y: top },
        {
          label: "Group Input",
          inputs: [],
          outputs: ports.flatMap((member) =>
            member.inputs.map((port) => groupPort(member.label, port)),
          ),
        },
      ),
      ...members.map((node) => {
        const kind = findKind(catalog, node.data.kind);
        return viewNode(node.id, node.position, {
          label: kind?.label ?? `Unknown: ${node.data.kind}`,
          group: kind?.group,
          inputs: kind?.inputs ?? [],
          outputs: kind?.outputs ?? [],
        });
      }),
      viewNode(
        GROUP_OUTPUT,
        { x: right, y: top },
        {
          label: "Group Output",
          inputs: ports.flatMap((member) =>
            member.outputs.map((port) => groupPort(member.label, port)),
          ),
          outputs: [],
        },
      ),
    ],
    edges: [
      ...edges
        .filter(
          (edge) => !isStandIn(edge) && memberIds.has(edge.source) && memberIds.has(edge.target),
        )
        .map(({ id, source, sourceHandle, target, targetHandle }) => ({
          id,
          source,
          sourceHandle,
          target,
          targetHandle,
        })),
      ...ports.flatMap((member) => [
        ...member.inputs.map((port) => ({
          id: `${GROUP_INPUT}:${port.handle}`,
          source: GROUP_INPUT,
          sourceHandle: port.handle,
          target: member.id,
          targetHandle: port.id,
        })),
        ...member.outputs.map((port) => ({
          id: `${GROUP_OUTPUT}:${port.handle}`,
          source: member.id,
          sourceHandle: port.id,
          target: GROUP_OUTPUT,
          targetHandle: port.handle,
        })),
      ]),
    ],
  };
}
