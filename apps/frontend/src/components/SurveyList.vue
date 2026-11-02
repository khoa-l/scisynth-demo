<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import type { SurveyPublic } from "@/client";
import {
  surveysDeleteSurveyMutation,
  surveysGetSurveysOptions,
  surveysGetSurveysQueryKey,
  surveysUpdateSurveyMutation,
} from "@/client/@tanstack/vue-query.gen";
import ItemList from "@/components/ItemList.vue";
import SurveyPublishButton from "@/components/SurveyPublishButton.vue";

const props = defineProps<{ projectId: string }>();

const queryClient = useQueryClient();
const key = computed(() => surveysGetSurveysQueryKey({ path: { project_id: props.projectId } }));

const {
  data: surveys,
  isPending,
  isError,
} = useQuery(computed(() => surveysGetSurveysOptions({ path: { project_id: props.projectId } })));

const { mutateAsync: update } = useMutation({
  ...surveysUpdateSurveyMutation(),
  onSuccess: (updated) =>
    queryClient.setQueryData<SurveyPublic[]>(key.value, (list) =>
      list?.map((survey) => (survey.id === updated.id ? updated : survey)),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key.value });
  },
});

const { mutateAsync: remove } = useMutation({
  ...surveysDeleteSurveyMutation(),
  onSuccess: (_, { path }) =>
    queryClient.setQueryData<SurveyPublic[]>(key.value, (list) =>
      list?.filter((survey) => survey.id !== path.survey_id),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key.value });
  },
});
</script>

<template>
  <ItemList
    :items="surveys"
    :is-pending="isPending"
    :is-error="isError"
    noun="survey"
    plural="surveys"
    :to="(survey) => ({ name: 'project-survey', params: { projectId, surveyId: survey.id } })"
    :rename="
      (survey, name) =>
        update({ path: { project_id: projectId, survey_id: survey.id }, body: { name } })
    "
    :remove="(survey) => remove({ path: { project_id: projectId, survey_id: survey.id } })"
  >
    <template #actions="{ item }">
      <SurveyPublishButton :project-id="projectId" :survey="item" icon-only />
    </template>
  </ItemList>
</template>
