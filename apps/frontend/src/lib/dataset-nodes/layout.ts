import { Graph, layout } from "@dagrejs/dagre";
import type { Edge, GraphNode, Node } from "@vue-flow/core";

import { DATASET_NODE } from "./graph";

const NODE_TOOLBAR = 40;
const NODE_GAP = 48;
const RANK_GAP = 96;
const PREVIEW_GAP = 8;

export function autoLayout(nodes: GraphNode[], edges: Edge[], parentNode?: string): Node[] {
  const graph = new Graph();
  graph.setGraph({ rankdir: "LR", nodesep: NODE_GAP, ranksep: RANK_GAP });
  graph.setDefaultEdgeLabel(() => ({}));

  const previewSpace = (node: GraphNode) =>
    node.type === DATASET_NODE && !node.data.previewHidden
      ? node.dimensions.width + PREVIEW_GAP
      : 0;
  const level = nodes.filter((node) => node.parentNode === parentNode);
  const ids = new Set(level.map((node) => node.id));
  for (const node of level) {
    graph.setNode(node.id, {
      width: node.dimensions.width,
      height: previewSpace(node) + node.dimensions.height + NODE_TOOLBAR,
    });
  }
  const placedAs = (id: string) =>
    ids.has(id) ? id : nodes.find((node) => node.id === id)?.parentNode;
  for (const edge of edges) {
    const source = placedAs(edge.source);
    const target = placedAs(edge.target);
    if (source && target && ids.has(source) && ids.has(target) && source !== target) {
      graph.setEdge(source, target);
    }
  }

  layout(graph);

  return nodes.map((node) => {
    if (!ids.has(node.id)) return node;
    const { x, y, width, height } = graph.node(node.id);
    return { ...node, position: { x: x - width / 2, y: y - height / 2 + previewSpace(node) } };
  });
}
