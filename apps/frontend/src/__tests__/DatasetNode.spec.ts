import { describe, it, expect } from "vite-plus/test";

import { Handle } from "@vue-flow/core";
import { flushPromises, type DOMWrapper } from "@vue/test-utils";

import { connect, dropKind, mountView, type Wrapper } from "./dataset-view";

function handles(node: DOMWrapper<Element>, side: "target" | "source") {
  return node
    .findAll(`.vue-flow__handle.${side}`)
    .map((handle) => [
      handle.attributes("data-handleid"),
      handle.element.parentElement!.textContent!.trim(),
    ]);
}

describe("Dataset node", () => {
  it("draws a node's input and output ports from the catalog", async () => {
    const wrapper = await mountView();

    const field = await dropKind(wrapper, "GaussianField");
    expect(handles(field, "target")).toEqual([]);
    expect(handles(field, "source")).toEqual([["field", "Field"]]);

    const sampler = await dropKind(wrapper, "GridSampler");
    expect(handles(sampler, "target")).toEqual([["latent", "Latent 0/1"]]);
    expect(handles(sampler, "source")).toEqual([["observation", "Observation"]]);

    const projection = await dropKind(wrapper, "UMAP");
    expect(handles(projection, "target")).toEqual([["observation", "Observation 0/1"]]);
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

  it("deletes a node and its connections from the node's toolbar", async () => {
    const wrapper = await mountView();
    const field = await dropKind(wrapper, "GaussianField");
    const sampler = await dropKind(wrapper, "GridSampler");
    await connect(wrapper, field, sampler, "latent");
    expect(wrapper.findAll(".vue-flow__edge")).toHaveLength(1);

    await field.find('[aria-label="Delete node"]').trigger("click");
    await flushPromises();

    expect(wrapper.findAll(".vue-flow__node").map((node) => node.attributes("data-id"))).toEqual([
      sampler.attributes("data-id"),
    ]);
    expect(wrapper.findAll(".vue-flow__edge")).toHaveLength(0);
    expect(sampler.find('[aria-label="Delete node"]').exists()).toBe(true);
  });

  describe("preview controls", () => {
    function controls(node: DOMWrapper<Element>) {
      return node.find('[aria-label="View preview"]');
    }

    function view(node: DOMWrapper<Element>) {
      return node.find('[aria-label="View preview"]');
    }

    function hide(node: DOMWrapper<Element>) {
      return node.find('[aria-label="Hide preview"]');
    }

    function icon(button: DOMWrapper<Element>) {
      return button
        .find("svg")
        .classes()
        .find((name) => name.startsWith("lucide-"));
    }

    function viewed(wrapper: Wrapper) {
      return wrapper.find('[role="region"][aria-label="Viewed node"]');
    }

    async function press(button: DOMWrapper<Element>) {
      await button.trigger("click");
      await flushPromises();
    }

    it("shows preview controls under every node that has a preview", async () => {
      const wrapper = await mountView();
      const field = await dropKind(wrapper, "GaussianField");
      const gain = await dropKind(wrapper, "Gain");

      expect([view(field), hide(field)].map((b) => b.attributes("aria-pressed"))).toEqual([
        "false",
        "false",
      ]);
      expect(controls(gain).exists()).toBe(false);
    });

    it("switches each icon with its toggle", async () => {
      const wrapper = await mountView();
      const field = await dropKind(wrapper, "GaussianField");
      expect([icon(view(field)), icon(hide(field))]).toEqual(["lucide-eye-off", "lucide-image"]);

      await press(view(field));
      await press(hide(field));

      expect([icon(view(field)), icon(hide(field))]).toEqual(["lucide-eye", "lucide-image-off"]);
    });

    it("shows the viewed node's preview in the panel until it's switched off", async () => {
      const wrapper = await mountView();
      const field = await dropKind(wrapper, "GaussianField");
      expect(viewed(wrapper).find('[role="img"]').exists()).toBe(false);

      await press(view(field));
      expect(view(field).attributes("aria-pressed")).toBe("true");
      expect(viewed(wrapper).find('[role="img"]').attributes("aria-label")).toBe(
        "Preview of Gaussian field",
      );

      await press(view(field));
      expect(viewed(wrapper).find('[role="img"]').exists()).toBe(false);
      expect(controls(field).exists()).toBe(true);
      expect(field.classes()).not.toContain("selected");
    });

    it("hides a node's preview without stopping it being viewed", async () => {
      const wrapper = await mountView();
      const field = await dropKind(wrapper, "GaussianField");
      await press(view(field));
      expect(field.find('[role="img"]').exists()).toBe(true);

      await press(hide(field));

      expect(hide(field).attributes("aria-pressed")).toBe("true");
      expect(view(field).attributes("aria-pressed")).toBe("true");
      expect(field.find('[role="img"]').exists()).toBe(false);
      expect(viewed(wrapper).find('[role="img"]').exists()).toBe(true);
      await press(hide(field));
      expect(field.find('[role="img"]').exists()).toBe(true);
    });

    it("views one node at a time", async () => {
      const wrapper = await mountView();
      const first = await dropKind(wrapper, "GaussianField");
      const second = await dropKind(wrapper, "GaussianField");
      await press(view(first));

      await press(view(second));

      expect(viewed(wrapper).findAll('[role="img"]')).toHaveLength(1);
      expect(view(first).attributes("aria-pressed")).toBe("false");
      expect(view(second).attributes("aria-pressed")).toBe("true");
    });

    it("leaves another node viewed when hiding a preview", async () => {
      const wrapper = await mountView();
      const first = await dropKind(wrapper, "GaussianField");
      const second = await dropKind(wrapper, "GaussianField");
      await press(view(first));

      await press(hide(second));

      expect(view(first).attributes("aria-pressed")).toBe("true");
      expect(viewed(wrapper).find('[role="img"]').exists()).toBe(true);
    });
  });
});
