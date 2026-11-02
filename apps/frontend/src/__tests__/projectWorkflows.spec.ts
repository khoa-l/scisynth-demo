import { afterEach, beforeEach, describe, it, expect, vi } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import { client } from "../client/client.gen";
import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectList from "../components/ProjectList.vue";
import DashboardView from "../views/DashboardView.vue";

const project = {
  id: "3f2b8c1e-5d4a-4e6f-9b7c-0a1d2e3f4a5b",
  name: "Untitled project",
  created_at: "2026-11-02T00:00:00Z",
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  client.setConfig({ baseUrl: "http://test", fetch: fetchMock });
});

afterEach(() => {
  client.setConfig({ baseUrl: undefined, fetch: undefined });
  document.body.innerHTML = "";
});

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

function requests() {
  return fetchMock.mock.calls.map((call) => call[0] as Request);
}

function dialog() {
  return document.querySelector('[role="dialog"]');
}

async function submitName(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]')!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  document.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  await flushPromises();
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
        ? jsonResponse(
            { ...project, id: "a1b2c3d4-2222-4aaa-8bbb-000000000002", name: "Protein folding" },
            201,
          )
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
