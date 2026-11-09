<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { makeSortableList } from "@vue-dnd-kit/core";
import { computed, provide, useTemplateRef } from "vue";

import type { SurveyPublic } from "@/client";
import { surveysUpdateSurveyMutation } from "@/client/@tanstack/vue-query.gen";
import SaveFailedAlert from "@/components/SaveFailedAlert.vue";
import SortableRow from "@/components/SortableRow.vue";
import SurveyChartSettings from "@/components/SurveyChartSettings.vue";
import SurveyLabelSettings from "@/components/SurveyLabelSettings.vue";
import SurveyScale from "@/components/SurveyScale.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { hueBackground } from "@/lib/gradient";
import { saveKey, saveScope, useSaveFailed } from "@/lib/save-state";
import { storeSurvey } from "@/lib/survey-cache";
import {
  SURVEY_BLOCK_GROUP,
  TASK_BLOCK,
  blockHues,
  blockLabels,
  surveyBlocks,
  surveyColumnClass,
  surveyPanelKey,
  type ChartBlock,
  type LabelBlock,
  type SurveyBlock,
} from "@/lib/survey-blocks";

const props = defineProps<{ projectId: string; survey: SurveyPublic }>();

const queryClient = useQueryClient();
const blocks = computed(() => surveyBlocks(props.survey.content));

const { mutate } = useMutation(() => ({
  ...surveysUpdateSurveyMutation(),
  mutationKey: saveKey("survey", props.survey.id),
  scope: saveScope("survey", props.survey.id),
}));
const saveFailed = useSaveFailed(() => saveKey("survey", props.survey.id));

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
provide(surveyPanelKey, zone);
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
  const text = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  return blocks.value.map((block) =>
    block.id === id && "text" in block ? { ...block, text } : block,
  );
}

function withChanges(block: ChartBlock | LabelBlock, changes: Partial<Omit<LabelBlock, "type">>) {
  return blocks.value.map((other) => (other.id === block.id ? { ...block, ...changes } : other));
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
    <SaveFailedAlert v-if="saveFailed" class="mx-auto mb-2" @retry="save(blocks)" />
    <ol ref="list" class="flex flex-col gap-2" :class="surveyColumnClass">
      <SortableRow
        v-for="block in items"
        :key="block.id"
        :item="block"
        :data="TASK_BLOCK"
        class="cursor-grab rounded-lg border bg-background text-sm shadow-sm active:cursor-grabbing"
      >
        <div
          data-slot="block-title"
          class="rounded-t-[calc(var(--radius-lg)-1px)] border-b px-3 py-2 font-medium"
          :style="{ background: hueBackground(blockHues[block.type]) }"
        >
          {{ blockLabels[block.type] }}
        </div>
        <div class="flex flex-col gap-3 p-3">
          <Separator v-if="block.type === 'separator'" />
          <div v-else-if="block.type === 'page'" class="flex justify-between">
            <Button disabled size="sm" variant="outline">Back</Button>
            <Button disabled size="sm">Next</Button>
          </div>
          <Button v-else-if="block.type === 'end'" disabled size="sm" class="self-end"
            >Submit</Button
          >
          <template v-else-if="block.type === 'scale'">
            <Input
              :default-value="block.text"
              aria-label="Question"
              placeholder="Ask a question to rate from 1 to 5…"
              @input="show(withText(block.id, $event))"
              @change="save(withText(block.id, $event))"
            />
            <SurveyScale disabled aria-label="Scale" />
          </template>
          <template v-else-if="block.type === 'chart'">
            <SurveyChartSettings
              :project-id="projectId"
              :block="block"
              @update="save(withChanges(block, $event))"
            />
            <Input
              :default-value="block.text"
              aria-label="Caption"
              placeholder="Add a caption…"
              @input="show(withText(block.id, $event))"
              @change="save(withText(block.id, $event))"
            />
          </template>
          <template v-else-if="block.type === 'label'">
            <Input
              :default-value="block.text"
              aria-label="Instruction"
              placeholder="Tell respondents what to label…"
              @input="show(withText(block.id, $event))"
              @change="save(withText(block.id, $event))"
            />
            <SurveyChartSettings
              :project-id="projectId"
              :block="block"
              @update="save(withChanges(block, $event))"
            />
            <SurveyLabelSettings :block="block" @update="save(withChanges(block, $event))" />
          </template>
          <Textarea
            v-else
            :default-value="block.text"
            aria-label="Text"
            placeholder="Write some text…"
            @input="show(withText(block.id, $event))"
            @change="save(withText(block.id, $event))"
          />
        </div>
      </SortableRow>
    </ol>
  </div>
</template>
