import { describe, it, expect } from "vite-plus/test";

import { details, mountView } from "./dataset-view";

describe("Dataset view", () => {
  it("shows a grey Vue Flow grid above the node category tabs and a white panel split two thirds to one", async () => {
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
    const panel = right!.find(".divide-y");
    expect(panel.classes()).toEqual(
      expect.arrayContaining(["bg-background", "grid-rows-[2fr_1fr]"]),
    );
    expect(panel.element.childElementCount).toBe(2);
    expect(panel.text()).toBe("");
  });
});
