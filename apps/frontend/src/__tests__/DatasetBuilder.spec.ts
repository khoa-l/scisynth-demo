import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import { VueFlow, type Connection, type GraphEdge, type GraphNode } from "@vue-flow/core";
import { flushPromises, type DOMWrapper } from "@vue/test-utils";

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
import {
  DATASET,
  dialog,
  fakeDataTransfer,
  fetchMock,
  jsonResponse,
  requests,
  submitName,
} from "./helpers";
import { SAVED_GROUP } from "./saved-groups";

async function shiftClick(node: DOMWrapper<Element>) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft" }));
  await flushPromises();
  await node.trigger("click", { shiftKey: true });
  document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", code: "ShiftLeft" }));
  await flushPromises();
}

function groupButton(node: DOMWrapper<Element>) {
  return node.find('[aria-label="Node controls"] [aria-label="Group nodes"]');
}

async function groupTogether(first: DOMWrapper<Element>, second: DOMWrapper<Element>) {
  await first.trigger("click");
  await shiftClick(second);
  await groupButton(second).trigger("click");
  await flushPromises();
}

async function clickGroupControl(wrapper: Wrapper, label: string) {
  await wrapper
    .find(`.vue-flow__node-dataset-group [aria-label="Group controls"] [aria-label="${label}"]`)
    .trigger("click");
  await flushPromises();
}

function titleText(title: DOMWrapper<Element>) {
  const parts = title.findAll(":scope > *");
  return parts.length ? parts.map((part) => part.text()).join(" ") : title.text();
}

