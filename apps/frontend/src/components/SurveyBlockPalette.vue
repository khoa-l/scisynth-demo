<script setup lang="ts">
import { makeSortableList, type OverlayProps } from "@vue-dnd-kit/core";
import { cn } from "cn";
import { h, useTemplateRef } from "vue";

import SortableRow from "@/components/SortableRow.vue";
import { hueBackground } from "@/lib/gradient";
import { paletteItemClass, paletteListClass } from "@/lib/palette";
import {
  SURVEY_BLOCK_GROUP,
  blockHues,
  blockLabels,
  blockTemplates,
  cloneBlock,
  type SurveyBlock,
} from "@/lib/survey-blocks";

function BlockOverlay({ items }: OverlayProps) {
  const block = items[0]?.item as SurveyBlock;
  return h(
    "div",
    {
      class: cn(paletteItemClass, "size-full border-transparent"),
      style: { background: hueBackground(blockHues[block.type]) },
    },
    blockLabels[block.type],
  );
}

const list = useTemplateRef<HTMLElement>("list");
const { items } = makeSortableList(list, {
  items: () => blockTemplates,
  label: "Survey blocks",
  group: { name: SURVEY_BLOCK_GROUP, pull: "clone", put: false },
  sort: false,
  clone: cloneBlock,
  overlay: BlockOverlay,
});
</script>

<template>
  <ul ref="list" :class="paletteListClass">
    <SortableRow
      v-for="block in items"
      :key="block.id"
      :item="block"
      :class="paletteItemClass"
      class="border-transparent"
      :style="{ background: hueBackground(blockHues[block.type]) }"
    >
      {{ blockLabels[block.type] }}
    </SortableRow>
  </ul>
</template>
