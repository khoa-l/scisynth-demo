import { describe, it, expect, vi } from "vite-plus/test";

import { Handle, VueFlow } from "@vue-flow/core";
import { flushPromises, type DOMWrapper } from "@vue/test-utils";

import CatalogNode from "../components/CatalogNode.vue";
import type { CatalogNodeData } from "../lib/nodes/catalog";
import ProjectDatasetView from "../views/ProjectDatasetView.vue";
import {
  DATASET,
  PROJECT_ID,
  fakeDataTransfer,
  fetchMock,
  jsonResponse,
  mountPage,
} from "./helpers";

async function mountView() {
  fetchMock.mockResolvedValue(jsonResponse(DATASET));
  const { wrapper } = await mountPage(ProjectDatasetView, {
    props: { projectId: PROJECT_ID, datasetId: DATASET.id },
  });
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountView>>;

function details(wrapper: Wrapper) {
  return wrapper.find('[role="group"][aria-label="Node details"]');
}

function visiblePanel(wrapper: Wrapper) {
  return details(wrapper)
    .findAll('[role="tabpanel"]')
    .find((panel) => panel.attributes("data-state") === "active")!;
}

function component(wrapper: Wrapper, label: string) {
  return visiblePanel(wrapper)
    .findAll("li")
    .find((item) => item.text() === label)!;
}

describe("Dataset view", () => {
  it("shows a grey Vue Flow grid above the component tabs and an empty right panel", async () => {
    const wrapper = await mountView();

    const [left, right] = wrapper.findAll("section");
    const graph = left!.find('.vue-flow[aria-label="Node graph"]');
    expect(graph.classes()).toEqual(expect.arrayContaining(["bg-muted", "inset-shadow-sm"]));
    expect(graph.find(".vue-flow__background pattern path").attributes("stroke")).toBe("#dcdcdc");
    expect(graph.find(".vue-flow__background pattern circle").exists()).toBe(false);
    const graphArea = graph.element.parentElement!;
    expect(graphArea.classList).toContain("flex-3");
    expect(details(wrapper).classes()).toContain("flex-1");
    expect(graphArea.nextElementSibling).toBe(details(wrapper).element);
    expect(right!.element.childElementCount).toBe(0);
  });

  it("has a folder tab for each component category, with Latent open first", async () => {
    const wrapper = await mountView();

    const tablist = details(wrapper).find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Component categories");
    const tabs = tablist.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["Latent", "Sampler", "Stages", "Projection"]);
    expect(tabs[0]!.attributes("aria-selected")).toBe("true");
    expect(visiblePanel(wrapper).text()).toContain("Gaussian field");
  });

  it("lists every stage, without sub-category headings, under Stages", async () => {
    const wrapper = await mountView();

    await details(wrapper)
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "Stages")!
      .trigger("mousedown", { button: 0 });
    await flushPromises();

    const panel = visiblePanel(wrapper);
    expect(panel.find("h3").exists()).toBe(false);
    expect(panel.text()).not.toMatch(/Defects|Transforms|Gaussian field/);
    const items = panel.findAll("li").map((item) => item.text());
    expect(items).toHaveLength(13);
    expect([items[0], items[12]]).toEqual(["Gaussian noise", "Downsample"]);
  });

  it("makes every component draggable and puts its kind on the drag", async () => {
    const wrapper = await mountView();

    const items = visiblePanel(wrapper).findAll("li");
    expect(items.every((item) => item.attributes("draggable") === "true")).toBe(true);
    const dataTransfer = fakeDataTransfer();
    await items[0]!.trigger("dragstart", { dataTransfer });
    expect(dataTransfer.getData("application/x-scisynth-node")).toBe("GaussianField");
    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  it("adds the dragged component to the canvas when it is dropped", async () => {
    const wrapper = await mountView();
    const canvas = wrapper.find(".vue-flow");

    for (const label of ["Gaussian field", "Multichannel"]) {
      const dataTransfer = fakeDataTransfer();
      await component(wrapper, label).trigger("dragstart", { dataTransfer });
      await canvas.trigger("dragover", { dataTransfer });
      expect(dataTransfer.dropEffect).toBe("copy");
      await canvas.trigger("drop", { dataTransfer, clientX: 120, clientY: 80 });
      await flushPromises();
    }

    const nodes = wrapper.findAll(".vue-flow__node");
    expect(nodes.map((node) => node.find('[data-slot="node-title"]').text())).toEqual([
      "Gaussian field",
      "Multichannel",
    ]);
    expect(nodes.every((node) => node.classes().includes("vue-flow__node-catalog"))).toBe(true);
  });

  async function dropKind(wrapper: Wrapper, name: string) {
    const dataTransfer = fakeDataTransfer();
    dataTransfer.setData("application/x-scisynth-node", name);
    await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX: 0, clientY: 0 });
    await flushPromises();
    const nodes = wrapper.findAll(".vue-flow__node");
    return nodes[nodes.length - 1]!;
  }

  /** The data held by the last node dropped on the canvas. */
  function lastNodeData(wrapper: Wrapper) {
    const nodes = wrapper.findAllComponents(CatalogNode);
    return (nodes[nodes.length - 1]!.props() as { data: CatalogNodeData }).data;
  }

  function handles(node: DOMWrapper<Element>, side: "target" | "source") {
    return node
      .findAll(`.vue-flow__handle.${side}`)
      .map((handle) => [
        handle.attributes("data-handleid"),
        handle.element.parentElement!.textContent!.trim(),
      ]);
  }

  function inputValue(wrapper: DOMWrapper<Element>) {
    return (wrapper.element as HTMLInputElement | HTMLSelectElement).value;
  }

  async function enter(input: DOMWrapper<Element>, value: string) {
    (input.element as HTMLInputElement).value = value;
    await input.trigger("change");
  }

  it("draws a node's input and output ports from the catalogue", async () => {
    const wrapper = await mountView();

    const field = await dropKind(wrapper, "GaussianField");
    expect(handles(field, "target")).toEqual([]);
    expect(handles(field, "source")).toEqual([["field", "Field"]]);

    const sampler = await dropKind(wrapper, "GridSampler");
    expect(handles(sampler, "target")).toEqual([["latent", "Latent"]]);
    expect(handles(sampler, "source")).toEqual([["observation", "Observation"]]);

    const projection = await dropKind(wrapper, "Projection");
    expect(handles(projection, "source")).toEqual([]);
  });

  it("starts a node's parameters at their defaults and keeps valid edits", async () => {
    const wrapper = await mountView();
    const node = await dropKind(wrapper, "GaussianNoise");

    expect(node.findAll("label").map((label) => label.text())).toEqual(["Sigma", "Mean"]);
    const sigma = node.find(`#${node.find("label").attributes("for")}`);
    expect(inputValue(sigma)).toBe("1");

    await enter(sigma, "0.5");
    expect(lastNodeData(wrapper).params).toEqual({ sigma: 0.5, mean: 0 });

    await enter(sigma, "-1");
    expect(inputValue(sigma)).toBe("0.5");
    expect(lastNodeData(wrapper).params.sigma).toBe(0.5);
  });

  it("lets optional parameters be blank and picks options from a list", async () => {
    const wrapper = await mountView();

    const quantize = await dropKind(wrapper, "Quantize");
    const [levels, vmin] = quantize.findAll("input");
    expect([levels, vmin].map((input) => input!.attributes("placeholder"))).toEqual([
      undefined,
      "Auto",
    ]);
    await enter(levels!, "");
    expect(inputValue(levels!)).toBe("256");
    await enter(vmin!, "2");
    await enter(vmin!, "");
    expect(lastNodeData(wrapper).params).toEqual({ levels: 256, vmin: null, vmax: null });

    const field = await dropKind(wrapper, "InterpolatedField");
    const select = field.find("select");
    expect(inputValue(select)).toBe("nearest");
    await select.setValue("grid-wrap");
    expect(lastNodeData(wrapper).params).toEqual({ order: 1, mode: "grid-wrap" });
  });

  it("lets an input port take one edge unless it accepts several", async () => {
    const wrapper = await mountView();

    await dropKind(wrapper, "Sum");
    await dropKind(wrapper, "PointSampler");
    const inputs = wrapper.findAllComponents(Handle).filter((h) => h.props("type") === "target");
    expect(inputs.map((handle) => handle.props("connectable"))).toEqual([true, "single"]);
  });

  it("draws connections 2px wide", async () => {
    const wrapper = await mountView();

    expect(wrapper.findComponent(VueFlow).props("defaultEdgeOptions")).toEqual({
      style: { strokeWidth: 2 },
    });
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
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
    const wrapper = await mountView();
    const dataTransfer = fakeDataTransfer();

    await component(wrapper, "Gaussian field").trigger("dragstart", { dataTransfer });
    await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX: 120, clientY: 80 });
    await flushPromises();

    expect(wrapper.find(".vue-flow__node").attributes("style")).toContain("translate(45px,60px)");
  });

  it("ignores drops that are not components", async () => {
    const wrapper = await mountView();
    const canvas = wrapper.find(".vue-flow");
    const dataTransfer = fakeDataTransfer();
    dataTransfer.setData("text/plain", "hello");

    await canvas.trigger("dragover", { dataTransfer });
    await canvas.trigger("drop", { dataTransfer });
    await flushPromises();

    expect(dataTransfer.dropEffect).toBe("none");
    expect(wrapper.findAll(".vue-flow__node")).toHaveLength(0);
  });
});
