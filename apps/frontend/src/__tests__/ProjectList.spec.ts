import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import App from "../App.vue";
import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectList from "../components/ProjectList.vue";

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(projectsGetProjectsQueryKey(), [
    { id: 2, name: "Second project", created_at: "2026-11-02T00:00:01Z" },
    { id: 1, name: "First project", created_at: "2026-11-02T00:00:00Z" },
  ]);
  return queryClient;
}

function mountProjectList() {
  return mount(ProjectList, {
    global: { plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]] },
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

  it("renders icons with a thin stroke inside the app", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: ProjectList }],
    });
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
