import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import { VueFlow, type GraphEdge } from "@vue-flow/core";
import { flushPromises } from "@vue/test-utils";

import type { DatasetPublic } from "../client";
import {
  answerWith,
  connect,
  dropKind,
  enter,
  mountView,
  paletteItem,
  type Wrapper,
} from "./dataset-view";
import { DATASET, fakeDataTransfer, fetchMock, jsonResponse, requests } from "./helpers";

function flow(wrapper: Wrapper) {
  return wrapper.findComponent(VueFlow).vm as unknown as { edges: GraphEdge[] };
}

describe("Dataset builder", () => {
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

  it("centres a dropped node's title bar on the mouse once its size is known", async () => {
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
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.slot === "node-title" ? 36 : 200;
    });
    const wrapper = await mountView();
    const dataTransfer = fakeDataTransfer();

    await paletteItem(wrapper, "Gaussian field").trigger("dragstart", { dataTransfer });
    await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX: 120, clientY: 80 });
    await flushPromises();

    expect(wrapper.find(".vue-flow__node").attributes("style")).toContain("translate(45px,62px)");
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

  it("gives each new connection its own short id, and ignores repeats", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");

    await connect(wrapper, field, sampler, "latent");
    await connect(wrapper, field, sampler, "latent");

    expect(flow(wrapper).edges).toHaveLength(1);
    expect(flow(wrapper).edges[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(flow(wrapper).edges[0]).toMatchObject({
      source: field.attributes("data-id"),
      sourceHandle: "field",
      target: sampler.attributes("data-id"),
      targetHandle: "latent",
    });
  });

  it("draws every connection with the chosen line type, and remembers it", async () => {
    localStorage.clear();
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    await connect(wrapper, field, sampler, "latent");
    expect(flow(wrapper).edges[0]!.type).toBe("default");

    const step = wrapper.findAll('[role="group"][aria-label="Graph settings"] button')[2]!;
    expect(step.text()).toBe("Step");
    await step.trigger("click");
    expect(flow(wrapper).edges[0]!.type).toBe("step");

    const second = await dropKind(wrapper, "GridSampler");
    await connect(wrapper, field, second, "latent");
    expect(flow(wrapper).edges.map((edge) => edge.type)).toEqual(["step", "step"]);

    wrapper.unmount();
    const reopened = await mountView();
    const field2 = await dropKind(reopened, "GaussianField");
    const sampler2 = await dropKind(reopened, "GridSampler");
    await connect(reopened, field2, sampler2, "latent");
    expect(flow(reopened).edges[0]!.type).toBe("step");
    localStorage.clear();
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
            preview_hidden: false,
          },
          {
            id: "sampler",
            kind: "GridSampler",
            params: { shape: 32 },
            position: { x: 300, y: 0 },
            preview_hidden: false,
          },
          {
            id: "old",
            kind: "RemovedStage",
            params: { strength: 3 },
            position: { x: 600, y: 0 },
            preview_hidden: false,
          },
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

      answerWith(DATASET);
      await alert.find("button").trigger("click");
      await flushPromises();

      expect(patches()).toHaveLength(2);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });
});
