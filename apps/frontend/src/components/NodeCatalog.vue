<script setup lang="ts">
import FolderTabs from "@/components/FolderTabs.vue";
import { NODE_KIND_MIME, nodeCategories } from "@/lib/node-kinds";
import { paletteItemClass, paletteListClass } from "@/lib/palette";

function startDrag(event: DragEvent, name: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(NODE_KIND_MIME, name);
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <FolderTabs v-slot="{ tab: category }" :tabs="nodeCategories" label="Component categories">
    <ul :class="paletteListClass">
      <li
        v-for="kind in category.kinds"
        :key="kind.name"
        draggable="true"
        :class="paletteItemClass"
        @dragstart="startDrag($event, kind.name)"
      >
        {{ kind.label }}
      </li>
    </ul>
  </FolderTabs>
</template>
