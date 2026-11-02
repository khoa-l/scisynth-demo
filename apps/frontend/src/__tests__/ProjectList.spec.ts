import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import App from "../App.vue";
import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectList from "../components/ProjectList.vue";

const FIRST_ID = "9-xnwAUoZnySLWKmw7NV3";
const SECOND_ID = "aqvYhKDpgTZejwUy7z36j";

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(projectsGetProjectsQueryKey(), [
    { id: SECOND_ID, name: "Second project", created_at: "2026-11-02T00:00:01Z" },
    { id: FIRST_ID, name: "First project", created_at: "2026-11-02T00:00:00Z" },
  ]);
  return queryClient;
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: ProjectList },
      { path: "/project/:projectId", name: "project", component: { template: "<div />" } },
    ],
  });
}

function mountProjectList(router = createTestRouter()) {
  return mount(ProjectList, {
    attachTo: document.body,
    global: { plugins: [router, [VueQueryPlugin, { queryClient: createQueryClient() }]] },
  });
}

describe("ProjectList", () => {
  it("shows projects as a grid of squares by default", async () => {
    const wrapper = mountProjectList();
    await flushPromises();
    const items = wrapper.findAll("li");
    expect(items.map((item) => item.find("p").text())).toEqual(["Second project", "First project"]);
    for (const item of items) {
      const square = item.find(".aspect-square");
      expect(square.exists()).toBe(true);
      expect(square.find('[aria-hidden="true"]').text()).toBe(item.find("p").text());
    }
  });

  it("switches to a list", async () => {
    const wrapper = mountProjectList();
    await flushPromises();
    await wrapper.find('[aria-label="List view"]').trigger("click");
    const items = wrapper.findAll("li");
    expect(items).toHaveLength(2);
    expect(wrapper.find(".aspect-square").exists()).toBe(false);
  });

  it("keeps a view selected when the active option is clicked again", async () => {
    const wrapper = mountProjectList();
    await flushPromises();
    await wrapper.find('[aria-label="Grid view"]').trigger("click");
    expect(wrapper.find('[aria-label="Grid view"]').attributes("data-state")).toBe("on");
    expect(wrapper.findAll("li")).toHaveLength(2);
  });

  it("shows rename and delete actions on hover in both views", async () => {
    const wrapper = mountProjectList();
    await flushPromises();

    for (const view of ["Grid view", "List view"]) {
      await wrapper.find(`[aria-label="${view}"]`).trigger("click");
      const items = wrapper.findAll("li");
      for (const item of items) {
        const actions = item.find('[aria-label="Project actions"]');
        expect(actions.classes()).toContain("opacity-0");
        expect(actions.classes()).toContain("group-hover:opacity-100");
        expect(actions.find('[aria-label="Rename project"]').exists()).toBe(true);
        expect(actions.find('[aria-label="Delete project"]').exists()).toBe(true);
      }
    }
  });

  it("opens a project when it is clicked in either view", async () => {
    for (const view of ["Grid view", "List view"]) {
      const router = createTestRouter();
      await router.push("/");
      const wrapper = mountProjectList(router);
      await flushPromises();
      await wrapper.find(`[aria-label="${view}"]`).trigger("click");

      const link = wrapper.findAll("li")[1]!.find("a");
      expect(link.attributes("href")).toBe(`/project/${FIRST_ID}`);
      await link.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe(`/project/${FIRST_ID}`);
      wrapper.unmount();
    }
  });

  it("does not open the project when an action button is clicked", async () => {
    const router = createTestRouter();
    await router.push("/");
    const wrapper = mountProjectList(router);
    await flushPromises();
    await wrapper.findAll("li")[0]!.find('[aria-label="Delete project"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/");
    expect(
      wrapper.findAll("li")[0]!.find('[aria-label="Delete project"]').element.closest("a"),
    ).toBeNull();
    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("renders icons with a thin stroke inside the app", async () => {
    const router = createTestRouter();
    await router.push("/");
    const wrapper = mount(App, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient: createQueryClient() }]] },
    });
    await flushPromises();
    const icons = wrapper.findAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.every((icon) => icon.attributes("stroke-width") === "1.5")).toBe(true);
  });
});
