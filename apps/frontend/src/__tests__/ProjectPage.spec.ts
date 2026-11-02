import { afterEach, beforeEach, describe, it, expect, vi } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import type { Component } from "vue";

import { projectsGetProjectQueryKey } from "../client/@tanstack/vue-query.gen";
import ProjectPage from "../components/ProjectPage.vue";
import ProjectDatasetView from "../views/ProjectDatasetView.vue";
import ProjectDatasetsView from "../views/ProjectDatasetsView.vue";
import ProjectOverviewView from "../views/ProjectOverviewView.vue";
import ProjectSurveyItemView from "../views/ProjectSurveyItemView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import { fetchMock, jsonResponse, mockApi } from "./helpers";

const PROJECT_ID = "V11k9b8XeABv2ISddF304";

mockApi();

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function loadedQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(projectsGetProjectQueryKey({ path: { project_id: PROJECT_ID } }), {
    id: PROJECT_ID,
    name: "Protein folding",
    created_at: "2026-11-02T00:00:00Z",
  });
  return queryClient;
}

function mountWith(component: Component, queryClient = new QueryClient()) {
  return mount(component, {
    props: { projectId: PROJECT_ID },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
}

describe("ProjectPage", () => {
  it("loads the project from the API and shows its name as the heading", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: PROJECT_ID,
        name: "Protein folding",
        created_at: "2026-11-02T00:00:00Z",
      }),
    );
    const wrapper = mountWith(ProjectPage);
    await flushPromises();

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe(`/api/projects/${PROJECT_ID}`);
    expect(wrapper.find("h1").text()).toBe("Protein folding");
  });

  it("shows a message when the project can't be found", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Project not found" }, 404));
    const wrapper = mountWith(
      ProjectPage,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );
    await flushPromises();

    expect(wrapper.text()).toContain("This project couldn't be found.");
    expect(wrapper.find("h1").exists()).toBe(false);
  });
});

describe("Overview view", () => {
  it("shows the project name with no action buttons", async () => {
    const wrapper = mountWith(ProjectOverviewView, loadedQueryClient());
    await flushPromises();

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});

describe.each([
  ["Datasets", ProjectDatasetsView, "New Dataset"],
  ["Survey", ProjectSurveyView, "New Survey"],
])("%s view", (_name, view, label) => {
  it(`shows the project name and a ${label} button like the Dashboard`, async () => {
    const wrapper = mountWith(view, loadedQueryClient());
    await flushPromises();

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    const button = wrapper.findAll("button").find((b) => b.text() === label)!;
    expect(button.find("svg[data-icon=inline-start]").exists()).toBe(true);
    expect(button.classes()).toEqual(expect.arrayContaining(["h-10", "px-4"]));
  });
});

const DATASET = {
  id: "Eq-OvCTLPC6Urz_TXE8eJ",
  name: "Raw reads",
  created_at: "2026-11-02T00:00:00Z",
};
const SURVEY = {
  id: "pZtIo1NJJ5C48xzJcDG3F",
  name: "Intake form",
  created_at: "2026-11-02T00:00:00Z",
};

async function mountItemView(component: Component, props: Record<string, string | undefined>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      {
        path: "/project/:projectId/datasets",
        name: "project-datasets",
        component: { template: "<div />" },
      },
      {
        path: "/project/:projectId/survey",
        name: "project-survey",
        component: { template: "<div />" },
      },
    ],
  });
  await router.push("/");
  const queryClient = loadedQueryClient();
  queryClient.setDefaultOptions({ queries: { staleTime: Infinity, retry: false } });
  const wrapper = mount(component, {
    props: { projectId: PROJECT_ID, ...props },
    attachTo: document.body,
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
  });
  await flushPromises();
  return wrapper;
}

