import { describe, it, expect, vi } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, mountPage, request } from "./helpers";

const PUBLISHED = { ...SURVEY, public_id: "Jx2k8LmN0pQr4StUv6WxY", published_version: 1 };

async function mountView(survey: object = SURVEY) {
  fetchMock.mockResolvedValue(jsonResponse(survey));
  const { wrapper } = await mountPage(ProjectSurveyView, {
    props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
  });
  return wrapper;
}

function findButton(wrapper: Awaited<ReturnType<typeof mountView>>, label: string) {
  return wrapper.findAll("button").find((button) => button.text() === label);
}

describe("Survey view", () => {
  it("has a grey builder with General and Data tabs below it, and an empty preview", async () => {
    const wrapper = await mountView();

    const builder = wrapper.find('[aria-label="Survey builder"]');
    const preview = wrapper.find('[aria-label="Survey preview"]');
    for (const panel of [builder, preview]) {
      expect(panel.classes()).toEqual(expect.arrayContaining(["bg-muted", "inset-shadow-sm"]));
      expect(panel.element.childElementCount).toBe(0);
    }
    const [left, right] = wrapper.findAll("section");
    expect(left!.element.contains(builder.element)).toBe(true);
    expect(right!.element.contains(preview.element)).toBe(true);

    const details = wrapper.find('[role="group"][aria-label="Survey details"]');
    expect(builder.classes()).toContain("flex-3");
    expect(details.classes()).toContain("flex-1");
    expect(builder.element.nextElementSibling).toBe(details.element);
    const tablist = details.find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Survey sections");
    const tabs = tablist.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["General", "Data"]);
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual(["true", "false"]);
  });

  it("publishes the survey and then offers to unpublish it", async () => {
    const wrapper = await mountView();
    const publish = findButton(wrapper, "Publish")!;
    expect(publish.find("svg[data-icon=inline-start]").exists()).toBe(true);
    fetchMock.mockResolvedValue(jsonResponse(PUBLISHED));

    await publish.trigger("click");
    await flushPromises();

    expect(new URL(request("POST").url).pathname).toBe(
      `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}/publish`,
    );
    expect(findButton(wrapper, "Unpublish")).toBeDefined();
  });

  it("only offers a Copy link button once the survey is published", async () => {
    expect(findButton(await mountView(), "Copy link")).toBeUndefined();
    expect(findButton(await mountView(PUBLISHED), "Copy link")).toBeDefined();
  });

  it("copies the public link of a published survey", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const wrapper = await mountView(PUBLISHED);

    const copy = findButton(wrapper, "Copy link")!;
    expect(copy.find("svg[data-icon=inline-start]").exists()).toBe(true);
    await copy.trigger("click");
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/${PUBLISHED.public_id}`);
    expect(copy.text()).toBe("Copied");
    Reflect.deleteProperty(navigator, "clipboard");
  });
});
