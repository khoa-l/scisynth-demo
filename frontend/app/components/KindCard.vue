<script setup lang="ts">
const props = defineProps<{
  type?: string;
  label?: string;
  width?: number;
  container?: boolean; // see-through; its parts paint themselves
  body?: boolean;
  link?: { to: string; title: string }; // header icon linking elsewhere
}>();

const kind = computed(() => kindOf(props.type));
</script>

<template>
  <!-- with a body, only the header is coloured -->
  <div
    class="vue-flow__node-default"
    :class="`cat-${kind.category}`"
    :style="{
      width: `${width ?? nodeWidth(kind)}px`,
      ...(container
        ? { '--vf-node-bg': 'transparent' }
        : body
          ? { '--vf-node-bg': 'var(--node-surface)' }
          : {}),
    }"
  >
    <div
      class="grid grid-cols-[1fr_auto_1fr] items-center"
      :class="body && 'border-b px-2.5 py-2.5 -mx-2.5 -mt-2.5 rounded-t-[2px]'"
      :style="body ? { backgroundColor: 'var(--cat-bg)', borderColor: 'var(--vf-node-color)' } : {}"
    >
      <span class="col-start-2 flex items-center gap-1.5">
        <UIcon :name="kind.icon" class="size-3.5 shrink-0" :style="{ color: 'var(--cat-fg)' }" />
        <span>{{ label ?? kind.label }}</span>
      </span>
      <NuxtLink
        v-if="link"
        :to="link.to"
        :title="link.title"
        :aria-label="link.title"
        class="nodrag col-start-3 justify-self-end text-muted hover:text-highlighted"
      >
        <UIcon name="i-lucide-list-checks" class="size-3.5" />
      </NuxtLink>
    </div>
    <slot />
  </div>
</template>
