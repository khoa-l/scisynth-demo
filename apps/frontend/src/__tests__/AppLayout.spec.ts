import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import type { UserPublic } from "../client";
import AppLayout from "../layouts/AppLayout.vue";
import { meQueryOptions } from "../lib/auth";

const PROJECT_ID = "V11k9b8XeABv2ISddF304";

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/",
        component: AppLayout,
        children: [
          { path: "", name: "home", component: { template: "<p>Dashboard page</p>" } },
          {
            path: "project/:projectId/survey",
            name: "project-surveys",
            component: { template: "<p>Surveys page</p>" },
            meta: { projectSection: "surveys" },
          },
          {
            path: "project/:projectId",
            name: "project",
            component: { template: "<p>Overview page</p>" },
            meta: { projectSection: "overview" },
          },
          {
            path: "project/:projectId/dataset",
            name: "project-datasets",
            component: { template: "<p>Datasets page</p>" },
            meta: { projectSection: "datasets" },
          },
          {
            path: "project/:projectId/dataset/:datasetId",
            name: "project-dataset",
            component: { template: "<p>Dataset item page</p>" },
            meta: { projectSection: "datasets" },
          },
        ],
      },
      { path: "/login", name: "login", component: { template: "<div />" } },
    ],
  });
  await router.push(path);
  const queryClient = new QueryClient();
  const user: UserPublic = { id: "Uakgb_J5m9g-0JDMbcJqL", email: "user@email.com" };
  queryClient.setQueryData(meQueryOptions.queryKey, user);
  const wrapper = mount(
    { template: "<RouterView />" },
    {
      global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    },
  );
  await flushPromises();
  return { wrapper, router };
}

function sidebarLink(wrapper: VueWrapper, label: string) {
  return wrapper.findAll("aside a").find((link) => link.text() === label);
}

function activeTab(wrapper: VueWrapper) {
  return wrapper.find('[aria-label="Project sections"] [aria-current="page"]');
}

describe("AppLayout", () => {
  it("shows a back link and Overview, Datasets and Surveys tabs on a project page", async () => {
    const { wrapper } = await mountAt(`/project/${PROJECT_ID}/dataset`);
    expect(wrapper.findAll("aside a").map((link) => link.text())).toEqual([
      "Dashboard",
      "Overview",
      "Datasets",
      "Surveys",
    ]);
    expect(sidebarLink(wrapper, "Dashboard")?.attributes("href")).toBe("/");
    expect(sidebarLink(wrapper, "Overview")?.attributes("href")).toBe(`/project/${PROJECT_ID}`);
    expect(sidebarLink(wrapper, "Surveys")?.attributes("href")).toBe(
      `/project/${PROJECT_ID}/survey`,
    );
    expect(sidebarLink(wrapper, "Datasets")?.attributes("href")).toBe(
      `/project/${PROJECT_ID}/dataset`,
    );
  });

  it("shows an icon before each tab label", async () => {
    const { wrapper } = await mountAt(`/project/${PROJECT_ID}/dataset`);
    for (const label of ["Overview", "Datasets", "Surveys"]) {
      const link = sidebarLink(wrapper, label)!;
      expect(link.find("svg[data-icon=inline-start]").exists()).toBe(true);
    }
  });

  it("opens on Overview and switches between the tabs", async () => {
    const { wrapper, router } = await mountAt(`/project/${PROJECT_ID}`);
    expect(activeTab(wrapper).text()).toBe("Overview");
    expect(wrapper.text()).toContain("Overview page");

    await sidebarLink(wrapper, "Datasets")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("project-datasets");
    expect(activeTab(wrapper).text()).toBe("Datasets");
    expect(wrapper.text()).toContain("Datasets page");

    await sidebarLink(wrapper, "Surveys")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("project-surveys");
    expect(activeTab(wrapper).text()).toBe("Surveys");
    expect(wrapper.text()).toContain("Surveys page");
  });

  it("highlights only the active tab", async () => {
    const { wrapper } = await mountAt(`/project/${PROJECT_ID}/dataset`);
    const survey = sidebarLink(wrapper, "Surveys")!;
    const data = sidebarLink(wrapper, "Datasets")!;
    expect(data.attributes("aria-current")).toBe("page");
    expect(survey.attributes("aria-current")).toBeUndefined();
    expect(data.classes()).toContain("bg-background");
    expect(survey.classes()).not.toContain("bg-background");
  });

  it("keeps the Datasets tab highlighted while a dataset is open", async () => {
    const { wrapper } = await mountAt(`/project/${PROJECT_ID}/dataset/Eq-OvCTLPC6Urz_TXE8eJ`);
    expect(wrapper.text()).toContain("Dataset item page");
    const highlighted = wrapper
      .findAll('[aria-label="Project sections"] a')
      .filter((link) => link.classes().includes("bg-background"))
      .map((link) => link.text());
    expect(highlighted).toEqual(["Datasets"]);
  });

  it("shows the signed-in user's email above Log out", async () => {
    const { wrapper } = await mountAt("/");
    const email = wrapper.find("aside p");
    expect(email.text()).toBe("user@email.com");
    expect(email.element.nextElementSibling?.textContent?.trim()).toBe("Log out");
  });

  it("goes back to the Dashboard and hides the project navigation there", async () => {
    const { wrapper, router } = await mountAt(`/project/${PROJECT_ID}/dataset`);
    await sidebarLink(wrapper, "Dashboard")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("home");
    expect(wrapper.text()).toContain("Dashboard page");
    expect(wrapper.find("aside nav").exists()).toBe(false);
    expect(wrapper.find("aside").text()).toBe("user@email.com Log out");
  });
});
