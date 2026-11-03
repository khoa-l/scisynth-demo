<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import FolderTabs from "@/components/FolderTabs.vue";
import { NODE_KIND_MIME, nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import { paletteItemClass, paletteListClass } from "@/lib/palette";

const { data: catalog } = useQuery(nodeCatalogQuery);

const tabs = computed(() => {
  const { categories = [], kinds = [] } = catalog.value ?? {};
  return categories.map((category) => ({
    label: category.label,
    kinds: kinds.filter((kind) => kind.category === category.id),
  }));
});

function startDrag(event: DragEvent, name: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(NODE_KIND_MIME, name);
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <FolderTabs v-if="tabs.length" v-slot="{ tab: category }" :tabs="tabs" label="Node categories">
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
