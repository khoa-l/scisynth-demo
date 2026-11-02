<script setup lang="ts">
import { makeSortableItem } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";

const props = defineProps<{ item: unknown; data?: unknown }>();

const row = useTemplateRef<HTMLElement>("row");
makeSortableItem(row, { item: () => props.item, data: () => props.data });
</script>

<template>
  <li ref="row">
    <slot />
  </li>
</template>
