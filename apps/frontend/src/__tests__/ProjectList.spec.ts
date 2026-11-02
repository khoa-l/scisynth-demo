import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectList from "../components/ProjectList.vue";
import {
  alertDialog,
  button,
  dialog,
  fetchMock,
  jsonResponse,
  mountPage,
  request,
  respondTo,
  submitName,
  testQueryClient,
} from "./helpers";

const FIRST = {
  id: "9-xnwAUoZnySLWKmw7NV3",
  name: "First project",
  created_at: "2026-11-02T00:00:00Z",
};
const SECOND = {
  id: "aqvYhKDpgTZejwUy7z36j",
  name: "Second project",
  created_at: "2026-11-02T00:00:01Z",
};

async function mountList() {
  const queryClient = testQueryClient();
  queryClient.setQueryData(projectsGetProjectsQueryKey(), [SECOND, FIRST]);
  return mountPage(ProjectList, { queryClient });
}

function cachedProjects(queryClient: Awaited<ReturnType<typeof mountList>>["queryClient"]) {
  return queryClient.getQueryData(projectsGetProjectsQueryKey());
}

describe("ProjectList", () => {
  it("shows projects as a grid of named squares by default", async () => {
    const { wrapper } = await mountList();

    const items = wrapper.findAll("li");
    expect(items.map((item) => item.find("p").text())).toEqual(["Second project", "First project"]);
    for (const item of items) {
      expect(item.find('.aspect-square [aria-hidden="true"]').text()).toBe(item.find("p").text());
    }
  });

  it("switches to a list and keeps a view selected when it is clicked again", async () => {
    const { wrapper } = await mountList();

    await wrapper.find('[aria-label="Grid view"]').trigger("click");
    expect(wrapper.find('[aria-label="Grid view"]').attributes("data-state")).toBe("on");
    await wrapper.find('[aria-label="List view"]').trigger("click");
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.find(".aspect-square").exists()).toBe(false);
  });

  it("shows rename and delete actions on hover in both views", async () => {
    const { wrapper } = await mountList();

    for (const view of ["Grid view", "List view"]) {
      await wrapper.find(`[aria-label="${view}"]`).trigger("click");
      for (const item of wrapper.findAll("li")) {
        const actions = item.find('[aria-label="Project actions"]');
        expect(actions.classes()).toEqual(
          expect.arrayContaining(["opacity-0", "group-hover:opacity-100"]),
        );
        expect(actions.find('[aria-label="Rename project"]').exists()).toBe(true);
        expect(actions.find('[aria-label="Delete project"]').exists()).toBe(true);
      }
    }
  });

  it("opens a project when it is clicked in either view", async () => {
    for (const view of ["Grid view", "List view"]) {
      const { wrapper, router } = await mountList();
      await wrapper.find(`[aria-label="${view}"]`).trigger("click");

      const link = wrapper.findAll("li")[1]!.find("a");
      expect(link.attributes("href")).toBe(`/project/${FIRST.id}`);
      await link.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe(`/project/${FIRST.id}`);
      wrapper.unmount();
    }
  });

  it("does not open the project when an action button is clicked", async () => {
    const { wrapper, router } = await mountList();

    const remove = wrapper.findAll("li")[0]!.find('[aria-label="Delete project"]');
    await remove.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/");
    expect(remove.element.closest("a")).toBeNull();
  });
});

describe("renaming a project", () => {
  async function openRename() {
    const mounted = await mountList();
    await mounted.wrapper.findAll("li")[1]!.find('[aria-label="Rename project"]').trigger("click");
    await flushPromises();
    return mounted;
  }

  it("opens the name dialog with the current name", async () => {
    await openRename();

    expect(dialog()?.textContent).toContain("Rename project");
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "First project",
    );
  });

  it("sends the new name and updates the list", async () => {
    const renamed = { ...FIRST, name: "Protein folding" };
    respondTo({ PATCH: jsonResponse(renamed) }, [SECOND, renamed]);
    const { queryClient } = await openRename();
    await submitName("Protein folding");

    expect(new URL(request("PATCH").url).pathname).toBe(`/api/projects/${FIRST.id}`);
    expect(await request("PATCH").json()).toEqual({ name: "Protein folding" });
    expect(cachedProjects(queryClient)).toEqual([SECOND, renamed]);
    expect(dialog()).toBeNull();
  });

  it("closes without a request when the name is unchanged", async () => {
    await openRename();
    await submitName("First project");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });
});

describe("deleting a project", () => {
  async function openDelete() {
    const mounted = await mountList();
    await mounted.wrapper.findAll("li")[0]!.find('[aria-label="Delete project"]').trigger("click");
    await flushPromises();
    return mounted;
  }

  it("asks for confirmation naming the project", async () => {
    await openDelete();

    expect(alertDialog()?.textContent).toContain("Delete project?");
    expect(alertDialog()?.textContent).toContain("“Second project” will be permanently deleted");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the project, removes it from the list and closes", async () => {
    respondTo({ DELETE: new Response(null, { status: 204 }) }, [FIRST]);
    const { queryClient } = await openDelete();
    button(alertDialog(), "Delete").click();
    await flushPromises();

    expect(new URL(request("DELETE").url).pathname).toBe(`/api/projects/${SECOND.id}`);
    expect(cachedProjects(queryClient)).toEqual([FIRST]);
    expect(alertDialog()).toBeNull();
  });

  it("keeps the dialog open and shows the error when deleting fails", async () => {
    respondTo({ DELETE: jsonResponse({ detail: "Project not found" }, 404) }, [SECOND, FIRST]);
    const { queryClient } = await openDelete();
    button(alertDialog(), "Delete").click();
    await flushPromises();

    expect(alertDialog()?.querySelector('[role="alert"]')?.textContent).toBe("Project not found");
    expect(cachedProjects(queryClient)).toEqual([SECOND, FIRST]);
  });
});
