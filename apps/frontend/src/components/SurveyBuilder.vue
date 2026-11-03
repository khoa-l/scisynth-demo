<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { makeSortableList } from "@vue-dnd-kit/core";
import { computed, useTemplateRef } from "vue";

import type { SurveyPublic } from "@/client";
import { surveysUpdateSurveyMutation } from "@/client/@tanstack/vue-query.gen";
import SortableRow from "@/components/SortableRow.vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  storeSurvey,
  surveyMutationScope,
  surveySaveKey,
  useSurveySaveFailed,
} from "@/lib/survey-cache";
import {
  SURVEY_BLOCK_GROUP,
  TASK_BLOCK,
  blockLabels,
  surveyBlocks,
  surveyColumnClass,
  type SurveyBlock,
} from "@/lib/survey-blocks";

const props = defineProps<{ projectId: string; survey: SurveyPublic }>();

const queryClient = useQueryClient();
const blocks = computed(() => surveyBlocks(props.survey.content));

const { mutate } = useMutation(() => ({
  ...surveysUpdateSurveyMutation(),
  mutationKey: surveySaveKey(props.survey.id),
  scope: surveyMutationScope(props.survey.id),
}));
const saveFailed = useSurveySaveFailed(() => props.survey.id);

function show(next: SurveyBlock[]) {
  const content = { ...props.survey.content, blocks: next };
  storeSurvey(queryClient, props.projectId, { ...props.survey, content });
  return content;
}

function save(next: SurveyBlock[]) {
  const content = show(next);
  mutate({
    path: { project_id: props.projectId, survey_id: props.survey.id },
    body: { content },
  });
}

const LIST_ID = "survey-builder";
const zone = useTemplateRef<HTMLElement>("zone");
const list = useTemplateRef<HTMLElement>("list");
const { items } = makeSortableList(list, {
  id: LIST_ID,
  items: () => blocks.value,
  label: "Survey task",
  group: SURVEY_BLOCK_GROUP,
  dropzone: zone,
  onDrop: (event) => {
    event.preventDefault();
    const next = event.result.get(LIST_ID);
    if (next) save(next);
  },
});

function withText(id: string, event: Event) {
  const text = (event.target as HTMLTextAreaElement).value;
  return blocks.value.map((block) => (block.id === id ? { ...block, text } : block));
}
</script>

<template>
  <div
    ref="zone"
    role="group"
    aria-label="Survey builder"
    class="relative h-full overflow-y-auto bg-muted p-4 inset-shadow-sm"
  >
    <p
      v-if="!items.length"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
    >
      Drag a block here to build the task.
    </p>
    <div
      v-if="saveFailed"
      role="alert"
      class="mb-2 flex items-center justify-between gap-2 rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
      :class="surveyColumnClass"
    >
      <span>Couldn't save your changes.</span>
      <Button variant="outline" size="sm" @click="save(blocks)">Try again</Button>
    </div>
    <ol ref="list" class="flex flex-col gap-2" :class="surveyColumnClass">
      <SortableRow
        v-for="block in items"
        :key="block.id"
        :item="block"
        :data="TASK_BLOCK"
        class="flex cursor-grab flex-col gap-1.5 rounded-lg border bg-background p-3 active:cursor-grabbing"
      >
        <span class="text-xs text-muted-foreground">{{ blockLabels[block.type] }}</span>
        <Textarea
          :default-value="block.text"
          aria-label="Text"
          placeholder="Write some text…"
          @input="show(withText(block.id, $event))"
          @change="save(withText(block.id, $event))"
        />
      </SortableRow>
    </ol>
  </div>
</template>