describe.each([
  {
    name: "Dataset",
    view: ProjectDatasetView,
    props: { datasetId: DATASET.id },
    item: DATASET,
    url: `/api/projects/${PROJECT_ID}/datasets/${DATASET.id}`,
    noun: "dataset",
    backLabel: "Datasets",
    backPath: `/project/${PROJECT_ID}/datasets`,
  },
  {
    name: "Survey",
    view: ProjectSurveyItemView,
    props: { surveyId: SURVEY.id },
    item: SURVEY,
    url: `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`,
    noun: "survey",
    backLabel: "Surveys",
    backPath: `/project/${PROJECT_ID}/survey`,
  },
])("$name item view", ({ view, props, item, url, noun, backLabel, backPath }) => {
  it("loads the item and shows its name after the project name", async () => {
    fetchMock.mockResolvedValue(jsonResponse(item));
    const wrapper = await mountItemView(view, props);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe(url);
    expect(wrapper.find("h1").text()).toBe(`Protein folding / ${item.name}`);
    expect(wrapper.find("h1 span").classes()).toContain("text-muted-foreground");
  });

  it("shows a back button to the list and two canvases side by side", async () => {
    fetchMock.mockResolvedValue(jsonResponse(item));
    const wrapper = await mountItemView(view, props);

    const back = wrapper.find("a");
    expect(back.text()).toBe(`Back to ${backLabel}`);
    expect(back.attributes("href")).toBe(backPath);
    expect(back.find("svg[data-icon=inline-start]").exists()).toBe(true);
    const canvases = wrapper.findAll("section");
    expect(canvases.map((canvas) => canvas.attributes("aria-label"))).toEqual([
      "Left canvas",
      "Right canvas",
    ]);
    expect(wrapper.find(".grid-cols-2").findAll("section")).toHaveLength(2);
  });

  it("says when the item can't be found", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Not found" }, 404));
    const wrapper = await mountItemView(view, props);

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.text()).toContain(`This ${noun} couldn't be found.`);
    expect(wrapper.find("section").exists()).toBe(false);
    expect(wrapper.find("a").text()).toBe(`Back to ${backLabel}`);
  });
});

describe("Dataset view", () => {
  it("shows a Vue Flow node graph in the left panel and leaves the right panel empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse(DATASET));
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });

    const [left, right] = wrapper.findAll("section");
    expect(left!.find('.vue-flow[aria-label="Node graph"]').exists()).toBe(true);
    expect(left!.find(".vue-flow").classes()).toEqual(
      expect.arrayContaining(["bg-muted", "inset-shadow-sm"]),
    );
    const gridLine = left!.find(".vue-flow__background pattern path");
    expect(gridLine.exists()).toBe(true);
    expect(gridLine.attributes("stroke")).toBe("#dcdcdc");
    expect(left!.find(".vue-flow__background pattern circle").exists()).toBe(false);
    const graphArea = left!.find(".vue-flow").element.parentElement!;
    const details = left!.find('[role="group"][aria-label="Node details"]');
    expect(graphArea.classList).toContain("flex-3");
    expect(details.classes()).toContain("flex-1");
    expect(graphArea.nextElementSibling).toBe(details.element);
    expect(details.find('[role="tablist"]').exists()).toBe(true);
    expect(right!.element.childElementCount).toBe(0);
  });
});

