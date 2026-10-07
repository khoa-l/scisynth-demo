// The rows of the copy of a source a component keeps (a Data node or an Observer), from the backend,
// which runs the copy it has saved. Changes with the copy. The first rows, or (`points`) all the rows
// there is room for, to plot them.
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
