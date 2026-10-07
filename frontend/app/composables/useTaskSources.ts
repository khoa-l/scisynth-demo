// The nodes of a study's workflow that a task's components can show: every Data, Plot and Preview
// node, as the workflow has them now, named by their kind and order ("Data 1", "Plot 2").
export async function useTaskSources(studyId: Ref<number | undefined>) {
  const saved = ref<{ nodes: SavedNode[]; edges: SavedEdge[] }>();
  if (studyId.value !== undefined) {
    saved.value = await $fetch<{ nodes: SavedNode[]; edges: SavedEdge[] }>(
      `/api/studies/${studyId.value}`,
    ).catch(() => undefined);
  }

  const sources = computed<Source[]>(() => {
    if (!saved.value) return [];
    const graph = graphOf(saved.value);
    const counts: Record<string, number> = {};
    return saved.value.nodes
      .filter((n) => SOURCE_KINDS.includes(n.type as SourceKind))
      .map((n) => {
        const kind = n.type as SourceKind;
        counts[kind] = (counts[kind] ?? 0) + 1;
        return {
          nodeId: n.id,
          kind,
          name: `${kindOf(kind).label} ${counts[kind]}`,
          request: requestOf(graph, n.id),
        };
      });
  });
  return sources;
}
