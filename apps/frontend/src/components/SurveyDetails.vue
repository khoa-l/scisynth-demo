<script setup lang="ts">
import { Trash2 } from "@lucide/vue";
import { makeDroppable } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";

import FolderTabs from "@/components/FolderTabs.vue";
import SurveyBlockPalette from "@/components/SurveyBlockPalette.vue";
import { TASK_BLOCK } from "@/lib/survey-blocks";

const tabs = [{ label: "General" }, { label: "Data" }];

const details = useTemplateRef<HTMLElement>("details");
const { isOver, isAccepting } = makeDroppable(details, {
  label: "Trash",
  accept: ({ active }) => active.data === TASK_BLOCK,
  onDrop: (event) => event.source?.remove(),
});
</script>

<template>
  <div ref="details" role="group" aria-label="Survey details" class="relative h-full">
    <FolderTabs v-slot="{ tab }" :tabs="tabs" label="Survey sections">
      <SurveyBlockPalette v-if="tab.label === 'General'" />
    </FolderTabs>
    <div
      v-if="isAccepting"
      class="absolute inset-0 z-20 flex items-center justify-center gap-2 border-2 border-dashed bg-background/90 text-sm text-muted-foreground transition-colors"
      :class="{ 'border-destructive bg-destructive/10 text-destructive': isOver }"
    >
      <Trash2 />
      Drop here to remove
    </div>
  </div>
</template>
