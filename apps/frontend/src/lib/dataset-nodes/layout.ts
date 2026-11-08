import { Graph, layout } from "@dagrejs/dagre";
import type { Edge, GraphNode, Node } from "@vue-flow/core";

import { DATASET_NODE } from "./graph";
import { NODE_GAP, NODE_TOOLBAR } from "./groups";

const RANK_GAP = 96;
const PREVIEW_GAP = 8;

export function autoLayout(nodes: GraphNode[], edges: Edge[]): Node[] {
  const graph = new Graph();
  graph.setGraph({ rankdir: "LR", nodesep: NODE_GAP, ranksep: RANK_GAP });
  graph.setDefaultEdgeLabel(() => ({}));

  const previewSpace = (node: GraphNode) =>
    node.type === DATASET_NODE && !node.data.previewHidden
      ? node.dimensions.width + PREVIEW_GAP
      : 0;
  const topLevel = nodes.filter((node) => !node.parentNode);
  for (const node of topLevel) {
    graph.setNode(node.id, {
      width: node.dimensions.width,
      height: previewSpace(node) + node.dimensions.height + NODE_TOOLBAR,
    });
  }
  const placedAs = (id: string) => nodes.find((node) => node.id === id)?.parentNode ?? id;
  for (const edge of edges) {
    const source = placedAs(edge.source);
    const target = placedAs(edge.target);
    if (source !== target) graph.setEdge(source, target);
  }

  layout(graph);

  return nodes.map((node) => {
    if (node.parentNode) return node;
    const { x, y, width, height } = graph.node(node.id);
    return { ...node, position: { x: x - width / 2, y: y - height / 2 + previewSpace(node) } };
  });
}
