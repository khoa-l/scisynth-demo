const SAVE_DELAY_MS = 300;

// Each task's components, loaded when first shown and saved shortly after any change
export function useTaskComponents(taskId: Ref<number | undefined>) {
  const placed = useState<Record<number, PlacedComponent[]>>("task-components", () => ({}));
  const saved = new Map<number, string>(); // what the backend has
  let timer: ReturnType<typeof setTimeout> | undefined;

  const items = computed(() => (taskId.value ? (placed.value[taskId.value] ?? []) : []));

  watch(
    taskId,
    async (id) => {
      if (id === undefined || id in placed.value) return;
      const { components } = await $fetch<{ components: PlacedComponent[] }>(`/api/tasks/${id}`);
      saved.set(id, JSON.stringify(components));
      placed.value = { ...placed.value, [id]: components };
    },
    { immediate: true },
  );

  function setItems(next: PlacedComponent[]) {
    if (taskId.value) placed.value = { ...placed.value, [taskId.value]: next };
  }

  async function flush() {
    clearTimeout(timer);
    for (const [key, list] of Object.entries(placed.value)) {
      const id = Number(key);
      const json = JSON.stringify(list);
      if (saved.get(id) === json) continue;
      saved.set(id, json);
      await $fetch(`/api/tasks/${id}/components`, { method: "PUT", body: list });
    }
  }

  watch(
    placed,
    () => {
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    },
    { deep: true },
  );
  onBeforeUnmount(() => void flush()); // don't lose a pending save

  return { items, setItems, flush };
}
