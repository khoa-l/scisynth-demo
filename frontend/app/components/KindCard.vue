<script setup lang="ts">
const props = defineProps<{
  type?: string;
  label?: string;
  width?: number;
  container?: boolean; // a container's card is see-through; its parts paint themselves
  body?: boolean;
  link?: { to: string; title: string }; // an icon in the header that goes elsewhere
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
      ...(container
        ? { '--vf-node-bg': 'transparent' }
        : body
          ? { '--vf-node-bg': 'var(--node-surface)' }
          : {}),
    }"
  >
    <div
      class="relative flex items-center justify-center gap-1.5"
      :class="body && 'border-b px-2.5 py-2.5 -mx-2.5 -mt-2.5 rounded-t-[2px]'"
      :style="body ? { backgroundColor: 'var(--cat-bg)', borderColor: 'var(--vf-node-color)' } : {}"
    >
      <UIcon :name="kind.icon" class="size-3.5 shrink-0" :style="{ color: 'var(--cat-fg)' }" />
      <span>{{ label ?? kind.label }}</span>
      <NuxtLink
        v-if="link"
        :to="link.to"
        :title="link.title"
        :aria-label="link.title"
        class="nodrag absolute right-1.5 text-muted hover:text-highlighted"
      >
        <UIcon name="i-lucide-list-checks" class="size-3.5" />
      </NuxtLink>
    </div>
    <slot />
  </div>
</template>
