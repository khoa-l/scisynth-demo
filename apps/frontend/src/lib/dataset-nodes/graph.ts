import type { Edge, Node, XYPosition } from "@vue-flow/core";

import type { DatasetGraphOutput, NodePreviewRequest } from "@/client";

import { canConnect, findKind } from "./catalog";
import { DATASET_GROUP, groupNode, portPositions, withGroupEdges, type GroupNode } from "./groups";
import { isValidParam } from "./params";
import type { NodeCatalog, NodeKindDef, ParamValues } from "./types";

export type DatasetGraph = DatasetGraphOutput;

export const DATASET_NODE = "dataset-node";

export const NAME_MAX_LENGTH = 40;

export interface DatasetNodeData {
  kind: string;
  params: ParamValues;
  name?: string | null;
  previewHidden?: boolean;
}

export type FlowNode = Node<DatasetNodeData> & { data: DatasetNodeData };

export function flowNode(id: string, position: XYPosition, data: DatasetNodeData): FlowNode {
  return { id, type: DATASET_NODE, position, data };
}

export function toGraph(nodes: Node[], edges: Edge[]): DatasetGraph {
  const datasetNodes = nodes.filter((node): node is FlowNode => node.type === DATASET_NODE);
  const ids = new Set(datasetNodes.map((node) => node.id));
  return {
    version: 1,
    nodes: datasetNodes.map(({ id, position: { x, y }, data }) => ({
      id,
      kind: data.kind,
      params: data.params,
      name: data.name ?? null,
      position: { x, y },
      preview_hidden: data.previewHidden ?? false,
    })),
    edges: edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .flatMap(({ id, source, sourceHandle, target, targetHandle }) =>
        sourceHandle && targetHandle
          ? [{ id, source, source_port: sourceHandle, target, target_port: targetHandle }]
          : [],
      ),
    groups: nodes
      .filter((node): node is GroupNode => node.type === DATASET_GROUP)
      .map((group) => {
        const { inputPosition, outputPosition } = portPositions(nodes, group);
        return {
          id: group.id,
          name: group.data.name,
          position: { x: group.position.x, y: group.position.y },
          width: group.data.width,
          height: group.data.height,
          nodes: datasetNodes.filter((node) => node.parentNode === group.id).map((node) => node.id),
          inputs: group.data.inputs,
          outputs: group.data.outputs,
          input_position: inputPosition && { x: inputPosition.x, y: inputPosition.y },
          output_position: outputPosition && { x: outputPosition.x, y: outputPosition.y },
        };
      })
      .filter((group) => group.nodes.length),
  };
}

export function fromGraph(
  graph: DatasetGraph,
  catalog: NodeCatalog,
): { nodes: Node[]; edges: Edge[] } {
  const kindOf = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const parentOf = new Map(
    graph.groups.flatMap((group) => group.nodes.map((node) => [node, group.id])),
  );

  const members = graph.nodes.map(
    ({ id, kind, params, name, position: { x, y }, preview_hidden }) => {
      const def = findKind(catalog, kind);
      const node = flowNode(
        id,
        { x, y },
        {
          kind,
          params: def ? loadParams(def, params) : params,
          name,
          previewHidden: preview_hidden,
        },
      );
      const parentNode = parentOf.get(id);
      return parentNode ? { ...node, parentNode, hidden: true } : node;
    },
  );
  const edges = graph.edges
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
    }));
  const groups = graph.groups.map((group) =>
    groupNode(
      group.id,
      { x: group.position.x, y: group.position.y },
      {
        name: group.name,
        width: group.width,
        height: group.height,
        inputs: group.inputs,
        outputs: group.outputs,
        inputPosition: group.input_position,
        outputPosition: group.output_position,
      },
    ),
  );
  const nodes = [...groups, ...members];
  return { nodes, edges: withGroupEdges(nodes, edges) };
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
