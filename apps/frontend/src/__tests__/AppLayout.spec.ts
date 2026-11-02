import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import type { UserPublic } from "../client";
import AppLayout from "../layouts/AppLayout.vue";
import { meQueryOptions } from "../lib/auth";

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
            path: "projects/:projectId/survey",
            name: "project-survey",
            component: { template: "<p>Survey page</p>" },
          },
          {
            path: "projects/:projectId",
            name: "project",
            component: { template: "<p>Overview page</p>" },
          },
          {
            path: "projects/:projectId/data",
            name: "project-data",
            component: { template: "<p>Data page</p>" },
          },
          {
            path: "projects/:projectId/results",
            name: "project-results",
            component: { template: "<p>Results page</p>" },
          },
        ],
      },
      { path: "/login", name: "login", component: { template: "<div />" } },
    ],
  });
  await router.push(path);
  const queryClient = new QueryClient();
  const user: UserPublic = { id: 1, email: "user@email.com" };
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
  it("shows a back link and Overview, Data, Survey and Results tabs on a project page", async () => {
    const { wrapper } = await mountAt("/projects/7/data");
    expect(wrapper.findAll("aside a").map((link) => link.text())).toEqual([
      "Dashboard",
      "Overview",
      "Data",
      "Survey",
      "Results",
    ]);
    expect(sidebarLink(wrapper, "Dashboard")?.attributes("href")).toBe("/");
    expect(sidebarLink(wrapper, "Overview")?.attributes("href")).toBe("/projects/7");
    expect(sidebarLink(wrapper, "Survey")?.attributes("href")).toBe("/projects/7/survey");
    expect(sidebarLink(wrapper, "Data")?.attributes("href")).toBe("/projects/7/data");
    expect(sidebarLink(wrapper, "Results")?.attributes("href")).toBe("/projects/7/results");
  });

  it("shows an icon before each tab label", async () => {
    const { wrapper } = await mountAt("/projects/7/data");
    for (const label of ["Overview", "Data", "Survey", "Results"]) {
      const link = sidebarLink(wrapper, label)!;
      expect(link.find("svg[data-icon=inline-start]").exists()).toBe(true);
    }
  });

  it("opens on Overview and switches between the tabs", async () => {
    const { wrapper, router } = await mountAt("/projects/7");
    expect(activeTab(wrapper).text()).toBe("Overview");
    expect(wrapper.text()).toContain("Overview page");

    await sidebarLink(wrapper, "Data")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("project-data");
    expect(activeTab(wrapper).text()).toBe("Data");
    expect(wrapper.text()).toContain("Data page");

    await sidebarLink(wrapper, "Survey")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("project-survey");
    expect(activeTab(wrapper).text()).toBe("Survey");
    expect(wrapper.text()).toContain("Survey page");

    await sidebarLink(wrapper, "Results")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("project-results");
    expect(activeTab(wrapper).text()).toBe("Results");
    expect(wrapper.text()).toContain("Results page");
  });

  it("highlights only the active tab", async () => {
    const { wrapper } = await mountAt("/projects/7/data");
    const survey = sidebarLink(wrapper, "Survey")!;
    const data = sidebarLink(wrapper, "Data")!;
    expect(data.attributes("aria-current")).toBe("page");
    expect(survey.attributes("aria-current")).toBeUndefined();
    expect(data.classes()).toContain("aria-[current=page]:bg-background");
  });

  it("shows the signed-in user's email above Log out", async () => {
    const { wrapper } = await mountAt("/");
    const email = wrapper.find("aside p");
    expect(email.text()).toBe("user@email.com");
    expect(email.element.nextElementSibling?.textContent?.trim()).toBe("Log out");
  });

  it("goes back to the Dashboard and hides the project navigation there", async () => {
    const { wrapper, router } = await mountAt("/projects/7/data");
    await sidebarLink(wrapper, "Dashboard")!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("home");
    expect(wrapper.text()).toContain("Dashboard page");
    expect(wrapper.find("aside nav").exists()).toBe(false);
    expect(wrapper.find("aside").text()).toBe("user@email.com Log out");
  });
});
