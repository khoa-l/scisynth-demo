import { useMutationState, type QueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

import type { SurveyPublic } from "@/client";
import {
  surveysGetSurveyQueryKey,
  surveysGetSurveysQueryKey,
} from "@/client/@tanstack/vue-query.gen";

export function storeSurvey(queryClient: QueryClient, projectId: string, survey: SurveyPublic) {
  const path = { project_id: projectId };
  queryClient.setQueryData(
    surveysGetSurveyQueryKey({ path: { ...path, survey_id: survey.id } }),
    survey,
  );
  queryClient.setQueryData<SurveyPublic[]>(surveysGetSurveysQueryKey({ path }), (list) =>
    list?.map((item) => (item.id === survey.id ? survey : item)),
  );
}

/** Saves and (un)publishes of one survey share a scope, so they run one at a time, in order. */
export function surveyMutationScope(surveyId: string) {
  return { id: `survey:${surveyId}` };
}

export function surveySaveKey(surveyId: string) {
  return ["survey-save", surveyId];
}

export function lastSaveFailed(queryClient: QueryClient, surveyId: string) {
  const saves = queryClient.getMutationCache().findAll({ mutationKey: surveySaveKey(surveyId) });
  return saves[saves.length - 1]?.state.status === "error";
}

export function useSurveySaveFailed(surveyId: () => string) {
  const statuses = useMutationState(() => ({
    filters: { mutationKey: surveySaveKey(surveyId()) },
    select: (mutation) => mutation.state.status,
  }));
  return computed(() => statuses.value[statuses.value.length - 1] === "error");
}