describe("Dataset component tabs", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse(DATASET));
  });

  function details(wrapper: Awaited<ReturnType<typeof mountItemView>>) {
    return wrapper.find('[role="group"][aria-label="Node details"]');
  }

  function visiblePanel(wrapper: Awaited<ReturnType<typeof mountItemView>>) {
    return details(wrapper)
      .findAll('[role="tabpanel"]')
      .find((panel) => panel.attributes("data-state") === "active")!;
  }

  it("has a folder tab for each component category, with Latent open first", async () => {
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });

    const tablist = details(wrapper).find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Component categories");
    expect(tablist.classes()).toEqual(
      expect.arrayContaining(["absolute", "bottom-full", "left-0", "pointer-events-none"]),
    );
    expect(tablist.classes().some((c) => /^(gap|px|pl)-/.test(c))).toBe(false);
    expect(tablist.classes().some((c) => c.startsWith("bg-") || c.startsWith("border"))).toBe(
      false,
    );
    const tabs = tablist.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["Latent", "Sampler", "Stages", "Projection"]);
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);
    for (const tab of tabs) {
      expect(tab.classes()).toEqual(
        expect.arrayContaining([
          "pointer-events-auto",
          "-ml-px",
          "first:ml-0",
          "first:border-l-0",
          "data-[state=active]:z-10",
          "data-[state=active]:shadow-sm",
          "data-[state=active]:[clip-path:inset(-8px_-8px_0_-8px)]",
          "rounded-t-lg",
          "border",
          "-mb-px",
          "bg-muted",
          "data-[state=active]:bg-background",
          "data-[state=active]:border-b-background",
        ]),
      );
    }
    expect(visiblePanel(wrapper).text()).toContain("Gaussian field");
    expect(visiblePanel(wrapper).classes()).toEqual(
      expect.arrayContaining(["border-t", "bg-background"]),
    );
    wrapper.unmount();
  });

  it("switches category when another tab is chosen", async () => {
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });

    const stages = details(wrapper)
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "Stages")!;
    await stages.trigger("mousedown", { button: 0 });
    await flushPromises();

    expect(stages.attributes("aria-selected")).toBe("true");
    const panel = visiblePanel(wrapper);
    expect(panel.find("h3").exists()).toBe(false);
    expect(panel.text()).not.toContain("Defects");
    expect(panel.text()).not.toContain("Transforms");
    const items = panel.findAll("li");
    expect(items).toHaveLength(13);
    expect(items[0]!.text()).toBe("Gaussian noise");
    expect(items[12]!.text()).toBe("Downsample");
    expect(panel.text()).not.toContain("Gaussian field");
    wrapper.unmount();
  });

  function fakeDataTransfer() {
    const data = new Map<string, string>();
    return {
      dropEffect: "none",
      effectAllowed: "all",
      get types() {
        return [...data.keys()];
      },
      setData(type: string, value: string) {
        data.set(type, value);
      },
      getData(type: string) {
        return data.get(type) ?? "";
      },
    };
  }

  it("makes every component draggable and puts its kind on the drag", async () => {
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });

    const items = visiblePanel(wrapper).findAll("li");
    expect(items.every((item) => item.attributes("draggable") === "true")).toBe(true);
    const dataTransfer = fakeDataTransfer();
    await items[0]!.trigger("dragstart", { dataTransfer });
    expect(dataTransfer.getData("application/x-scisynth-node")).toBe("GaussianField");
    expect(dataTransfer.effectAllowed).toBe("copy");
    wrapper.unmount();
  });

  it("adds the dragged component to the canvas when it is dropped", async () => {
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });
    const canvas = wrapper.find(".vue-flow");

    for (const label of ["Gaussian field", "Multichannel"]) {
      const dataTransfer = fakeDataTransfer();
      const item = visiblePanel(wrapper)
        .findAll("li")
        .find((li) => li.text() === label)!;
      await item.trigger("dragstart", { dataTransfer });
      await canvas.trigger("dragover", { dataTransfer });
      expect(dataTransfer.dropEffect).toBe("copy");
      await canvas.trigger("drop", { dataTransfer, clientX: 120, clientY: 80 });
      await flushPromises();
    }

    const nodes = wrapper.findAll(".vue-flow__node");
    expect(nodes.map((node) => node.text())).toEqual(["Gaussian field", "Multichannel"]);
    expect(nodes[0]!.classes()).toContain("vue-flow__node-input");
    expect(nodes[1]!.classes()).toContain("vue-flow__node-default");
    wrapper.unmount();
  });

  it("centres a dropped node on the mouse once its size is known", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element) {
          this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "DOMMatrixReadOnly",
      class {
        m22 = 1;
      },
    );
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });
    const canvas = wrapper.find(".vue-flow");
    const dataTransfer = fakeDataTransfer();

    await visiblePanel(wrapper).findAll("li")[0]!.trigger("dragstart", { dataTransfer });
    await canvas.trigger("drop", { dataTransfer, clientX: 120, clientY: 80 });
    await flushPromises();

    const node = wrapper.find(".vue-flow__node");
    expect(node.attributes("style")).toContain("translate(45px,60px)");
    wrapper.unmount();
    width.mockRestore();
    height.mockRestore();
  });

  it("ignores drops that are not components", async () => {
    const wrapper = await mountItemView(ProjectDatasetView, { datasetId: DATASET.id });
    const canvas = wrapper.find(".vue-flow");
    const dataTransfer = fakeDataTransfer();
    dataTransfer.setData("text/plain", "hello");

    await canvas.trigger("dragover", { dataTransfer });
    await canvas.trigger("drop", { dataTransfer });
    await flushPromises();

    expect(dataTransfer.dropEffect).toBe("none");
    expect(wrapper.findAll(".vue-flow__node")).toHaveLength(0);
    wrapper.unmount();
  });
});

describe("Survey item view", () => {
  it("fills both panels with light grey and a small inner shadow", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SURVEY));
    const wrapper = await mountItemView(ProjectSurveyItemView, { surveyId: SURVEY.id });

    const canvases = wrapper.findAll("section");
    expect(canvases).toHaveLength(2);
    for (const canvas of canvases) {
      expect(canvas.find("div").classes()).toEqual(
        expect.arrayContaining(["h-full", "bg-muted", "inset-shadow-sm"]),
      );
    }
  });

  it("uses the left panel as the builder and the right panel as the preview", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SURVEY));
    const wrapper = await mountItemView(ProjectSurveyItemView, { surveyId: SURVEY.id });

    const [left, right] = wrapper.findAll("section");
    expect(left!.find('[aria-label="Survey builder"]').exists()).toBe(true);
    expect(right!.find('[aria-label="Survey preview"]').exists()).toBe(true);
    expect(left!.find('[aria-label="Survey builder"]').element.childElementCount).toBe(0);
    expect(right!.find('[aria-label="Survey preview"]').element.childElementCount).toBe(0);
  });
});
