import { useVueFlow } from "@vue-flow/core";

// The canvas's nodes and connections as a plain graph (see `requestOf`)
export function useFlowGraph() {
  const { nodes, edges } = useVueFlow(FLOW_ID);
  return computed<GraphLike>(() => ({ nodes: nodes.value, edges: edges.value }));
}
