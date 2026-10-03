<script setup lang="ts">
const props = defineProps<{
  type?: string;
  label?: string;
  width?: number;
  container?: boolean; // a container's card is see-through; its parts paint themselves
  body?: boolean;
}>();

const kind = computed(() => kindOf(props.type));
</script>

<template>
  <!-- With a body, only the header carries the category colour and the body stays neutral -->
  <div
    class="vue-flow__node-default"
    :class="`cat-${kind.category}`"
    :style="{
      width: `${width ?? nodeWidth(kind)}px`,
      // a container's card is see-through: its white section and its body paint themselves
      ...(container ? { '--vf-node-bg': 'transparent' } : body ? { '--vf-node-bg': '#fff' } : {}),
    }"
  >
    <div
      class="flex items-center justify-center gap-1.5"
      :class="body && 'border-b px-2.5 py-2.5 -mx-2.5 -mt-2.5 rounded-t-[2px]'"
      :style="body ? { backgroundColor: 'var(--cat-bg)', borderColor: 'var(--vf-node-color)' } : {}"
    >
      <UIcon :name="kind.icon" class="size-3.5 shrink-0" :style="{ color: 'var(--cat-fg)' }" />
      <span>{{ label ?? kind.label }}</span>
    </div>
    <slot />
  </div>
</template>
