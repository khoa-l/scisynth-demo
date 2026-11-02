import { afterEach, beforeEach, describe, it, expect, vi } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";

import { client } from "../client/client.gen";
import {
  datasetsGetDatasetsQueryKey,
  projectsGetProjectQueryKey,
  surveysGetSurveysQueryKey,
} from "../client/@tanstack/vue-query.gen";
import ProjectDataView from "../views/ProjectDataView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";

const PROJECT_ID = "3f2b8c1e-5d4a-4e6f-9b7c-0a1d2e3f4a5b";

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

const items = [
  { id: 4, name: "Second", created_at: "2026-11-02T00:00:01Z" },
  { id: 3, name: "First", created_at: "2026-11-02T00:00:00Z" },
];

function requests() {
  return fetchMock.mock.calls.map((call) => call[0] as Request);
}

async function submitName(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]')!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  document.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  await flushPromises();
}

describe.each([
  {
    name: "Data",
    view: ProjectDataView,
    queryKey: () => datasetsGetDatasetsQueryKey({ path: { project_id: PROJECT_ID } }),
    url: `/api/projects/${PROJECT_ID}/datasets`,
    noun: "data",
    newLabel: "New Data",
    initialName: "untitled-data",
  },
  {
    name: "Survey",
    view: ProjectSurveyView,
    queryKey: () => surveysGetSurveysQueryKey({ path: { project_id: PROJECT_ID } }),
    url: `/api/projects/${PROJECT_ID}/surveys`,
    noun: "survey",
    newLabel: "New Survey",
    initialName: "untitled-survey",
  },
])("$name list", ({ view, queryKey, url, noun, newLabel, initialName }) => {
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
    const wrapper = mount(view, {
      props: { projectId: PROJECT_ID },
      attachTo: document.body,
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    return { wrapper, queryClient };
  }

  it("shows the items as a grid of squares that don't open anything", async () => {
    const { wrapper } = await mountView();
    const rows = wrapper.findAll("li");
    expect(rows.map((row) => row.find("p").text())).toEqual(["Second", "First"]);
    expect(rows.every((row) => row.find(".aspect-square").exists())).toBe(true);
    expect(wrapper.find("li a").exists()).toBe(false);
    wrapper.unmount();
  });

  it("switches to a list", async () => {
    const { wrapper } = await mountView();
    await wrapper.find('[aria-label="List view"]').trigger("click");
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.find(".aspect-square").exists()).toBe(false);
    expect(wrapper.find("li a").exists()).toBe(false);
    wrapper.unmount();
  });

  it(`creates an item from the ${newLabel} button`, async () => {
    fetchMock.mockImplementation(async (input) =>
      (input as Request).method === "POST"
        ? jsonResponse({ ...items[0], id: 5, name: "Fresh" }, 201)
        : jsonResponse(items),
    );
    const { wrapper } = await mountView();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === newLabel)!
      .trigger("click");
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(`New ${noun}`);
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(initialName);

    await submitName("  Fresh  ");
    const post = requests().find((request) => request.method === "POST")!;
    expect(new URL(post.url).pathname).toBe(url);
    expect(await post.json()).toEqual({ name: "Fresh" });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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
    expect(new URL(patch.url).pathname).toBe(`${url}/3`);
    expect(await patch.json()).toEqual({ name: "Renamed" });
    expect(queryClient.getQueryData(queryKey())).toEqual([items[0], renamed]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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
    expect(new URL(request.url).pathname).toBe(`${url}/4`);
    expect(queryClient.getQueryData(queryKey())).toEqual([items[1]]);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    wrapper.unmount();
  });
});