function flow(wrapper: Wrapper) {
  return wrapper.findComponent(VueFlow).vm as unknown as {
    edges: GraphEdge[];
    nodes: GraphNode[];
  };
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

  it("draws every connection with the chosen line type, and remembers it for the dataset", async () => {
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

    reopened.unmount();
    const other = await mountView({ ...DATASET, id: "other-dataset" });
    const field3 = await dropKind(other, "GaussianField");
    const sampler3 = await dropKind(other, "GridSampler");
    await connect(other, field3, sampler3, "latent");
    expect(flow(other).edges[0]!.type).toBe("default");
  });

  it("lays the graph out in the order it flows from the graph settings", async () => {
    const wrapper = await mountView();
    const sampler = await dropKind(wrapper, "GridSampler");
    const field = await dropKind(wrapper, "GaussianField");
    await connect(wrapper, field, sampler, "latent");

    await wrapper
      .find('[role="group"][aria-label="Graph settings"]')
      .findAll("button")
      .find((button) => button.text() === "Auto-layout")!
      .trigger("click");
    await flushPromises();

    const [samplerNode, fieldNode] = flow(wrapper).nodes;
    expect(fieldNode!.position.x).toBeLessThan(samplerNode!.position.x);
    expect(fieldNode!.position.y).toBe(samplerNode!.position.y);
  });

  it("adds to the selection when a node is clicked with shift held", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    const third = await dropKind(wrapper, "Gain");
    const selected = () =>
      wrapper.findAll(".vue-flow__node.selected").map((node) => node.attributes("data-id"));

    await first.trigger("click");
    await shiftClick(second);
    expect(selected()).toEqual([first.attributes("data-id"), second.attributes("data-id")]);

    await third.trigger("click");
    await flushPromises();
    expect(selected()).toEqual([third.attributes("data-id")]);
  });

  it("offers to group nodes only on the selected ones, once there are several", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    const third = await dropKind(wrapper, "Gain");

    await first.trigger("click");
    expect(groupButton(first).exists()).toBe(false);

    await shiftClick(second);
    expect([first, second, third].map((node) => groupButton(node).exists())).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("puts grouped nodes back where they were when they are ungrouped", async () => {
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
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField", 200, 100);
    const second = await dropKind(wrapper, "GridSampler", 600, 400);
    const placed = () =>
      flow(wrapper)
        .nodes.filter((node) => node.type === "dataset-node")
        .map(({ computedPosition: { x, y } }) => ({ x, y }));
    const before = placed();
    expect(before).toEqual([
      { x: 72, y: 50 },
      { x: 472, y: 350 },
    ]);

    await groupTogether(first, second);
    await clickGroupControl(wrapper, "Ungroup nodes");

    expect(placed()).toEqual(before);
    expect(flow(wrapper).nodes.map((node) => [node.parentNode, node.hidden])).toEqual([
      [undefined, false],
      [undefined, false],
    ]);
  });

  it("deletes a group with the nodes in it and their connections", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const other = await dropKind(wrapper, "GaussianField");
    const sum = await dropKind(wrapper, "Sum");
    await connect(wrapper, field, sum, "terms");
    await groupTogether(field, other);

    await clickGroupControl(wrapper, "Delete group");

    expect(flow(wrapper).nodes.map((node) => node.data.kind)).toEqual(["Sum"]);
    expect(flow(wrapper).edges).toEqual([]);
  });

  it("puts the selected nodes inside a new group, shown as a single node", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    await dropKind(wrapper, "Gain");

    await groupTogether(first, second);

    const group = wrapper.find(".vue-flow__node-dataset-group");
    expect(titleText(group.find('[data-slot="group-title"]'))).toBe("Group 2 nodes");
    expect(
      wrapper.findAll('.vue-flow__node [data-slot="node-title"]').map((title) => title.text()),
    ).toEqual(["Gain"]);
    expect(
      flow(wrapper)
        .nodes.filter((node) => node.parentNode === group.attributes("data-id"))
        .map((node) => node.data.kind),
    ).toEqual(["GaussianField", "GridSampler"]);
  });

  it("saves a copy of a group, and only what's inside it, to the account", async () => {
    const wrapper = await mountView();
    const noise = await dropKind(wrapper, "GaussianNoise");
    const gain = await dropKind(wrapper, "Gain");
    const quantize = await dropKind(wrapper, "Quantize");
    await connect(wrapper, noise, gain, "observation", "observation");
    await connect(wrapper, gain, quantize, "observation", "observation");
    await groupTogether(noise, gain);

    await clickGroupControl(wrapper, "Save group");
    expect(dialog()?.textContent).toContain("Save group");
    await submitName("Smoothed noise");

    const save = requests().find((sent) => sent.url.endsWith("/api/saved-groups"))!;
    const { name, content } = await save.json();
    const groupId = wrapper.find(".vue-flow__node-dataset-group").attributes("data-id");
    expect(name).toBe("Smoothed noise");
    expect(content.nodes.map((node: { kind: string }) => node.kind)).toEqual([
      "GaussianNoise",
      "Gain",
    ]);
    expect(content.edges).toHaveLength(1);
    expect(content.groups).toMatchObject([
      { id: groupId, position: { x: 0, y: 0 }, outputs: [{ port: "observation" }] },
    ]);
    expect(dialog()).toBeNull();
  });

  it("names a group, shows the name when the group is open, and offers it when saving", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    await groupTogether(first, second);

    await clickGroupControl(wrapper, "Rename group");
    const input = wrapper.find('[data-slot="group-title"] input');
    (input.element as HTMLInputElement).value = "Sampling";
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(titleText(wrapper.find('[data-slot="group-title"]'))).toBe("Sampling 2 nodes");
    expect(flow(wrapper).nodes[0]!.data.name).toBe("Sampling");
    await clickGroupControl(wrapper, "Save group");
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe("Sampling");
    document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="button"]')!.click();
    await flushPromises();
    await clickGroupControl(wrapper, "View group");
    expect(wrapper.find('[data-slot="group-view-title"]').text()).toBe("Sampling");
  });

  async function dropSavedGroup(wrapper: Wrapper, clientX = 0, clientY = 0) {
    const dataTransfer = fakeDataTransfer();
    dataTransfer.setData("application/x-scisynth-group", JSON.stringify(SAVED_GROUP.content));
    await wrapper.find(".vue-flow").trigger("dragover", { dataTransfer });
    await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX, clientY });
    await flushPromises();
    return dataTransfer;
  }

  it("adds a dropped saved group as a new group with its own copy of the nodes", async () => {
    const wrapper = await mountView();

    const dataTransfer = await dropSavedGroup(wrapper);
    await dropSavedGroup(wrapper);

    expect(dataTransfer.dropEffect).toBe("copy");
    const groups = wrapper.findAll(".vue-flow__node-dataset-group");
    expect(groups).toHaveLength(2);
    expect(titleText(groups[0]!.find('[data-slot="group-title"]'))).toBe("Smoothed noise 2 nodes");
    const { nodes, edges } = flow(wrapper);
    const ids = new Set(nodes.map((node) => node.id));
    expect(ids.size).toBe(6);
    expect(ids.has("saved") || ids.has("noise")).toBe(false);
    expect(nodes.filter((node) => node.parentNode).map((node) => node.data.kind)).toEqual([
      "GaussianNoise",
      "Gain",
      "GaussianNoise",
      "Gain",
    ]);
    expect(edges.filter((edge) => !edge.data?.standsFor)).toHaveLength(2);
  });

  it("doesn't drop a saved group into an open group", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    await groupTogether(first, second);
    await clickGroupControl(wrapper, "View group");

    const dataTransfer = await dropSavedGroup(wrapper);

    expect(dataTransfer.dropEffect).toBe("none");
    expect(flow(wrapper).nodes.filter((node) => node.type === "dataset-group")).toHaveLength(1);
  });

  it("keeps a selected group when the delete key is pressed", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    await groupTogether(first, second);

    await wrapper.find(".vue-flow__node-dataset-group").trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace" }));
    await flushPromises();

    expect(wrapper.find(".vue-flow__node-dataset-group").exists()).toBe(true);
  });

  async function backToMainGraph(wrapper: Wrapper) {
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Main graph")!
      .trigger("click");
    await flushPromises();
  }

  function shownTitles(wrapper: Wrapper) {
    return wrapper
      .findAll(".vue-flow__node")
      .map((node) => titleText(node.find('[data-slot="node-title"], [data-slot="group-title"]')));
  }

  it("opens a group to show only its nodes, and goes back to the main graph", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    await dropKind(wrapper, "Gain");
    await connect(wrapper, field, sampler, "latent");
    await groupTogether(field, sampler);

    await clickGroupControl(wrapper, "View group");

    expect(wrapper.find('[aria-label="Group view"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="group-view-title"]').text()).toBe("Group");
    expect(shownTitles(wrapper)).toEqual([
      "Gaussian field",
      "Grid sampler",
      "Group input",
      "Group output",
    ]);

    await backToMainGraph(wrapper);

    expect(wrapper.find('[aria-label="Node graph"]').exists()).toBe(true);
    expect(shownTitles(wrapper)).toEqual(["Group 2 nodes", "Gain"]);
  });

  it("keeps the group input and output where auto-layout put them after leaving the group", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    await connect(wrapper, field, sampler, "latent");
    await groupTogether(field, sampler);
    const portPositions = () =>
      flow(wrapper)
        .nodes.filter((node) => node.id === "group-input" || node.id === "group-output")
        .map((node) => ({ ...node.position }));

    await clickGroupControl(wrapper, "View group");
    const opened = portPositions();
    await wrapper
      .find('[role="group"][aria-label="Graph settings"]')
      .findAll("button")
      .find((button) => button.text() === "Auto-layout")!
      .trigger("click");
    await flushPromises();
    const laidOut = portPositions();
    await backToMainGraph(wrapper);
    await clickGroupControl(wrapper, "View group");

    expect(laidOut).not.toEqual(opened);
    expect(portPositions()).toEqual(laidOut);
  });

  it("exposes ports on the group through the group input and output, and hides them again", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    const gain = await dropKind(wrapper, "Gain");
    const id = (node: DOMWrapper<Element>) => node.attributes("data-id")!;
    await connect(wrapper, field, sampler, "latent");
    await connect(wrapper, sampler, gain, "observation", "observation");
    await groupTogether(field, sampler);
    await clickGroupControl(wrapper, "View group");

    await connect(wrapper, field, wrapper.find('[data-id="group-output"]'), null);
    flow(wrapper).edges.find(
      (edge) => edge.id === `group-output:${id(sampler)}.observation`,
    )!.selected = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace" }));
    await flushPromises();

    expect(
      flow(wrapper)
        .edges.filter((edge) => edge.target === "group-output")
        .map((edge) => [edge.source, edge.sourceHandle]),
    ).toEqual([[id(field), "field"]]);

    await backToMainGraph(wrapper);

    expect(flow(wrapper).edges.some((edge) => edge.target === id(gain))).toBe(false);
    expect(
      wrapper
        .find(".vue-flow__node-dataset-group")
        .findAll(".vue-flow__handle")
        .map((handle) => handle.attributes("data-handleid")),
    ).toEqual([`${id(field)}.field`]);
  });

  it("stops exposing the ports of a node deleted from an open group", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    await groupTogether(field, sampler);
    await clickGroupControl(wrapper, "View group");

    await wrapper
      .find(`[data-id="${sampler.attributes("data-id")}"] [aria-label="Delete node"]`)
      .trigger("click");
    await flushPromises();

    const group = flow(wrapper).nodes.find((node) => node.type === "dataset-group")!;
    expect(group.data).toMatchObject({
      inputs: [],
      outputs: [{ node: field.attributes("data-id"), port: "field" }],
    });
  });

  it("adds nodes dropped on an open group to the group", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    await groupTogether(field, sampler);
    await clickGroupControl(wrapper, "View group");

    await dropKind(wrapper, "Gain");
    await backToMainGraph(wrapper);

    expect(titleText(wrapper.find('[data-slot="group-title"]'))).toBe("Group 3 nodes");
    expect(shownTitles(wrapper)).toEqual(["Group 3 nodes"]);
  });

  it("ungroups a group's nodes from the group's toolbar", async () => {
    const wrapper = await mountView();
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GridSampler");
    await groupTogether(first, second);

    await clickGroupControl(wrapper, "Ungroup nodes");

    expect(wrapper.find(".vue-flow__node-dataset-group").exists()).toBe(false);
    expect(flow(wrapper).nodes.map((node) => [node.data.kind, node.parentNode])).toEqual([
      ["GaussianField", undefined],
      ["GridSampler", undefined],
    ]);
  });

  it("shows a group's connections on the group, without counting them twice", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const other = await dropKind(wrapper, "GaussianField");
    const sum = await dropKind(wrapper, "Sum");
    await connect(wrapper, field, sum, "terms");
    await groupTogether(field, other);
    const group = wrapper.find(".vue-flow__node-dataset-group");

    expect(
      flow(wrapper).edges.map((edge) => [edge.source, edge.sourceHandle, edge.target]),
    ).toEqual([
      [field.attributes("data-id"), "field", sum.attributes("data-id")],
      [
        group.attributes("data-id"),
        `${field.attributes("data-id")}.field`,
        sum.attributes("data-id"),
      ],
    ]);
    expect(wrapper.find('[data-slot="port-shortfall"]').text()).toBe("1/2");
    expect(
      group.findAll(".vue-flow__handle").map((handle) => handle.attributes("data-handleid")),
    ).toEqual([`${field.attributes("data-id")}.field`, `${other.attributes("data-id")}.field`]);
  });

  it("connects to and from a group's ports, through to the nodes inside", async () => {
    const wrapper = await mountView();
    const sum = await dropKind(wrapper, "Sum");
    const sampler = await dropKind(wrapper, "GridSampler");
    const field = await dropKind(wrapper, "GaussianField");
    const outsideSampler = await dropKind(wrapper, "GridSampler");
    await groupTogether(sum, sampler);
    const group = wrapper.find(".vue-flow__node-dataset-group");
    const id = (node: DOMWrapper<Element>) => node.attributes("data-id")!;
    const isValid = wrapper.findComponent(VueFlow).props("isValidConnection") as (
      connection: Connection,
    ) => boolean;

    expect(
      group
        .findAll('[data-slot="group-member"]')
        .map((member) => member.findAll(":scope > div").map((row) => row.text())),
    ).toEqual([
      ["Sum", "Terms", "Field"],
      ["Grid sampler", "Latent", "Observation"],
    ]);
    expect(
      isValid({
        source: id(field),
        sourceHandle: "field",
        target: id(group),
        targetHandle: `${id(sampler)}.latent`,
      }),
    ).toBe(true);
    expect(
      isValid({
        source: id(group),
        sourceHandle: `${id(sampler)}.observation`,
        target: id(outsideSampler),
        targetHandle: "latent",
      }),
    ).toBe(false);

    await connect(wrapper, field, group, `${id(sum)}.terms`);
    await connect(wrapper, group, outsideSampler, "latent", `${id(sum)}.field`);

    expect(
      flow(wrapper).edges.map((edge) => [
        edge.source,
        edge.sourceHandle,
        edge.target,
        edge.targetHandle,
      ]),
    ).toEqual([
      [id(field), "field", id(sum), "terms"],
      [id(sum), "field", id(outsideSampler), "latent"],
      [id(field), "field", id(group), `${id(sum)}.terms`],
      [id(group), `${id(sum)}.field`, id(outsideSampler), "latent"],
    ]);
  });

  it("deletes the real connection when its line to a group is deleted", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const other = await dropKind(wrapper, "GaussianField");
    const sum = await dropKind(wrapper, "Sum");
    await connect(wrapper, field, sum, "terms");
    await groupTogether(field, other);
    const standIn = flow(wrapper).edges.find((edge) => edge.data?.standsFor)!;
    expect(standIn.selectable).not.toBe(false);

    standIn.selected = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace" }));
    await flushPromises();

    expect(flow(wrapper).edges).toEqual([]);
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
            name: null,
            preview_hidden: false,
          },
          {
            id: "sampler",
            kind: "GridSampler",
            params: { shape: 32 },
            position: { x: 300, y: 0 },
            name: null,
            preview_hidden: false,
          },
          {
            id: "old",
            kind: "RemovedStage",
            params: { strength: 3 },
            position: { x: 600, y: 0 },
            name: null,
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
        groups: [],
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
