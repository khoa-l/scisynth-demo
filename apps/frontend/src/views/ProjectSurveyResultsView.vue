<script setup lang="ts">
import { Download } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import {
  surveysGetSurveyOptions,
  surveysGetSurveyResponsesOptions,
  surveysGetSurveyVersionsOptions,
} from "@/client/@tanstack/vue-query.gen";
import ProjectItemPage from "@/components/ProjectItemPage.vue";
import SurveyTask from "@/components/SurveyTask.vue";
import { Button } from "@/components/ui/button";
import { isAnswer, type LabeledPoints } from "@/lib/survey-blocks";
import { versionCharts } from "@/lib/survey-charts";

const props = defineProps<{ projectId: string; surveyId: string }>();

const path = computed(() => ({ project_id: props.projectId, survey_id: props.surveyId }));

const { data: survey, isError } = useQuery(
  computed(() => surveysGetSurveyOptions({ path: path.value })),
);
const {
  data: responses,
  isPending: responsesPending,
  isError: responsesFailed,
} = useQuery(computed(() => surveysGetSurveyResponsesOptions({ path: path.value })));
const { data: versions } = useQuery(
  computed(() => surveysGetSurveyVersionsOptions({ path: path.value })),
);

const selectedId = ref<string | null>(null);
const selected = computed(() =>
  responses.value?.find((response) => response.id === selectedId.value),
);

const version = computed(() =>
  versions.value?.find((version) => version.number === selected.value?.version),
);

const answered = computed(() =>
  Object.fromEntries(
    Object.entries(selected.value?.data ?? {}).filter(
      (entry): entry is [string, number | LabeledPoints] => isAnswer(entry[1]),
    ),
  ),
);

function submittedAt(value: string) {
  return new Date(value).toLocaleString();
}
</script>

<template>
  <ProjectItemPage
    :project-id="projectId"
    noun="survey"
    :item-name="survey?.name"
    page-name="Results"
    :is-error="isError"
    :back-to="{ name: 'project-survey', params: { projectId, surveyId } }"
    back-label="Builder"
  >
    <template #actions>
      <Button variant="outline" size="lg" class="h-10 px-4" :disabled="!responses?.length">
        <Download data-icon="inline-start" />
        Download all responses
      </Button>
    </template>
    <template #left>
      <div role="group" aria-label="Responses" class="h-full overflow-y-auto bg-background p-4">
        <p v-if="responsesPending" class="text-sm text-muted-foreground">Loading responses…</p>
        <p v-else-if="responsesFailed" class="text-sm text-destructive">Couldn't load responses.</p>
        <p v-else-if="!responses?.length" class="text-sm text-muted-foreground">
          No responses yet.
        </p>
        <ul v-else class="flex flex-col gap-1">
          <li v-for="response in responses" :key="response.id" class="group relative">
            <button
              type="button"
              :aria-pressed="response.id === selectedId"
              class="flex w-full items-center justify-between gap-4 rounded-md py-2 pr-12 pl-3 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
              @click="selectedId = response.id"
            >
              <span>{{ submittedAt(response.submitted_at) }}</span>
              <span class="text-muted-foreground">Version {{ response.version }}</span>
            </button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Download response"
              class="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <Download />
            </Button>
          </li>
        </ul>
      </div>
    </template>
    <template #right>
      <div role="group" aria-label="Response" class="h-full overflow-y-auto bg-background p-4">
        <p v-if="!selected" class="text-sm text-muted-foreground">
          Select a response to see its answers.
        </p>
        <div v-else class="flex flex-col gap-4">
          <p class="text-sm text-muted-foreground">
            Submitted {{ submittedAt(selected.submitted_at) }} to version {{ selected.version }}
          </p>
          <SurveyTask
            v-if="survey && version"
            :name="survey.name"
            :content="version.content"
            :charts="versionCharts(projectId, surveyId, version.id)"
            :answered="answered"
          />
        </div>
      </div>
    </template>
  </ProjectItemPage>
</template>
