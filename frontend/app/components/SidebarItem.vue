<script setup lang="ts">
import { useDraggable } from "@dnd-kit/vue";

const props = defineProps<{ kind: NodeKind }>();

const element = ref<HTMLElement>();
const { isDragSource } = useDraggable({
  id: props.kind.type,
  element,
  data: { label: props.kind.label },
});
</script>

<template>
  <div
    ref="element"
    class="side-item flex cursor-grab items-center gap-2 rounded-md border border-default px-3 py-2 select-none touch-none"
    :class="[`cat-${kind.category}`, { 'opacity-60': isDragSource }]"
    :style="{ backgroundColor: 'var(--cat-bg)' }"
  >
    <UIcon :name="kind.icon" class="size-4 shrink-0" :style="{ color: 'var(--cat-fg)' }" />
    {{ kind.label }}
  </div>
</template>
