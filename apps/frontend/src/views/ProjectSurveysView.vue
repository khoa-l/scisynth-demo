<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import {
  surveysCreateSurveyMutation,
  surveysGetSurveysQueryKey,
} from "@/client/@tanstack/vue-query.gen";
import SurveyList from "@/components/SurveyList.vue";
import NewItemButton from "@/components/NewItemButton.vue";
import ProjectPage from "@/components/ProjectPage.vue";

const props = defineProps<{ projectId: string }>();

const queryClient = useQueryClient();

const { mutateAsync: createSurvey } = useMutation({
  ...surveysCreateSurveyMutation(),
  onSuccess: () => {
    void queryClient.invalidateQueries({
      queryKey: surveysGetSurveysQueryKey({ path: { project_id: props.projectId } }),
    });
  },
});
</script>

<template>
  <ProjectPage :project-id="projectId">
    <NewItemButton
      label="New Survey"
      title="New survey"
      description="Give your survey a name."
      initial-name="untitled-survey"
      :create="(name) => createSurvey({ path: { project_id: projectId }, body: { name } })"
    />
    <SurveyList class="mt-6" :project-id="projectId" />
  </ProjectPage>
</template>
