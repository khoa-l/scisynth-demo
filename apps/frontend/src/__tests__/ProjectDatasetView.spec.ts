import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import { Handle, VueFlow, type Connection, type GraphEdge } from "@vue-flow/core";
import { flushPromises, type DOMWrapper } from "@vue/test-utils";

import type { DatasetPublic } from "../client";
import DatasetNode from "../components/DatasetNode.vue";
import type { DatasetNodeData } from "../lib/dataset-nodes/catalog";
import ProjectDatasetView from "../views/ProjectDatasetView.vue";
import {
  DATASET,
  PROJECT_ID,
  fakeDataTransfer,
  fetchMock,
  jsonResponse,
  mountPage,
  requests,
} from "./helpers";

async function mountView(dataset: DatasetPublic = DATASET) {
  fetchMock.mockImplementation(async () => jsonResponse(dataset));
  const { wrapper } = await mountPage(ProjectDatasetView, {
    props: { projectId: PROJECT_ID, datasetId: DATASET.id },
  });
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountView>>;

function details(wrapper: Wrapper) {
  return wrapper.find('[role="group"][aria-label="Dataset details"]');
}

function visiblePanel(wrapper: Wrapper) {
  return details(wrapper)
    .findAll('[role="tabpanel"]')
    .find((panel) => panel.attributes("data-state") === "active")!;
}

function paletteItem(wrapper: Wrapper, label: string) {
  return visiblePanel(wrapper)
    .findAll("li")
    .find((item) => item.text() === label)!;
}

describe("Dataset view", () => {
  it("shows a grey Vue Flow grid above the node category tabs and an empty right panel", async () => {
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

  it("has a folder tab for each node category, with Latent open first", async () => {
    const wrapper = await mountView();

    const tablist = details(wrapper).find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Node categories");
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

  it("colours each chip in a single hue for its group", async () => {
    const wrapper = await mountView();
    const background = (label: string) => paletteItem(wrapper, label).attributes("style");

    const hues = [...background("Gaussian field")!.matchAll(/oklch\([\d.]+ [\d.]+ ([\d.]+)\)/g)];
    expect(hues.map((match) => match[1])).toEqual(["250", "250"]);
    expect(background("Gaussian field")).toBe(background("Interpolated field"));
    expect(background("Gaussian field")).not.toBe(background("Sum"));

    await details(wrapper)
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "Stages")!
      .trigger("mousedown", { button: 0 });
    await flushPromises();
    expect(background("Gaussian noise")).toBe(background("Gain"));
    expect(background("Gaussian noise")).not.toBe(background("Downsample"));
  });

  it("colours a node's title like its chip in the palette", async () => {
    const wrapper = await mountView();
    const chip = paletteItem(wrapper, "Gaussian field").attributes("style");

    const node = await dropKind(wrapper, "GaussianField");
    expect(node.find('[data-slot="node-title"]').attributes("style")).toBe(chip);
  });

  it("makes every node kind draggable and puts its kind on the drag", async () => {
    const wrapper = await mountView();

    const items = visiblePanel(wrapper).findAll("li");
    expect(items.every((item) => item.attributes("draggable") === "true")).toBe(true);
    const dataTransfer = fakeDataTransfer();
    await items[0]!.trigger("dragstart", { dataTransfer });
    expect(dataTransfer.getData("application/x-scisynth-node")).toBe("GaussianField");
    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  it("adds the dragged node to the canvas when it is dropped", async () => {
    const wrapper = await mountView();
    const canvas = wrapper.find(".vue-flow");

    for (const label of ["Gaussian field", "Multichannel"]) {
      const dataTransfer = fakeDataTransfer();
      await paletteItem(wrapper, label).trigger("dragstart", { dataTransfer });
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
    expect(nodes.every((node) => node.classes().includes("vue-flow__node-dataset-node"))).toBe(
      true,
    );
  });

  async function dropKind(wrapper: Wrapper, name: string) {
    const dataTransfer = fakeDataTransfer();
    dataTransfer.setData("application/x-scisynth-node", name);
    await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX: 0, clientY: 0 });
    await flushPromises();
    const nodes = wrapper.findAll(".vue-flow__node");
    return nodes[nodes.length - 1]!;
  }

  function lastNodeData(wrapper: Wrapper) {
    const nodes = wrapper.findAllComponents(DatasetNode);
    return (nodes[nodes.length - 1]!.props() as { data: DatasetNodeData }).data;
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

  it("draws a node's input and output ports from the catalog", async () => {
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

  it("gives each new connection its own short id, and ignores repeats", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    const flow = wrapper.findComponent(VueFlow).vm as unknown as {
      emits: { connect: (connection: Connection) => void };
      edges: GraphEdge[];
    };
    const connection = {
      source: field.attributes("data-id")!,
      sourceHandle: "field",
      target: sampler.attributes("data-id")!,
      targetHandle: "latent",
    };

    flow.emits.connect(connection);
    flow.emits.connect(connection);
    await flushPromises();

    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(flow.edges[0]).toMatchObject(connection);
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

    await paletteItem(wrapper, "Gaussian field").trigger("dragstart", { dataTransfer });
    await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX: 120, clientY: 80 });
    await flushPromises();

    expect(wrapper.find(".vue-flow__node").attributes("style")).toContain("translate(45px,60px)");
  });

  it("ignores drops that are not node kinds", async () => {
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

  describe("saving", () => {
    const SAVED: DatasetPublic = {
      ...DATASET,
      content: {
        version: 1,
        nodes: [
          {
            id: "field",
            kind: "GaussianField",
            params: { length_scale: 0.2, amplitude: 1, mean: 0, resolution: 64, order: 1 },
            position: { x: 0, y: 0 },
          },
          { id: "sampler", kind: "GridSampler", params: { shape: 32 }, position: { x: 300, y: 0 } },
          { id: "old", kind: "RemovedStage", params: { strength: 3 }, position: { x: 600, y: 0 } },
        ],
        edges: [
          {
            id: "e1",
            source: "field",
            source_port: "field",
            target: "sampler",
            target_port: "latent",
          },
        ],
      },
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    function flow(wrapper: Wrapper) {
      return wrapper.findComponent(VueFlow).vm as unknown as { edges: GraphEdge[] };
    }

    function patches() {
      return requests().filter((request) => request.method === "PATCH");
    }

    async function wait(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      await flushPromises();
    }

    it("loads the saved graph onto the canvas", async () => {
      const wrapper = await mountView(SAVED);

      const titles = wrapper.findAll('.vue-flow__node [data-slot="node-title"]');
      expect(titles.map((title) => title.text())).toEqual([
        "Gaussian field",
        "Grid sampler",
        "Unknown: RemovedStage",
      ]);
      expect(flow(wrapper).edges).toMatchObject([
        {
          id: "e1",
          source: "field",
          sourceHandle: "field",
          target: "sampler",
          targetHandle: "latent",
        },
      ]);
      const gridSize = wrapper.findAll(".vue-flow__node")[1]!.find("input");
      expect((gridSize.element as HTMLInputElement).value).toBe("32");
    });

    it("doesn't save a graph just because it was opened", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await mountView(SAVED);

      await wait(1000);
      expect(patches()).toHaveLength(0);
    });

    it("saves once, shortly after the last of several quick changes", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const wrapper = await mountView();

      await dropKind(wrapper, "GaussianField");
      await dropKind(wrapper, "GridSampler");
      await wait(499);
      expect(patches()).toHaveLength(0);

      await wait(1);
      expect(patches()).toHaveLength(1);
      const { content } = await patches()[0]!.json();
      expect(content.nodes.map((node: { kind: string }) => node.kind)).toEqual([
        "GaussianField",
        "GridSampler",
      ]);
      expect(content.nodes.every((node: { id: string }) => node.id.length <= 64)).toBe(true);
    });

    it("saves again when a parameter changes", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const wrapper = await mountView(SAVED);

      await enter(wrapper.findAll(".vue-flow__node")[1]!.find("input"), "16");
      await wait(500);

      expect(patches()).toHaveLength(1);
      const { content } = await patches()[0]!.json();
      expect(content.nodes[1].params).toEqual({ shape: 16 });
      expect(content.nodes[2]).toEqual(SAVED.content.nodes[2]);
      expect(content.edges).toEqual(SAVED.content.edges);
    });

    it("saves a pending change straight away when the page is left", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const wrapper = await mountView();

      await dropKind(wrapper, "Gain");
      wrapper.unmount();
      await flushPromises();

      expect(patches()).toHaveLength(1);
    });

    it("shows a failed save and saves again on retry", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const wrapper = await mountView();
      fetchMock.mockImplementation(async () => jsonResponse({ detail: "Server error" }, 500));

      await dropKind(wrapper, "Gain");
      await wait(500);
      const alert = wrapper.find('.vue-flow [role="alert"]');
      expect(alert.text()).toContain("Couldn't save your changes.");

      fetchMock.mockImplementation(async () => jsonResponse(DATASET));
      await alert.find("button").trigger("click");
      await flushPromises();

      expect(patches()).toHaveLength(2);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });
});
