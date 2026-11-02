<script setup lang="ts">
import { makeSortableList } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";

import SortableRow from "@/components/SortableRow.vue";
import { paletteItemClass, paletteListClass } from "@/lib/palette";
import { SURVEY_BLOCK_GROUP, blockLabels, blockTemplates, cloneBlock } from "@/lib/survey-blocks";

const list = useTemplateRef<HTMLElement>("list");
const { items } = makeSortableList(list, {
  items: () => blockTemplates,
  label: "Survey blocks",
  group: { name: SURVEY_BLOCK_GROUP, pull: "clone", put: false },
  sort: false,
  clone: cloneBlock,
});
</script>

<template>
  <ul ref="list" :class="paletteListClass">
    <SortableRow v-for="block in items" :key="block.id" :item="block" :class="paletteItemClass">
      {{ blockLabels[block.type] }}
    </SortableRow>
  </ul>
</template>
