import { afterEach, beforeEach, describe, it, expect, vi } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import type { Component } from "vue";

import { client } from "../client/client.gen";
import { projectsGetProjectQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectPage from "../components/ProjectPage.vue";
import ProjectDataView from "../views/ProjectDataView.vue";
import ProjectOverviewView from "../views/ProjectOverviewView.vue";
import ProjectResultsView from "../views/ProjectResultsView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";

const PROJECT_ID = "3f2b8c1e-5d4a-4e6f-9b7c-0a1d2e3f4a5b";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  client.setConfig({ baseUrl: "http://test", fetch: fetchMock });
});

afterEach(() => {
  client.setConfig({ baseUrl: undefined, fetch: undefined });
});

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
      new Response(
        JSON.stringify({
          id: PROJECT_ID,
          name: "Protein folding",
          created_at: "2026-11-02T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const wrapper = mountWith(ProjectPage);
    await flushPromises();

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe(`/api/projects/${PROJECT_ID}`);
    expect(wrapper.find("h1").text()).toBe("Protein folding");
  });

  it("shows a message when the project can't be found", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
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
  ["Data", ProjectDataView, "New Data"],
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
