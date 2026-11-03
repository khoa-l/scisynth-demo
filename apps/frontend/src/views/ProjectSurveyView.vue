<script setup lang="ts">
import { ChartBar, Link } from "@lucide/vue";
import { DnDProvider } from "@vue-dnd-kit/core";
import { useQuery } from "@tanstack/vue-query";
import { useTimeoutFn } from "@vueuse/core";
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { surveysGetSurveyOptions } from "@/client/@tanstack/vue-query.gen";
import ProjectItemPage from "@/components/ProjectItemPage.vue";
import SurveyBuilder from "@/components/SurveyBuilder.vue";
import SurveyDetails from "@/components/SurveyDetails.vue";
import SurveyTask from "@/components/SurveyTask.vue";
import SurveyPublishButton from "@/components/SurveyPublishButton.vue";
import { Button } from "@/components/ui/button";

const props = defineProps<{ projectId: string; surveyId: string }>();

const { data: survey, isError } = useQuery(
  computed(() =>
    surveysGetSurveyOptions({
      path: { project_id: props.projectId, survey_id: props.surveyId },
    }),
  ),
);

const router = useRouter();
const copied = ref(false);

const shareLink = computed(() => {
  if (survey.value?.published_version == null || !survey.value.public_id) return null;
  const { href } = router.resolve({
    name: "public-survey",
    params: { publicId: survey.value.public_id },
  });
  return new URL(href, window.location.origin).href;
});

const { start: resetCopiedSoon } = useTimeoutFn(() => (copied.value = false), 1500, {
  immediate: false,
});

async function copyLink(link: string) {
  await navigator.clipboard.writeText(link);
  copied.value = true;
  resetCopiedSoon();
}
</script>

<template>
  <ProjectItemPage
    :project-id="projectId"
    noun="survey"
    :item-name="survey?.name"
    :is-error="isError"
    :back-to="{ name: 'project-surveys', params: { projectId } }"
    back-label="Surveys"
  >
    <template #actions>
      <SurveyPublishButton v-if="survey" :project-id="projectId" :survey="survey" />
      <Button
        v-if="shareLink"
        variant="outline"
        size="lg"
        class="h-10 px-4"
        :title="shareLink"
        @click="copyLink(shareLink)"
      >
        <Link data-icon="inline-start" />
        {{ copied ? "Copied" : "Copy link" }}
      </Button>
      <Button variant="outline" size="lg" as-child class="h-10 px-4">
        <RouterLink :to="{ name: 'project-survey-results', params: { projectId, surveyId } }">
          <ChartBar data-icon="inline-start" />
          Results
        </RouterLink>
      </Button>
    </template>
    <template #left>
      <DnDProvider>
        <div class="flex h-full flex-col">
          <div class="min-h-0 flex-3">
            <SurveyBuilder v-if="survey" :project-id="projectId" :survey="survey" />
          </div>
          <div class="min-h-0 flex-1">
            <SurveyDetails />
          </div>
        </div>
      </DnDProvider>
    </template>
    <template #right>
      <div
        role="group"
        aria-label="Survey preview"
        class="h-full overflow-y-auto bg-muted p-4 inset-shadow-sm"
      >
        <SurveyTask v-if="survey" :name="survey.name" :content="survey.content" />
      </div>
    </template>
  </ProjectItemPage>
</template>
