import { describe, it, expect } from "vite-plus/test";

import ProjectDatasetView from "../views/ProjectDatasetView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import {
  DATASET,
  PROJECT_ID,
  SURVEY,
  fetchMock,
  jsonResponse,
  mountPage,
  requests,
} from "./helpers";

describe.each([
  {
    name: "Dataset",
    view: ProjectDatasetView,
    props: { datasetId: DATASET.id },
    item: DATASET,
    url: `/api/projects/${PROJECT_ID}/datasets/${DATASET.id}`,
    noun: "dataset",
    backLabel: "Datasets",
    backPath: `/project/${PROJECT_ID}/dataset`,
    actions: [],
  },
  {
    name: "Survey",
    view: ProjectSurveyView,
    props: { surveyId: SURVEY.id },
    item: SURVEY,
    url: `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`,
    noun: "survey",
    backLabel: "Surveys",
    backPath: `/project/${PROJECT_ID}/survey`,
    actions: ["Publish", "Results"],
  },
])("$name view page", ({ view, props, item, url, noun, backLabel, backPath, actions }) => {
  async function mountView(response = jsonResponse(item)) {
    fetchMock.mockResolvedValue(response);
    const { wrapper } = await mountPage(view, { props: { projectId: PROJECT_ID, ...props } });
    return wrapper;
  }

  it("loads the item and shows its name after the project name", async () => {
    const wrapper = await mountView();

    expect(new URL(requests()[0]!.url).pathname).toBe(url);
    expect(wrapper.find("h1").text()).toBe(`Protein folding / ${item.name}`);
    expect(wrapper.find("h1 span").classes()).toContain("text-muted-foreground");
  });

  it("shows a back button, its actions, and two canvases side by side", async () => {
    const wrapper = await mountView();

    const back = wrapper.find("a");
    expect(back.text()).toBe(`Back to ${backLabel}`);
    expect(back.attributes("href")).toBe(backPath);
    expect(back.find("svg[data-icon=inline-start]").exists()).toBe(true);
    const toolbar = [...back.element.parentElement!.children].slice(1);
    expect(toolbar.map((element) => element.textContent?.trim())).toEqual(actions);
    expect(wrapper.findAll("section").map((s) => s.attributes("aria-label"))).toEqual([
      "Left canvas",
      "Right canvas",
    ]);
  });

  it("says when the item can't be found", async () => {
    const wrapper = await mountView(jsonResponse({ detail: "Not found" }, 404));

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.text()).toContain(`This ${noun} couldn't be found.`);
    expect(wrapper.find("section").exists()).toBe(false);
    expect(wrapper.find("a").text()).toBe(`Back to ${backLabel}`);
  });
});
