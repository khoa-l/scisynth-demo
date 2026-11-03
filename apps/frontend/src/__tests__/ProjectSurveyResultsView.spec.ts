import { describe, it, expect } from "vite-plus/test";

import ProjectSurveyResultsView from "../views/ProjectSurveyResultsView.vue";
import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, mountPage, requests } from "./helpers";

async function mountView(response = jsonResponse(SURVEY)) {
  fetchMock.mockResolvedValue(response);
  const { wrapper } = await mountPage(ProjectSurveyResultsView, {
    props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
  });
  return wrapper;
}

describe("Survey results view", () => {
  it("shows it's the survey's results page in the heading", async () => {
    const wrapper = await mountView();

    expect(new URL(requests()[0]!.url).pathname).toBe(
      `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`,
    );
    expect(wrapper.find("h1").text()).toBe("Protein folding / Intake form / Results");
  });

  it("goes back to the survey's builder", async () => {
    const wrapper = await mountView();

    const back = wrapper.find("a");
    expect(back.text()).toBe("Back to Builder");
    expect(back.attributes("href")).toBe(`/project/${PROJECT_ID}/survey/${SURVEY.id}`);
    expect(back.find("svg[data-icon=inline-start]").exists()).toBe(true);
  });

  it("has a single blank canvas", async () => {
    const wrapper = await mountView();

    const sections = wrapper.findAll("section");
    expect(sections.map((section) => section.attributes("aria-label"))).toEqual(["Canvas"]);
    expect(sections[0]!.classes()).toContain("flex-1");
    expect(sections[0]!.text()).toBe("");
  });

  it("says when the survey can't be found", async () => {
    const wrapper = await mountView(jsonResponse({ detail: "Survey not found" }, 404));

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.text()).toContain("This survey couldn't be found.");
    expect(wrapper.find("section").exists()).toBe(false);
  });
});
