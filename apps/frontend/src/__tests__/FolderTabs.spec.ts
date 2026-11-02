import { describe, it, expect } from "vite-plus/test";

import { flushPromises, mount } from "@vue/test-utils";
import { h } from "vue";

import FolderTabs from "../components/FolderTabs.vue";

function mountTabs() {
  return mount(FolderTabs, {
    props: { tabs: [{ label: "One" }, { label: "Two" }], label: "Sections" },
    slots: { default: ({ tab }: { tab: { label: string } }) => h("p", `${tab.label} content`) },
    attachTo: document.body,
  });
}

function visiblePanel(wrapper: ReturnType<typeof mountTabs>) {
  return wrapper
    .findAll('[role="tabpanel"]')
    .find((panel) => panel.attributes("data-state") === "active")!;
}

describe("FolderTabs", () => {
  it("shows a labelled tab for each item, with the first one open", () => {
    const wrapper = mountTabs();

    const tablist = wrapper.find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Sections");
    const tabs = tablist.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["One", "Two"]);
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual(["true", "false"]);
    expect(visiblePanel(wrapper).text()).toBe("One content");
  });

  it("switches to the chosen tab and passes it to the slot", async () => {
    const wrapper = mountTabs();

    const two = wrapper.findAll('[role="tab"]')[1]!;
    await two.trigger("mousedown", { button: 0 });
    await flushPromises();

    expect(two.attributes("aria-selected")).toBe("true");
    expect(visiblePanel(wrapper).text()).toBe("Two content");
  });

  it("looks like folder tabs sitting on top of a transparent strip", () => {
    const wrapper = mountTabs();

    const tablist = wrapper.find('[role="tablist"]');
    expect(tablist.classes()).toEqual(
      expect.arrayContaining(["absolute", "bottom-full", "left-0", "pointer-events-none"]),
    );
    expect(tablist.classes().some((c) => /^(gap|px|pl)-/.test(c))).toBe(false);
    expect(tablist.classes().some((c) => c.startsWith("bg-") || c.startsWith("border"))).toBe(
      false,
    );
    for (const tab of tablist.findAll('[role="tab"]')) {
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
    expect(visiblePanel(wrapper).classes()).toEqual(
      expect.arrayContaining(["border-t", "bg-background"]),
    );
  });
});
