<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import {
  publicGetPublishedOptions,
  publicSubmitResponseMutation,
} from "@/client/@tanstack/vue-query.gen";
import SurveyTask from "@/components/SurveyTask.vue";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { surveyColumnClass, type Answers } from "@/lib/survey-blocks";
import { publishedCharts } from "@/lib/survey-charts";

const props = defineProps<{ publicId: string }>();

const {
  data: survey,
  isPending,
  isError,
} = useQuery(
  computed(() => ({
    ...publicGetPublishedOptions({ path: { public_id: props.publicId } }),
    retry: false,
  })),
);

const {
  mutate,
  isPending: isSubmitting,
  isSuccess: isSubmitted,
  isError: submitFailed,
} = useMutation(publicSubmitResponseMutation());

function submit(versionId: string, answers: Answers) {
  mutate({
    path: { public_id: props.publicId },
    body: { version_id: versionId, data: answers },
  });
}
</script>

<template>
  <main class="flex min-h-svh items-start justify-center bg-muted p-4 sm:py-12">
    <p v-if="isPending" class="text-sm text-muted-foreground">Loading survey…</p>
    <p v-else-if="isError || !survey" class="text-sm text-muted-foreground">
      This survey isn't available.
    </p>
    <Card v-else-if="isSubmitted" :class="surveyColumnClass">
      <CardHeader>
        <CardTitle>{{ survey.name }}</CardTitle>
        <CardDescription>Thanks, your response has been recorded.</CardDescription>
      </CardHeader>
    </Card>
    <div v-else class="flex flex-col gap-4" :class="surveyColumnClass">
      <SurveyTask
        :name="survey.name"
        :content="survey.content"
        :charts="publishedCharts(publicId, survey.version_id)"
        :submitting="isSubmitting"
        @submit="submit(survey.version_id, $event)"
      />
      <Alert v-if="submitFailed" variant="destructive" class="shadow-sm">
        <CircleAlert />
        <AlertTitle>Couldn't send your response. Please try again.</AlertTitle>
      </Alert>
    </div>
  </main>
</template>
