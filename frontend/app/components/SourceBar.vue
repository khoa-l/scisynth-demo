<script setup lang="ts">
const props = defineProps<{ kinds: SourceKind[] }>();
const snapshot = defineModel<SourceSnapshot>();

const { sources } = inject(TASK_CONTEXT)!;
const choices = computed(() =>
  sources.value
    .filter((s) => props.kinds.includes(s.kind))
    .map((s) => ({
      label: s.request && !s.request.waiting ? s.name : `${s.name} (not ready)`,
      value: s.nodeId,
      disabled: !s.request || !!s.request.waiting,
    })),
);

// copy the source as the workflow has it now
function copy(nodeId: string) {
  const source = sources.value.find((s) => s.nodeId === nodeId);
  if (source?.request && !source.request.waiting) {
    snapshot.value = { nodeId, name: source.name, request: source.request };
  }
}

// the node in the workflow, on the canvas
const route = useRoute();
const nodeLink = computed(
  () => `/admin/studies/${route.params.id}?node=${encodeURIComponent(snapshot.value!.nodeId)}`,
);

// how the copy compares with its node in the workflow now
const state = computed(() => {
  if (!snapshot.value) return undefined;
  const live = sources.value.find((s) => s.nodeId === snapshot.value!.nodeId);
  if (!live) return { status: "gone", text: "The node is gone from the workflow" };
  if (!live.request || live.request.waiting) {
    return { status: "waiting", text: "The node is not ready in the workflow" };
  }
  if (JSON.stringify(live.request) !== JSON.stringify(snapshot.value.request)) {
    return { status: "stale", text: "Out of sync with the workflow" };
  }
  return { status: "synced", text: "In sync with the workflow" };
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <USelect
      :model-value="snapshot?.nodeId"
      :items="choices"
      placeholder="Choose a source"
      size="sm"
      class="w-48"
      aria-label="Source"
      @update:model-value="copy"
    />
    <UButton
      v-if="state && state.status !== 'gone'"
      :to="nodeLink"
      icon="i-lucide-workflow"
      size="xs"
      variant="ghost"
      color="neutral"
      aria-label="Go to the node in the workflow"
      title="Go to the node in the workflow"
    />
    <template v-if="state">
      <UBadge
        :label="state.text"
        :color="state.status === 'synced' ? 'neutral' : 'warning'"
        variant="subtle"
      />
      <UButton
        v-if="state.status === 'stale'"
        label="Refresh"
        icon="i-lucide-refresh-cw"
        size="xs"
        variant="soft"
        @click="copy(snapshot!.nodeId)"
      />
    </template>
  </div>
</template>
