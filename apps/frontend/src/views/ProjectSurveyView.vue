<script setup lang="ts">
import { Link } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { surveysGetSurveyOptions } from "@/client/@tanstack/vue-query.gen";
import FolderTabs from "@/components/FolderTabs.vue";
import ProjectItemPage from "@/components/ProjectItemPage.vue";
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

const builderTabs = [{ label: "General" }, { label: "Data" }];

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

async function copyLink(link: string) {
  await navigator.clipboard.writeText(link);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <ProjectItemPage
    :project-id="projectId"
    noun="survey"
    :item-name="survey?.name"
    :is-error="isError"
    back-to="project-surveys"
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
    </template>
    <template #left>
      <div class="flex h-full flex-col">
        <div
          role="group"
          aria-label="Survey builder"
          class="min-h-0 flex-3 bg-muted inset-shadow-sm"
        />
        <div role="group" aria-label="Survey details" class="min-h-0 flex-1">
          <FolderTabs :tabs="builderTabs" label="Survey sections" />
        </div>
      </div>
    </template>
    <template #right>
      <div role="group" aria-label="Survey preview" class="h-full bg-muted inset-shadow-sm" />
    </template>
  </ProjectItemPage>
</template>
