import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import { details, mountView, visiblePanel, type Wrapper } from "./dataset-view";
import { SAVED_GROUP } from "./saved-groups";
import { fakeDataTransfer } from "./helpers";

async function openTab(wrapper: Wrapper, label: string) {
  await details(wrapper)
    .findAll('[role="tab"]')
    .find((tab) => tab.text() === label)!
    .trigger("mousedown", { button: 0 });
  await flushPromises();
}

describe("Dataset node palette", () => {
  it("has a folder tab for each node category, with Latent open first", async () => {
    const wrapper = await mountView();

    const tablist = details(wrapper).find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Node categories");
    const tabs = tablist.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual([
      "Latent",
      "Sampler",
      "Stages",
      "Projection",
      "Saved groups",
    ]);
    expect(tabs[0]!.attributes("aria-selected")).toBe("true");
    expect(visiblePanel(wrapper).text()).toContain("Gaussian Field");
  });

  it("lists every stage, without sub-category headings, under Stages", async () => {
    const wrapper = await mountView();

    await openTab(wrapper, "Stages");

    const panel = visiblePanel(wrapper);
    expect(panel.find("h3").exists()).toBe(false);
    expect(panel.text()).not.toMatch(/Defects|Transforms|Gaussian Field/);
    const items = panel.findAll("li").map((item) => item.text());
    expect(items).toHaveLength(13);
    expect([items[0], items[12]]).toEqual(["Gaussian Noise", "Downsample"]);
  });

  it("offers the projections under Projection", async () => {
    const wrapper = await mountView();

    await openTab(wrapper, "Projection");

    expect(
      visiblePanel(wrapper)
        .findAll("li")
        .map((item) => item.text()),
    ).toEqual(["PCA", "UMAP", "Isomap", "Random Gaussian"]);
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

  it("says how to save a group when none are saved yet", async () => {
    const wrapper = await mountView();

    await openTab(wrapper, "Saved groups");

    expect(visiblePanel(wrapper).text()).toContain("Save a group from its toolbar");
  });

  it("lists the account's saved groups and puts a group's graph on the drag", async () => {
    const wrapper = await mountView(undefined, [SAVED_GROUP]);

    await openTab(wrapper, "Saved groups");

    const item = visiblePanel(wrapper).find("li");
    expect(item.text()).toBe("Smoothed noise");
    expect(item.attributes("draggable")).toBe("true");
    const dataTransfer = fakeDataTransfer();
    await item.trigger("dragstart", { dataTransfer });
    expect(JSON.parse(dataTransfer.getData("application/x-scisynth-group"))).toEqual(
      SAVED_GROUP.content,
    );
  });

  it("drops a renamed saved group under its new name", async () => {
    const wrapper = await mountView(undefined, [{ ...SAVED_GROUP, name: "Renamed" }]);
    await openTab(wrapper, "Saved groups");

    const dataTransfer = fakeDataTransfer();
    await visiblePanel(wrapper).find("li").trigger("dragstart", { dataTransfer });

    const dropped = JSON.parse(dataTransfer.getData("application/x-scisynth-group"));
    expect(dropped.groups[0].name).toBe("Renamed");
  });
});
