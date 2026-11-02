<script setup lang="ts">
import FolderTabs from "@/components/FolderTabs.vue";
import { NODE_KIND_MIME, nodeCategories, type NodeKind } from "@/lib/node-kinds";

function startDrag(event: DragEvent, kind: NodeKind) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(NODE_KIND_MIME, kind.name);
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <FolderTabs v-slot="{ tab: category }" :tabs="nodeCategories" label="Component categories">
    <ul class="flex flex-wrap gap-1.5">
      <li
        v-for="kind in category.kinds"
        :key="kind.name"
        draggable="true"
        class="cursor-grab rounded-md border bg-background px-2 py-1 text-sm select-none hover:bg-muted active:cursor-grabbing"
        @dragstart="startDrag($event, kind)"
      >
        {{ kind.label }}
      </li>
    </ul>
  </FolderTabs>
</template>
