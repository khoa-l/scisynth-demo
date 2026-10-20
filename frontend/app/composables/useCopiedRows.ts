// The rows of a component's copied source (a Data node or Observer), run by the backend from the
// saved copy. The first rows, or with `points` as many as can be plotted.
export function useCopiedRows(
  uid: number,
  source: Ref<SourceSnapshot | undefined>,
  rows: "data" | "points" = "data",
) {
  const { taskId, flush } = inject(TASK_CONTEXT)!;
  const table = ref<DataRows>();

  const { status, message, refresh } = useLatestRequest(
    computed(() => JSON.stringify(source.value ?? null)),
    async (signal) => {
      if (!source.value) {
        table.value = undefined;
        return { waiting: "" };
      }
      await flush();
      table.value = await $fetch<DataRows>(`/api/tasks/${taskId.value}/components/${uid}/${rows}`, {
        signal,
      });
    },
  );
  onMounted(refresh);

  return { table, status, message };
}
