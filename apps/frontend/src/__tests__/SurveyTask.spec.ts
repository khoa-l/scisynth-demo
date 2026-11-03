import { describe, it, expect } from "vite-plus/test";

import { mount } from "@vue/test-utils";

import SurveyTask from "../components/SurveyTask.vue";
import type { SurveyBlock } from "../lib/survey-blocks";
import { goodbye, hello } from "./survey-view";

const blank: SurveyBlock = { id: "b3", type: "text", text: "" };

function task(blocks?: SurveyBlock[]) {
  return mount(SurveyTask, { props: { name: "Intake form", content: blocks ? { blocks } : {} } });
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
