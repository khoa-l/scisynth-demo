import type { SurveyBlock } from "../lib/survey-blocks";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, mountPage } from "./helpers";

export const PUBLISHED = { ...SURVEY, public_id: "Jx2k8LmN0pQr4StUv6WxY", published_version: 1 };

export const hello: SurveyBlock = { id: "b1", type: "text", text: "Hello" };
export const goodbye: SurveyBlock = { id: "b2", type: "text", text: "Goodbye" };

export async function mountView(survey: object = SURVEY) {
  fetchMock.mockResolvedValue(jsonResponse(survey));
  const { wrapper } = await mountPage(ProjectSurveyView, {
    props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
  });
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountView>>;

export function findButton(wrapper: Wrapper, label: string) {
  return wrapper.findAll("button").find((button) => button.text() === label);
}

export function preview(wrapper: Wrapper) {
  return wrapper.find('[aria-label="Survey preview"]');
}

export function saveLikeTheServer() {
  fetchMock.mockImplementation(async (input) => {
    const body = await (input as Request).clone().json();
    return jsonResponse({ ...SURVEY, ...body });
  });
}
