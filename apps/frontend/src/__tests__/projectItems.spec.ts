import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import {
  datasetsGetDatasetsQueryKey,
  projectsGetProjectQueryKey,
  surveysGetSurveysQueryKey,
} from "../client/@tanstack/vue-query.gen";
import ProjectDatasetsView from "../views/ProjectDatasetsView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import { dialog, fetchMock, jsonResponse, mockApi, requests, submitName } from "./helpers";

const PROJECT_ID = "V11k9b8XeABv2ISddF304";

mockApi();

const SECOND_ID = "pZtIo1NJJ5C48xzJcDG3F";
const FIRST_ID = "Eq-OvCTLPC6Urz_TXE8eJ";

const items = [
  { id: SECOND_ID, name: "Second", created_at: "2026-11-02T00:00:01Z" },
  { id: FIRST_ID, name: "First", created_at: "2026-11-02T00:00:00Z" },
];

describe.each([
  {
    name: "Datasets",
    view: ProjectDatasetsView,
    queryKey: () => datasetsGetDatasetsQueryKey({ path: { project_id: PROJECT_ID } }),
    url: `/api/projects/${PROJECT_ID}/datasets`,
    noun: "dataset",
    itemPath: `/project/${PROJECT_ID}/datasets`,
    newLabel: "New Dataset",
    initialName: "untitled-dataset",
  },
  {
    name: "Survey",
    view: ProjectSurveyView,
    queryKey: () => surveysGetSurveysQueryKey({ path: { project_id: PROJECT_ID } }),
    url: `/api/projects/${PROJECT_ID}/surveys`,
    noun: "survey",
    itemPath: `/project/${PROJECT_ID}/survey`,
    newLabel: "New Survey",
    initialName: "untitled-survey",
  },
])("$name list", ({ view, queryKey, url, noun, itemPath, newLabel, initialName }) => {
  async function mountView() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(projectsGetProjectQueryKey({ path: { project_id: PROJECT_ID } }), {
      id: PROJECT_ID,
      name: "Protein folding",
      created_at: "2026-11-02T00:00:00Z",
    });
    queryClient.setQueryData(queryKey(), items);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: { template: "<div />" } },
        {
          path: "/project/:projectId/datasets/:datasetId",
          name: "project-dataset",
          component: { template: "<div />" },
        },
        {
          path: "/project/:projectId/survey/:surveyId",
          name: "project-survey-item",
          component: { template: "<div />" },
        },
      ],
    });
    await router.push("/");
    const wrapper = mount(view, {
      props: { projectId: PROJECT_ID },
      attachTo: document.body,
      global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    return { wrapper, queryClient, router };
  }

  it("shows the items as a grid of squares that link to each item", async () => {
    const { wrapper } = await mountView();
    const rows = wrapper.findAll("li");
    expect(rows.map((row) => row.find("p").text())).toEqual(["Second", "First"]);
    expect(rows.every((row) => row.find(".aspect-square").exists())).toBe(true);
    expect(rows.map((row) => row.find("a").attributes("href"))).toEqual([
      `${itemPath}/${SECOND_ID}`,
      `${itemPath}/${FIRST_ID}`,
    ]);
    wrapper.unmount();
  });

  it("opens an item when it is clicked in either view", async () => {
    for (const viewLabel of ["Grid view", "List view"]) {
      const { wrapper, router } = await mountView();
      await wrapper.find(`[aria-label="${viewLabel}"]`).trigger("click");
      await wrapper.findAll("li")[1]!.find("a").trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe(`${itemPath}/${FIRST_ID}`);
      wrapper.unmount();
    }
  });

  it("switches to a list", async () => {
    const { wrapper } = await mountView();
    await wrapper.find('[aria-label="List view"]').trigger("click");
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.find(".aspect-square").exists()).toBe(false);
    wrapper.unmount();
  });

  it(`creates an item from the ${newLabel} button`, async () => {
    fetchMock.mockImplementation(async (input) =>
      (input as Request).method === "POST"
        ? jsonResponse({ ...items[0], id: "fjz26ezxp_dKE9W_vb5hf", name: "Fresh" }, 201)
        : jsonResponse(items),
    );
    const { wrapper } = await mountView();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === newLabel)!
      .trigger("click");
    await flushPromises();
    expect(dialog()?.textContent).toContain(`New ${noun}`);
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(initialName);

    await submitName("  Fresh  ");
    const post = requests().find((request) => request.method === "POST")!;
    expect(new URL(post.url).pathname).toBe(url);
    expect(await post.json()).toEqual({ name: "Fresh" });
    expect(dialog()).toBeNull();
    wrapper.unmount();
  });

  it("renames an item and updates the list", async () => {
    const renamed = { ...items[1], name: "Renamed" };
    fetchMock.mockImplementation(async (input) =>
      (input as Request).method === "PATCH"
        ? jsonResponse(renamed)
        : jsonResponse([items[0], renamed]),
    );
    const { wrapper, queryClient } = await mountView();
    await wrapper.findAll("li")[1]!.find(`[aria-label="Rename ${noun}"]`).trigger("click");
    await flushPromises();
    await submitName("Renamed");

    const patch = requests().find((request) => request.method === "PATCH")!;
    expect(new URL(patch.url).pathname).toBe(`${url}/${FIRST_ID}`);
    expect(await patch.json()).toEqual({ name: "Renamed" });
    expect(queryClient.getQueryData(queryKey())).toEqual([items[0], renamed]);
    expect(dialog()).toBeNull();
    wrapper.unmount();
  });

  it("deletes an item after confirmation and removes it from the list", async () => {
    fetchMock.mockImplementation(async (input) =>
      (input as Request).method === "DELETE"
        ? new Response(null, { status: 204 })
        : jsonResponse([items[1]]),
    );
    const { wrapper, queryClient } = await mountView();
    await wrapper.findAll("li")[0]!.find(`[aria-label="Delete ${noun}"]`).trigger("click");
    await flushPromises();
    const alert = document.querySelector('[role="alertdialog"]')!;
    expect(alert.textContent).toContain(`Delete ${noun}?`);
    [...alert.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Delete")!
      .click();
    await flushPromises();

    const request = requests().find((r) => r.method === "DELETE")!;
    expect(new URL(request.url).pathname).toBe(`${url}/${SECOND_ID}`);
    expect(queryClient.getQueryData(queryKey())).toEqual([items[1]]);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    wrapper.unmount();
  });
});
