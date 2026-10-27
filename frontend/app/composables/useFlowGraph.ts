import { useVueFlow } from "@vue-flow/core";

// The canvas's nodes and connections as a plain graph (see `requestOf`). It holds only what a request
// is made from, not where the nodes are, so moving a node does not change it (nor what reads it).
export function useFlowGraph() {
  const { nodes, edges } = useVueFlow(FLOW_ID);
  // a string, which only counts as a change when it differs
  const asked = computed(() =>
    JSON.stringify({
      nodes: nodes.value.map((n) => ({
        id: n.id,
        parentNode: n.parentNode,
        data: { type: n.data?.type, params: n.data?.params, axes: n.data?.axes },
      })),
      edges: edges.value.map((e) => ({
        source: e.source,
        target: e.target,
        targetHandle: e.targetHandle,
      })),
    }),
  );
  return computed<GraphLike>(() => JSON.parse(asked.value));
}
