<script setup lang="ts">
const props = defineProps<{ type?: string; label?: string }>();

const kind = computed(() => kindOf(props.type, props.label));
</script>

<template>
  <div
    class="vue-flow__node-default"
    :class="`cat-${kind.category}`"
    :style="{ width: `${nodeWidth(kind)}px` }"
  >
    <div class="flex items-center justify-center gap-1.5">
      <UIcon :name="kind.icon" class="size-3.5 shrink-0" :style="{ color: 'var(--cat-fg)' }" />
      <span>{{ label ?? kind.label }}</span>
    </div>
    <slot />
  </div>
</template>
