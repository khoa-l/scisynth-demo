import { useVueFlow } from "@vue-flow/core";

const SAVE_DELAY_MS = 300;

// Saves the canvas (nodes and connections) whenever it differs from `initial`, what was loaded. A
// change is saved after a short pause, a move when the drag ends (not on every frame of it).
export function useGraphSave(studyId: number, initial: { nodes: SavedNode[]; edges: SavedEdge[] }) {
  const { nodes, edges, onNodeDragStop } = useVueFlow(FLOW_ID);

  let lastSaved = JSON.stringify(initial);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function snapshot(withPositions = true) {
    return {
      nodes: nodes.value.map((n): SavedNode => {
        const { type, ...data } = n.data ?? {};
        return {
          id: n.id,
          type: String(type ?? ""),
          label: typeof n.label === "string" ? n.label : "",
          x: withPositions ? n.position.x : 0,
          y: withPositions ? n.position.y : 0,
          parent: n.parentNode ?? null,
          data,
        };
      }),
      edges: edges.value.map((e): SavedEdge => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    };
  }

  async function save() {
    clearTimeout(timer);
    timer = undefined;
    const state = snapshot();
    const serialized = JSON.stringify(state);
    if (serialized === lastSaved) return;
    lastSaved = serialized;
    await $fetch(`/api/studies/${studyId}/graph`, { method: "PUT", body: state });
  }

  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };
  // everything but where the nodes are, which changes on every frame of a drag
  watch(() => JSON.stringify(snapshot(false)), later);
  onNodeDragStop(later);

  // Data cleaned up on loading is saved right away
  onMounted(() => void save());

  // don't lose a pending save on leaving the page
  onBeforeUnmount(() => {
    if (timer) void save();
  });
}
