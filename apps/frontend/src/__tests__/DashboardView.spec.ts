import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import DashboardView from "../views/DashboardView.vue";
import {
  PROJECT,
  button,
  dialog,
  jsonResponse,
  mountPage,
  request,
  respondTo,
  submitName,
  testQueryClient,
} from "./helpers";

function projectsQueryClient() {
  const queryClient = testQueryClient();
  queryClient.setQueryData(projectsGetProjectsQueryKey(), [PROJECT]);
  return queryClient;
}

async function openCreate() {
  const mounted = await mountPage(DashboardView, { queryClient: projectsQueryClient() });
  button(document.body, "Empty Project").click();
  await flushPromises();
  return mounted;
}

describe("DashboardView", () => {
  it("opens a New project dialog from the Empty Project button", async () => {
    await openCreate();

    expect(dialog()?.textContent).toContain("New project");
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "untitled-project",
    );
  });

  it("creates the project with the trimmed name and closes", async () => {
    respondTo({ POST: jsonResponse({ ...PROJECT, id: "aqvYhKDpgTZejwUy7z36j" }, 201) }, [PROJECT]);
    await openCreate();
    await submitName("  Protein folding  ");

    expect(new URL(request("POST").url).pathname).toBe("/api/projects");
    expect(await request("POST").json()).toEqual({ name: "Protein folding" });
    expect(dialog()).toBeNull();
  });
});
