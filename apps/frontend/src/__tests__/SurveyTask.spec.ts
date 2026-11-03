import { describe, it, expect } from "vite-plus/test";

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { h, nextTick, ref } from "vue";

import SurveyTask from "../components/SurveyTask.vue";
import type { SurveyBlock } from "../lib/survey-blocks";
import type { ChartQuery } from "../lib/survey-charts";
import { goodbye, hello } from "./survey-view";

const blank: SurveyBlock = { id: "b3", type: "text", text: "" };

const noCharts: ChartQuery = () => {
  throw new Error("This survey has no charts");
};

function task(blocks?: SurveyBlock[]) {
  return mount(SurveyTask, {
    props: { name: "Intake form", charts: noCharts, content: blocks ? { blocks } : {} },
  });
}

describe("Survey task", () => {
  it("shows an empty survey with its name", () => {
    const wrapper = task();

    expect(wrapper.find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(wrapper.text()).toContain("This survey has no questions yet.");
  });

  it("treats a survey of only blank text blocks as empty", () => {
    const wrapper = task([blank]);

    expect(wrapper.text()).toContain("This survey has no questions yet.");
    expect(wrapper.find('[data-slot="card-content"]').exists()).toBe(false);
  });

  it("asks a number scale question as a single choice of five", async () => {
    const wrapper = task([{ id: "b4", type: "scale", text: "How clear was it?" }]);

    const question = wrapper.find("p");
    expect(question.text()).toBe("How clear was it?");
    const scale = wrapper.find('[data-slot="toggle-group"]');
    expect(scale.attributes("aria-labelledby")).toBe(question.attributes("id"));
    expect(scale.attributes("data-orientation")).toBe("horizontal");
    const points = scale.findAll("button");
    expect(points.map((point) => point.text())).toEqual(["1", "2", "3", "4", "5"]);

    await points[3]!.trigger("click");
    await points[1]!.trigger("click");
    await flushPromises();

    expect(points.map((point) => point.attributes("data-state"))).toEqual([
      "off",
      "on",
      "off",
      "off",
      "off",
    ]);
  });

  it("leaves out a scale that has no question yet", () => {
    const wrapper = task([{ id: "b4", type: "scale", text: "" }]);

    expect(wrapper.text()).toContain("This survey has no questions yet.");
    expect(wrapper.find('[data-slot="toggle-group"]').exists()).toBe(false);
  });

  it("keeps blocks in one card until a separator starts a new one", () => {
    const wrapper = task([
      hello,
      { id: "b4", type: "scale", text: "How clear was it?" },
      { id: "s1", type: "separator" },
      goodbye,
    ]);

    const cards = wrapper.findAll('[data-slot="card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(cards[0]!.text()).toMatch(/Hello.*How clear was it\?.*12345/s);
    expect(cards[1]!.text()).toBe("Goodbye");
    expect([...wrapper.element.classList]).toEqual(
      expect.arrayContaining(["flex", "flex-col", "gap-4", "mx-auto", "w-full", "max-w-2xl"]),
    );
  });

  it("doesn't make empty cards from extra separators", () => {
    const separator = (id: string): SurveyBlock => ({ id, type: "separator" });
    const wrapper = task([separator("s1"), hello, separator("s2"), blank, separator("s3")]);

    const cards = wrapper.findAll('[data-slot="card"]');
    expect(cards.map((card) => card.text())).toEqual(["Intake formHello"]);
  });

  describe("pages", () => {
    const page = (id: string): SurveyBlock => ({ id, type: "page" });
    const end: SurveyBlock = { id: "e1", type: "end" };

    function action(wrapper: VueWrapper) {
      return wrapper.find('[data-slot="card-footer"] button:last-child');
    }

    function back(wrapper: VueWrapper) {
      return wrapper.findAll('[data-slot="card-footer"] button').find((b) => b.text() === "Back");
    }

    it("shows one page at a time, with Next at the bottom of its last card", async () => {
      const second: SurveyBlock = { id: "b5", type: "text", text: "Second page" };
      const wrapper = task([hello, { id: "s1", type: "separator" }, goodbye, page("p1"), second]);

      const cards = wrapper.findAll('[data-slot="card"]');
      expect(cards.map((card) => card.text())).toEqual(["Intake formHello", "GoodbyeNext"]);
      expect(cards[0]!.find('[data-slot="card-footer"]').exists()).toBe(false);

      await action(wrapper).trigger("click");

      expect(wrapper.findAll('[data-slot="card"]').map((card) => card.text())).toEqual([
        "Intake formSecond pageBack",
      ]);
      expect(action(wrapper).text()).toBe("Back");
    });

    it("goes back a page, with no Back on the first page", async () => {
      const wrapper = task([hello, page("p1"), goodbye, page("p2"), blank, end]);
      expect(back(wrapper)).toBeUndefined();

      await action(wrapper).trigger("click");
      expect(wrapper.text()).toContain("Goodbye");
      await back(wrapper)!.trigger("click");

      expect(wrapper.text()).toContain("Hello");
      expect(back(wrapper)).toBeUndefined();
      expect(action(wrapper).text()).toBe("Next");
    });

    it("offers Submit on the last page once the survey has an end", async () => {
      const wrapper = task([hello, page("p1"), goodbye, end]);

      await action(wrapper).trigger("click");
      expect(action(wrapper).text()).toBe("Submit");
      expect(back(wrapper)).toBeDefined();
      await action(wrapper).trigger("click");

      expect(wrapper.emitted("submit")).toHaveLength(1);
    });

    it("leaves out everything after the end, and pages with nothing on them", async () => {
      const wrapper = task([hello, page("p1"), page("p2"), blank, end, page("p3"), goodbye]);

      expect(wrapper.text()).not.toContain("Goodbye");
      expect(action(wrapper).text()).toBe("Submit");
    });

    it("goes back to the last page when the page it was on is removed", async () => {
      const content = ref({ blocks: [hello, page("p1"), goodbye] });
      const wrapper = mount(() =>
        h(SurveyTask, { name: "Intake form", charts: noCharts, content: content.value }),
      );
      await action(wrapper).trigger("click");

      content.value = { blocks: [hello] };
      await nextTick();

      expect(wrapper.text()).toContain("Hello");
    });

    it("keeps answers when going between pages, and submits them", async () => {
      const clear: SurveyBlock = { id: "q1", type: "scale", text: "How clear was it?" };
      const hard: SurveyBlock = { id: "q2", type: "scale", text: "How hard was it?" };
      const wrapper = task([clear, page("p1"), hard, end]);
      const point = (n: number) => wrapper.findAll('[data-slot="toggle-group-item"]')[n - 1]!;

      await point(4).trigger("click");
      await action(wrapper).trigger("click");
      await point(2).trigger("click");
      await back(wrapper)!.trigger("click");
      expect(point(4).attributes("aria-pressed")).toBe("true");

      await action(wrapper).trigger("click");
      expect(point(2).attributes("aria-pressed")).toBe("true");
      await action(wrapper).trigger("click");

      expect(wrapper.emitted("submit")).toEqual([[{ q1: 4, q2: 2 }]]);
    });

    it("forgets an answer that is unpicked", async () => {
      const wrapper = task([{ id: "q1", type: "scale", text: "How clear was it?" }, end]);
      const four = wrapper.findAll('[data-slot="toggle-group-item"]')[3]!;

      await four.trigger("click");
      await four.trigger("click");
      await action(wrapper).trigger("click");

      expect(wrapper.emitted("submit")).toEqual([[{}]]);
    });

    it("can't be submitted twice while sending", () => {
      const wrapper = mount(SurveyTask, {
        props: {
          name: "Intake form",
          charts: noCharts,
          content: { blocks: [hello, end] },
          submitting: true,
        },
      });

      expect(action(wrapper).text()).toBe("Submitting…");
      expect(action(wrapper).attributes("disabled")).toBeDefined();
    });

    it("shows a submitted response on every page at once, without a way to change it", () => {
      const clear: SurveyBlock = { id: "q1", type: "scale", text: "How clear was it?" };
      const hard: SurveyBlock = { id: "q2", type: "scale", text: "How hard was it?" };
      const wrapper = mount(SurveyTask, {
        props: {
          name: "Intake form",
          charts: noCharts,
          content: {
            blocks: [hello, page("p1"), clear, { id: "s1", type: "separator" }, hard, end],
          },
          answered: { q1: 4, q2: 2 },
        },
      });

      const cards = wrapper.findAll('[data-slot="card"]');
      expect(cards.map((card) => card.text())).toEqual([
        "Intake formHello",
        "How clear was it?12345",
        "How hard was it?12345",
      ]);
      const points = wrapper.findAll('[data-slot="toggle-group-item"]');
      const pressed = points.filter((point) => point.attributes("aria-pressed") === "true");
      expect(pressed.map((point) => point.text())).toEqual(["4", "2"]);
      expect(points.every((point) => point.attributes("disabled") !== undefined)).toBe(true);
      expect(wrapper.find('[data-slot="card-footer"]').exists()).toBe(false);
    });

    it("shows an empty submitted survey with its name", () => {
      const wrapper = mount(SurveyTask, {
        props: { name: "Intake form", charts: noCharts, content: {}, answered: {} },
      });

      expect(wrapper.text()).toBe("Intake formThis survey has no questions yet.");
    });

    it("has no button for an empty survey, even with an end", () => {
      const wrapper = task([end]);

      expect(wrapper.text()).toContain("This survey has no questions yet.");
      expect(action(wrapper).exists()).toBe(false);
    });
  });

  it("shows the text blocks in order, skipping empty ones", () => {
    const wrapper = task([goodbye, blank, hello]);

    const paragraphs = wrapper.findAll("p");
    expect(paragraphs.map((p) => p.text())).toEqual(["Goodbye", "Hello"]);
    expect(paragraphs[0]!.classes()).toEqual(
      expect.arrayContaining(["whitespace-pre-line", "wrap-anywhere"]),
    );
    expect(wrapper.text()).not.toContain("no questions");
  });
});
