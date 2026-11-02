<script setup lang="ts">
import { Globe, GlobeOff } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import type { SurveyPublic } from "@/client";
import {
  surveysGetSurveyQueryKey,
  surveysGetSurveysQueryKey,
  surveysPublishSurveyMutation,
  surveysUnpublishSurveyMutation,
} from "@/client/@tanstack/vue-query.gen";
import { Button } from "@/components/ui/button";

const props = defineProps<{ projectId: string; survey: SurveyPublic; iconOnly?: boolean }>();

const queryClient = useQueryClient();

function store(survey: SurveyPublic) {
  const path = { project_id: props.projectId };
  queryClient.setQueryData(
    surveysGetSurveyQueryKey({ path: { ...path, survey_id: survey.id } }),
    survey,
  );
  queryClient.setQueryData<SurveyPublic[]>(surveysGetSurveysQueryKey({ path }), (list) =>
    list?.map((item) => (item.id === survey.id ? survey : item)),
  );
}

const publish = useMutation({ ...surveysPublishSurveyMutation(), onSuccess: store });
const unpublish = useMutation({ ...surveysUnpublishSurveyMutation(), onSuccess: store });

const published = computed(() => props.survey.published_version != null);
const label = computed(() => (published.value ? "Unpublish" : "Publish"));
const pending = computed(() => publish.isPending.value || unpublish.isPending.value);

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
    :disabled="pending"
    @click="toggle"
  >
    <GlobeOff v-if="published" />
    <Globe v-else />
  </Button>
  <Button v-else variant="outline" size="lg" class="h-10 px-4" :disabled="pending" @click="toggle">
    <GlobeOff v-if="published" data-icon="inline-start" />
    <Globe v-else data-icon="inline-start" />
    {{ label }}
  </Button>
</template>
