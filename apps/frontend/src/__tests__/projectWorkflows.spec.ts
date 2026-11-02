import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectList from "../components/ProjectList.vue";
import DashboardView from "../views/DashboardView.vue";
import { dialog, fetchMock, jsonResponse, mockApi, requests, submitName } from "./helpers";

const project = {
  id: "V11k9b8XeABv2ISddF304",
  name: "Untitled project",
  created_at: "2026-11-02T00:00:00Z",
};

mockApi();

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(projectsGetProjectsQueryKey(), [project]);
  return queryClient;
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/project/:projectId", name: "project", component: { template: "<div />" } },
    ],
  });
}

describe("renaming a project", () => {
  async function openRename() {
    const queryClient = createQueryClient();
    const wrapper = mount(ProjectList, {
      attachTo: document.body,
      global: { plugins: [testRouter(), [VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    await wrapper.find('[aria-label="Rename project"]').trigger("click");
    await flushPromises();
    return { wrapper, queryClient };
  }

  it("opens the name dialog from the pencil button", async () => {
    const { wrapper } = await openRename();
    expect(dialog()?.textContent).toContain("Rename project");
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "Untitled project",
    );
    wrapper.unmount();
  });

  it("sends the new name and updates the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...project, name: "Protein folding" }));
    const { wrapper, queryClient } = await openRename();
    await submitName("Protein folding");

    const patch = requests().find((request) => request.method === "PATCH")!;
    expect(new URL(patch.url).pathname).toBe(`/api/projects/${project.id}`);
    expect(await patch.json()).toEqual({ name: "Protein folding" });
    expect(queryClient.getQueryData(projectsGetProjectsQueryKey())).toEqual([
      { ...project, name: "Protein folding" },
    ]);
    expect(dialog()).toBeNull();
    wrapper.unmount();
  });

  it("closes without a request when the name is unchanged", async () => {
    const { wrapper } = await openRename();
    await submitName("Untitled project");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
    wrapper.unmount();
  });
});

describe("creating a project", () => {
  async function openCreate() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: DashboardView },
        { path: "/project/:projectId", name: "project", component: { template: "<div />" } },
        { path: "/login", name: "login", component: { template: "<div />" } },
      ],
    });
    await router.push("/");
    const wrapper = mount(DashboardView, {
      attachTo: document.body,
      global: { plugins: [router, [VueQueryPlugin, { queryClient: createQueryClient() }]] },
    });
    await flushPromises();
    const button = wrapper.findAll("button").find((b) => b.text().includes("Empty Project"))!;
    await button.trigger("click");
    await flushPromises();
    return wrapper;
  }

  it("opens a New project dialog from the Empty Project button", async () => {
    const wrapper = await openCreate();
    expect(dialog()?.textContent).toContain("New project");
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "untitled-project",
    );
    wrapper.unmount();
  });

  it("creates the project with the entered name and closes", async () => {
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      return request.method === "POST"
        ? jsonResponse({ ...project, id: "aqvYhKDpgTZejwUy7z36j", name: "Protein folding" }, 201)
        : jsonResponse([project]);
    });
    const wrapper = await openCreate();
    await submitName("  Protein folding  ");

    const post = requests().find((request) => request.method === "POST")!;
    expect(new URL(post.url).pathname).toBe("/api/projects");
    expect(await post.json()).toEqual({ name: "Protein folding" });
    expect(dialog()).toBeNull();
    wrapper.unmount();
  });
});

describe("deleting a project", () => {
  async function openDelete() {
    const queryClient = createQueryClient();
    const wrapper = mount(ProjectList, {
      attachTo: document.body,
      global: { plugins: [testRouter(), [VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    await wrapper.find('[aria-label="Delete project"]').trigger("click");
    await flushPromises();
    return { wrapper, queryClient };
  }

  function alertDialog() {
    return document.querySelector('[role="alertdialog"]');
  }

  function confirmButton() {
    return [...(alertDialog()?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "Delete",
    )!;
  }

  it("asks for confirmation naming the project", async () => {
    const { wrapper } = await openDelete();
    expect(alertDialog()?.textContent).toContain("Delete project?");
    expect(alertDialog()?.textContent).toContain("“Untitled project” will be permanently deleted");
    expect(fetchMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("deletes the project, removes it from the list and closes", async () => {
    fetchMock.mockImplementation(async (input) =>
      (input as Request).method === "DELETE"
        ? new Response(null, { status: 204 })
        : jsonResponse([]),
    );
    const { wrapper, queryClient } = await openDelete();
    confirmButton().click();
    await flushPromises();

    const request = requests().find((r) => r.method === "DELETE")!;
    expect(new URL(request.url).pathname).toBe(`/api/projects/${project.id}`);
    expect(queryClient.getQueryData(projectsGetProjectsQueryKey())).toEqual([]);
    expect(alertDialog()).toBeNull();
    wrapper.unmount();
  });

  it("keeps the dialog open and shows the error when deleting fails", async () => {
    fetchMock.mockImplementation(async (input) =>
      (input as Request).method === "DELETE"
        ? jsonResponse({ detail: "Project not found" }, 404)
        : jsonResponse([project]),
    );
    const { wrapper, queryClient } = await openDelete();
    confirmButton().click();
    await flushPromises();

    expect(alertDialog()?.querySelector('[role="alert"]')?.textContent).toBe("Project not found");
    expect(queryClient.getQueryData(projectsGetProjectsQueryKey())).toEqual([project]);
    wrapper.unmount();
  });
});
