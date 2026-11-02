import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import type { Component } from "vue";

import { projectsGetProjectQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectPage from "../components/ProjectPage.vue";
import ProjectDatasetsView from "../views/ProjectDatasetsView.vue";
import ProjectItemView from "../views/ProjectItemView.vue";
import ProjectOverviewView from "../views/ProjectOverviewView.vue";
import ProjectResultsView from "../views/ProjectResultsView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import { fetchMock, jsonResponse, mockApi } from "./helpers";

const PROJECT_ID = "V11k9b8XeABv2ISddF304";

mockApi();

function loadedQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(projectsGetProjectQueryKey({ path: { project_id: PROJECT_ID } }), {
    id: PROJECT_ID,
    name: "Protein folding",
    created_at: "2026-11-02T00:00:00Z",
  });
  return queryClient;
}

function mountWith(component: Component, queryClient = new QueryClient()) {
  return mount(component, {
    props: { projectId: PROJECT_ID },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
}

describe("ProjectPage", () => {
  it("loads the project from the API and shows its name as the heading", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: PROJECT_ID,
        name: "Protein folding",
        created_at: "2026-11-02T00:00:00Z",
      }),
    );
    const wrapper = mountWith(ProjectPage);
    await flushPromises();

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe(`/api/projects/${PROJECT_ID}`);
    expect(wrapper.find("h1").text()).toBe("Protein folding");
  });

  it("shows a message when the project can't be found", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Project not found" }, 404));
    const wrapper = mountWith(
      ProjectPage,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );
    await flushPromises();

    expect(wrapper.text()).toContain("This project couldn't be found.");
    expect(wrapper.find("h1").exists()).toBe(false);
  });
});

describe.each([
  ["Overview", ProjectOverviewView],
  ["Results", ProjectResultsView],
])("%s view", (_name, view) => {
  it("shows the project name with no action buttons", async () => {
    const wrapper = mountWith(view, loadedQueryClient());
    await flushPromises();

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});

describe.each([
  ["Datasets", ProjectDatasetsView, "New Dataset"],
  ["Survey", ProjectSurveyView, "New Survey"],
])("%s view", (_name, view, label) => {
  it(`shows the project name and a ${label} button like the Dashboard`, async () => {
    const wrapper = mountWith(view, loadedQueryClient());
    await flushPromises();

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    const button = wrapper.findAll("button").find((b) => b.text() === label)!;
    expect(button.find("svg[data-icon=inline-start]").exists()).toBe(true);
    expect(button.classes()).toEqual(expect.arrayContaining(["h-10", "px-4"]));
  });
});

describe.each([
  ["project-datasets", "Datasets", "datasets"],
  ["project-survey", "Surveys", "survey"],
])("item view going back to %s", (backTo, backLabel, section) => {
  it("shows a back button to the list and two blank canvases side by side", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: { template: "<div />" } },
        {
          path: "/project/:projectId/datasets",
          name: "project-datasets",
          component: { template: "<div />" },
        },
        {
          path: "/project/:projectId/survey",
          name: "project-survey",
          component: { template: "<div />" },
        },
      ],
    });
    await router.push("/");
    const wrapper = mount(ProjectItemView, {
      props: { projectId: PROJECT_ID, backTo, backLabel },
      global: { plugins: [router, [VueQueryPlugin, { queryClient: loadedQueryClient() }]] },
    });
    await flushPromises();

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    const back = wrapper.find("a");
    expect(back.text()).toBe(`Back to ${backLabel}`);
    expect(back.attributes("href")).toBe(`/project/${PROJECT_ID}/${section}`);
    expect(back.find("svg[data-icon=inline-start]").exists()).toBe(true);
    expect(wrapper.findAll("button")).toHaveLength(0);

    const canvases = wrapper.findAll("section");
    expect(canvases.map((canvas) => canvas.attributes("aria-label"))).toEqual([
      "Left canvas",
      "Right canvas",
    ]);
    expect(canvases[0]!.element.parentElement?.classList).toContain("grid-cols-2");
    expect(canvases.every((canvas) => canvas.element.childElementCount === 0)).toBe(true);
  });
});
