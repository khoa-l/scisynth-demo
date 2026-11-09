import type { Connection, Edge, GraphNode, Node, XYPosition } from "@vue-flow/core";

import type { GroupPort } from "@/client";

import { findKind } from "./catalog";
import { DATASET_NODE, type DatasetGraph, type FlowNode } from "./graph";
import type { NodeCatalog } from "./types";

export const DATASET_GROUP = "dataset-group";
export const GROUP_INPUT = "group-input";
export const GROUP_OUTPUT = "group-output";

const NODE_WIDTH = 256;
const PORTS_NODE_WIDTH = 192;
const VIEW_GAP = 96;

export type GroupSide = "inputs" | "outputs";
export type GroupData = {
  name: string | null;
  inputPosition: XYPosition | null;
  outputPosition: XYPosition | null;
} & Record<GroupSide, GroupPort[]>;
export type GroupNode = Node<GroupData> & { data: GroupData };

export function groupNode(id: string, position: XYPosition, data: GroupData): GroupNode {
  return { id, type: DATASET_GROUP, position, data, deletable: false };
}

function membersOf(nodes: Node[], groupId: string) {
  return nodes.filter(
    (node): node is FlowNode => node.type === DATASET_NODE && node.parentNode === groupId,
  );
}

export function groupNodes(
  nodes: GraphNode[],
  edges: Edge[],
  catalog: NodeCatalog,
  memberIds: string[],
  groupId: string,
): Node[] {
  const members = nodes.filter((node) => memberIds.includes(node.id));
  const left = Math.min(...members.map((node) => node.computedPosition.x));
  const top = Math.min(...members.map((node) => node.computedPosition.y));

  const real = edges.filter((edge) => !isStandIn(edge));
  const onlyInside = (links: Edge[]) =>
    links.length > 0 &&
    links.every((edge) => memberIds.includes(edge.source) && memberIds.includes(edge.target));
  const exposed = (side: GroupSide) =>
    members.flatMap((node) =>
      (findKind(catalog, node.data.kind)?.[side] ?? [])
        .filter(
          (port) =>
            !onlyInside(
              real.filter((edge) =>
                side === "inputs"
                  ? edge.target === node.id && edge.targetHandle === port.id
                  : edge.source === node.id && edge.sourceHandle === port.id,
              ),
            ),
        )
        .map((port) => ({ node: node.id, port: port.id })),
    );

  return [
    groupNode(
      groupId,
      { x: left, y: top },
      {
        name: null,
        inputs: exposed("inputs"),
        outputs: exposed("outputs"),
        inputPosition: null,
        outputPosition: null,
      },
    ),
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

export function groupGraph(graph: DatasetGraph, groupId: string): DatasetGraph {
  const group = graph.groups.find((group) => group.id === groupId)!;
  const members = new Set(group.nodes);
  return {
    version: 1,
    nodes: graph.nodes.filter((node) => members.has(node.id)),
    edges: graph.edges.filter((edge) => members.has(edge.source) && members.has(edge.target)),
    groups: [{ ...group, position: { x: 0, y: 0 } }],
  };
}

export function copyGroupGraph(graph: DatasetGraph, position: XYPosition): DatasetGraph {
  const ids = new Map(
    [...graph.nodes, ...graph.groups].map((item) => [item.id, crypto.randomUUID()]),
  );
  const copied = (id: string) => ids.get(id)!;
  const copiedPort = (port: GroupPort) => ({ ...port, node: copied(port.node) });
  return {
    version: 1,
    nodes: graph.nodes.map((node) => ({ ...node, id: copied(node.id) })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      id: crypto.randomUUID(),
      source: copied(edge.source),
      target: copied(edge.target),
    })),
    groups: graph.groups.map((group) => ({
      ...group,
      id: copied(group.id),
      position,
      nodes: group.nodes.map(copied),
      inputs: group.inputs.map(copiedPort),
      outputs: group.outputs.map(copiedPort),
    })),
  };
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

export function openGroup(nodes: GraphNode[], edges: Edge[], groupId: string) {
  const group = nodes.find((node): node is GraphNode<GroupData> => node.id === groupId)!;
  const members = membersOf(nodes, groupId);
  const top = Math.min(...members.map((node) => node.position.y));
  const left = Math.min(...members.map((node) => node.position.x)) - PORTS_NODE_WIDTH - VIEW_GAP;
  const right = Math.max(...members.map((node) => node.position.x)) + NODE_WIDTH + VIEW_GAP;
  const portsNode = (type: string, position: XYPosition): Node => ({
    id: type,
    type,
    parentNode: groupId,
    position,
    data: {},
    deletable: false,
  });

  return {
    nodes: [
      ...nodes.map((node) => ({ ...node, hidden: node.parentNode !== groupId })),
      portsNode(GROUP_INPUT, group.data.inputPosition ?? { x: left, y: top }),
      portsNode(GROUP_OUTPUT, group.data.outputPosition ?? { x: right, y: top }),
    ],
    edges: [
      ...edges,
      ...group.data.inputs.map((port) => groupPortEdge("inputs", port)),
      ...group.data.outputs.map((port) => groupPortEdge("outputs", port)),
    ],
  };
}

export function closeGroup(nodes: Node[], edges: Edge[]) {
  const groups = new Set(
    nodes.flatMap((node) => (node.type === DATASET_NODE && node.parentNode ? node.parentNode : [])),
  );
  const closed = nodes
    .filter((node) => node.type === DATASET_NODE || groups.has(node.id))
    .map((node) => ({
      ...node,
      hidden: !!node.parentNode,
      data:
        node.type === DATASET_GROUP
          ? { ...node.data, ...portPositions(nodes, node as GroupNode) }
          : node.data,
    }));
  const ids = new Set(closed.map((node) => node.id));
  return {
    nodes: closed,
    edges: withGroupEdges(
      closed,
      edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    ),
  };
}

export function portPositions(nodes: Node[], group: GroupNode) {
  const shownAt = (type: string) =>
    nodes.find((node) => node.type === type && node.parentNode === group.id)?.position;
  return {
    inputPosition: shownAt(GROUP_INPUT) ?? group.data.inputPosition,
    outputPosition: shownAt(GROUP_OUTPUT) ?? group.data.outputPosition,
  };
}

export function groupPortEdge(side: GroupSide, { node, port }: GroupPort): Edge {
  const handle = memberHandle(node, port);
  return side === "inputs"
    ? {
        id: `${GROUP_INPUT}:${handle}`,
        source: GROUP_INPUT,
        target: node,
        targetHandle: port,
      }
    : {
        id: `${GROUP_OUTPUT}:${handle}`,
        source: node,
        sourceHandle: port,
        target: GROUP_OUTPUT,
      };
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

export function memberPorts(nodes: Node[], catalog: NodeCatalog, groupId: string) {
  const group = nodes.find((node): node is GroupNode => node.id === groupId);
  if (!group) return [];
  return membersOf(nodes, groupId).flatMap((node) => {
    const kind = findKind(catalog, node.data.kind);
    if (!kind) return [];
    const exposed = (side: GroupSide) =>
      kind[side]
        .filter((port) =>
          group.data[side].some((exposed) => exposed.node === node.id && exposed.port === port.id),
        )
        .map((port) => ({ ...port, handle: memberHandle(node.id, port.id) }));
    const inputs = exposed("inputs");
    const outputs = exposed("outputs");
    if (!inputs.length && !outputs.length) return [];
    return [{ id: node.id, label: kind.label, inputs, outputs }];
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
