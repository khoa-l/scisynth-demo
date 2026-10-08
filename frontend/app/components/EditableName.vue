<script setup lang="ts">
// A name shown with a pencil to rename it in place; the default slot sits after the pencil.
const props = defineProps<{ item: { name: string }; save: () => Promise<unknown> }>();

const { editing, start, finish } = useRename(props.item, props.save);
</script>

<template>
  <UInput
    v-if="editing"
    v-model="item.name"
    autofocus
    size="sm"
    :aria-label="`Name of ${item.name}`"
    @keydown.enter="finish"
    @keydown.esc="finish"
    @blur="finish"
  />
  <template v-else>
    <span>{{ item.name }}</span>
    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="`Rename ${item.name}`"
      @click="start"
    />
    <slot />
  </template>
</template>
