import { describe, it, expect } from "vite-plus/test";

import { Handle } from "@vue-flow/core";
import type { DOMWrapper } from "@vue/test-utils";

import { connect, dropKind, mountView, paletteItem } from "./dataset-view";

function handles(node: DOMWrapper<Element>, side: "target" | "source") {
  return node
    .findAll(`.vue-flow__handle.${side}`)
    .map((handle) => [
      handle.attributes("data-handleid"),
      handle.element.parentElement!.textContent!.trim(),
    ]);
}

describe("Dataset node", () => {
  it("colours a node's title like its chip in the palette", async () => {
    const wrapper = await mountView();
    const chip = paletteItem(wrapper, "Gaussian field").attributes("style");

    const node = await dropKind(wrapper, "GaussianField");
    expect(node.find('[data-slot="node-title"]').attributes("style")).toBe(chip);
  });

  it("draws a node's input and output ports from the catalog", async () => {
    const wrapper = await mountView();

    const field = await dropKind(wrapper, "GaussianField");
    expect(handles(field, "target")).toEqual([]);
    expect(handles(field, "source")).toEqual([["field", "Field"]]);

    const sampler = await dropKind(wrapper, "GridSampler");
    expect(handles(sampler, "target")).toEqual([["latent", "Latent 0/1"]]);
    expect(handles(sampler, "source")).toEqual([["observation", "Observation"]]);

    const projection = await dropKind(wrapper, "Projection");
    expect(handles(projection, "source")).toEqual([]);
  });

  it("lets an input port take one edge unless it accepts several", async () => {
    const wrapper = await mountView();

    await dropKind(wrapper, "Sum");
    await dropKind(wrapper, "PointSampler");
    const inputs = wrapper.findAllComponents(Handle).filter((h) => h.props("type") === "target");
    expect(inputs.map((handle) => handle.props("connectable"))).toEqual([true, "single"]);
  });

  it("shows how many connections an input still needs", async () => {
    const wrapper = await mountView();
    const sum = await dropKind(wrapper, "Sum");
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GaussianField");
    const shortfall = () => sum.find('[data-slot="port-shortfall"]');

    expect(shortfall().text()).toBe("0/2");
    expect(shortfall().classes()).toContain("text-destructive");
    await connect(wrapper, first, sum, "terms");
    expect(shortfall().text()).toBe("1/2");
    await connect(wrapper, second, sum, "terms");
    expect(shortfall().exists()).toBe(false);
  });
});
