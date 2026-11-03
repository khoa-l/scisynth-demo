<script setup lang="ts">
import { Globe, GlobeOff } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import {
  surveysPublishSurvey,
  type Options,
  type SurveyPublic,
  type SurveysPublishSurveyData,
} from "@/client";
import { surveysUnpublishSurveyMutation } from "@/client/@tanstack/vue-query.gen";
import { Button } from "@/components/ui/button";
import {
  lastSaveFailed,
  storeSurvey,
  surveyMutationScope,
  useSurveySaveFailed,
} from "@/lib/survey-cache";

const props = defineProps<{ projectId: string; survey: SurveyPublic; iconOnly?: boolean }>();

const queryClient = useQueryClient();

function store(survey: SurveyPublic) {
  storeSurvey(queryClient, props.projectId, survey);
}

const publish = useMutation(() => ({
  scope: surveyMutationScope(props.survey.id),
  mutationFn: async (options: Options<SurveysPublishSurveyData>) => {
    if (lastSaveFailed(queryClient, options.path.survey_id)) {
      throw new Error("The survey has unsaved changes");
    }
    const { data } = await surveysPublishSurvey({ ...options, throwOnError: true });
    return data;
  },
  onSuccess: store,
}));
const unpublish = useMutation(() => ({
  ...surveysUnpublishSurveyMutation(),
  scope: surveyMutationScope(props.survey.id),
  onSuccess: store,
}));

const saveFailed = useSurveySaveFailed(() => props.survey.id);
const published = computed(() => props.survey.published_version != null);
const label = computed(() => (published.value ? "Unpublish" : "Publish"));
const pending = computed(() => publish.isPending.value || unpublish.isPending.value);
const disabled = computed(() => pending.value || (!published.value && saveFailed.value));

function toggle() {
  const options = { path: { project_id: props.projectId, survey_id: props.survey.id } };
  if (published.value) unpublish.mutate(options);
  else publish.mutate(options);
}
</script>

<template>
  <Button
    v-if="iconOnly"
    variant="outline"
    size="icon-sm"
    :aria-label="`${label} survey`"
    :disabled="disabled"
    @click="toggle"
  >
    <GlobeOff v-if="published" />
    <Globe v-else />
  </Button>
  <Button v-else variant="outline" size="lg" class="h-10 px-4" :disabled="disabled" @click="toggle">
    <GlobeOff v-if="published" data-icon="inline-start" />
    <Globe v-else data-icon="inline-start" />
    {{ label }}
  </Button>
</template>
