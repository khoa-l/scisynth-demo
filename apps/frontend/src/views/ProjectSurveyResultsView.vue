<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { surveysGetSurveyOptions } from "@/client/@tanstack/vue-query.gen";
import ProjectItemPage from "@/components/ProjectItemPage.vue";

const props = defineProps<{ projectId: string; surveyId: string }>();

const { data: survey, isError } = useQuery(
  computed(() =>
    surveysGetSurveyOptions({
      path: { project_id: props.projectId, survey_id: props.surveyId },
    }),
  ),
);
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
    <template #canvas>
      <div class="h-full bg-muted inset-shadow-sm" />
    </template>
  </ProjectItemPage>
</template>
