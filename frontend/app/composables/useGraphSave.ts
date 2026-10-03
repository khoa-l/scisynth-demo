import { useVueFlow } from "@vue-flow/core";

const SAVE_DELAY_MS = 300;

// Saves the study's canvas state (nodes and connections) to the backend whenever anything is
// added, moved or removed. `initial` is what was loaded, so nothing is sent until something
// differs from it.
export function useGraphSave(studyId: number, initial: { nodes: SavedNode[]; edges: SavedEdge[] }) {
  const { nodes, edges } = useVueFlow(FLOW_ID);

  let lastSaved = JSON.stringify(initial);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function snapshot() {
    return {
      nodes: nodes.value.map((n): SavedNode => {
        const { type, ...data } = n.data ?? {};
        return {
          id: n.id,
          type: String(type ?? ""),
          label: typeof n.label === "string" ? n.label : "", // ours are always text
          x: n.position.x,
          y: n.position.y,
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

  watch(
    () => JSON.stringify(snapshot()),
    () => {
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    },
  );

  // Data cleaned up on loading (connections to an input that no longer exists, an older Observer
  // converted to the list) is saved right away; when nothing changed, nothing differs, nothing is sent
  onMounted(() => void save());

  // Don't lose a pending save when leaving the page
  onBeforeUnmount(() => {
    if (timer) void save();
  });
}
