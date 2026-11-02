import type { QueryClient } from "@tanstack/vue-query";

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
