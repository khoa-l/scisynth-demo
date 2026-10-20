<script setup lang="ts">
const props = defineProps<{ type: string }>();
const component = computed(() => taskComponentOf(props.type));
</script>

<template>
  <li
    class="flex items-center gap-2 rounded-md border border-dashed border-primary bg-primary/5 px-3 py-3 text-muted"
  >
    <UIcon :name="component.icon" class="size-4" />
    {{ component.label }}
  </li>
</template>
