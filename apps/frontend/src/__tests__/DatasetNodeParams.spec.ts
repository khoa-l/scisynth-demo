import { describe, it, expect } from "vite-plus/test";

import { flushPromises, type DOMWrapper } from "@vue/test-utils";

import DatasetNode from "../components/DatasetNode.vue";
import type { DatasetNodeData } from "../lib/dataset-nodes/graph";
import { dropKind, enter, mountView, type Wrapper } from "./dataset-view";

function lastNodeData(wrapper: Wrapper) {
  const nodes = wrapper.findAllComponents(DatasetNode);
  return (nodes[nodes.length - 1]!.props() as { data: DatasetNodeData }).data;
}

function inputValue(wrapper: DOMWrapper<Element>) {
  return (wrapper.element as HTMLInputElement).value;
}

async function press(button: DOMWrapper<Element>) {
  button.element.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
  window.dispatchEvent(new PointerEvent("pointerup"));
  await flushPromises();
}

describe("Dataset node parameters", () => {
  it("starts a node's parameters at their defaults and keeps valid edits", async () => {
    const wrapper = await mountView();
    const node = await dropKind(wrapper, "GaussianNoise");

    expect(node.findAll("label").map((label) => label.text())).toEqual(["Sigma", "Mean", "Seed"]);
    const sigma = node.find(`#${node.find("label").attributes("for")}`);
    expect(inputValue(sigma)).toBe("1");

    await enter(sigma, "0.5");
    expect(lastNodeData(wrapper).params).toEqual({ sigma: 0.5, mean: 0, seed: 0 });

    await enter(sigma, "-1");
    expect(inputValue(sigma)).toBe("0");
    expect(lastNodeData(wrapper).params.sigma).toBe(0);
  });

  it("steps numbers with the up and down arrows inside each box", async () => {
    const wrapper = await mountView();
    const levels = (await dropKind(wrapper, "Quantize")).find("input");
    const noise = await dropKind(wrapper, "GaussianNoise");
    const up = noise.find('[aria-label="Increase"]');
    const down = noise.find('[aria-label="Decrease"]');
    await press(up);
    expect(lastNodeData(wrapper).params.sigma).toBe(2);
    await press(down);
    await press(down);
    await press(down);
    expect(lastNodeData(wrapper).params.sigma).toBe(0);
    expect(down.attributes("disabled")).toBeDefined();

    await enter(levels, "2.4");
    expect(inputValue(levels)).toBe("2");
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

    const umap = await dropKind(wrapper, "UMAP");
    const trigger = umap.find('[data-slot="select-trigger"]');
    expect(trigger.text()).toBe("Euclidean");
    await trigger.trigger("keydown", { key: "Enter" });
    await flushPromises();
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    options
      .find((option) => option.textContent?.trim() === "Cosine")!
      .dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await flushPromises();
    expect(lastNodeData(wrapper).params).toEqual({
      n_neighbors: 15,
      min_dist: 0.1,
      metric: "cosine",
      seed: 0,
    });
  });

  it("turns switch parameters on and off", async () => {
    const wrapper = await mountView();
    const pca = await dropKind(wrapper, "PCA");

    expect(pca.findAll("label").map((label) => label.text())).toEqual(["Whiten", "Solver", "Seed"]);
    const whiten = pca.find('[role="switch"]');
    expect(whiten.attributes("aria-checked")).toBe("false");

    await whiten.trigger("click");
    expect(lastNodeData(wrapper).params).toEqual({ whiten: true, svd_solver: "auto", seed: 0 });
    expect(whiten.attributes("aria-checked")).toBe("true");

    await whiten.trigger("click");
    expect(lastNodeData(wrapper).params.whiten).toBe(false);
  });
});
