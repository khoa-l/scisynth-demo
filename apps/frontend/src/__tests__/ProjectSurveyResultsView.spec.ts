import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import ProjectSurveyResultsView from "../views/ProjectSurveyResultsView.vue";
import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, mountPage, requests } from "./helpers";

const SURVEY_URL = `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`;

const VERSIONS = [
  {
    id: "Vq2k8LmN0pQr4StUv6WxY",
    number: 2,
    content: { blocks: [{ id: "q2", type: "scale", text: "Would you return?" }] },
    published_at: "2026-11-03T00:00:00Z",
  },
  {
    id: "Vq1k8LmN0pQr4StUv6WxY",
    number: 1,
    content: {
      blocks: [
        { id: "t1", type: "text", text: "Read the passage below." },
        { id: "q1", type: "scale", text: "How was it?" },
        { id: "q9", type: "scale", text: "Anything else?" },
      ],
    },
    published_at: "2026-11-02T00:00:00Z",
  },
];

const LATEST = {
  id: "Rk2k8LmN0pQr4StUv6WxY",
  version: 2,
  submitted_at: "2026-11-03T10:00:00Z",
  data: { q2: 4 },
};
const OLDER = {
  id: "Rk1k8LmN0pQr4StUv6WxY",
  version: 1,
  submitted_at: "2026-11-02T10:00:00Z",
  data: { q1: 2 },
};

async function mountView({ responses = [LATEST, OLDER], survey = jsonResponse(SURVEY) } = {}) {
  fetchMock.mockImplementation(async (input) => {
    const { pathname } = new URL((input as Request).url);
    if (pathname === `${SURVEY_URL}/responses`) return jsonResponse(responses);
    if (pathname === `${SURVEY_URL}/versions`) return jsonResponse(VERSIONS);
    return survey;
  });
  const { wrapper } = await mountPage(ProjectSurveyResultsView, {
    props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
  });
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountView>>;

function list(wrapper: Wrapper) {
  return wrapper.find('[aria-label="Responses"]');
}

function detail(wrapper: Wrapper) {
  return wrapper.find('[aria-label="Response"]');
}

async function open(wrapper: Wrapper, index: number) {
  await list(wrapper).findAll("button")[index]!.trigger("click");
  await flushPromises();
}

function pressedPoints(wrapper: Wrapper) {
  return detail(wrapper)
    .findAll('[data-slot="toggle-group"]')
    .map((scale) =>
      scale
        .findAll("button")
        .filter((point) => point.attributes("aria-pressed") === "true")
        .map((point) => point.text()),
    );
}

describe("Survey results view", () => {
  it("shows it's the survey's results page in the heading", async () => {
    const wrapper = await mountView();

    expect(requests().some((r) => new URL(r.url).pathname === SURVEY_URL)).toBe(true);
    expect(wrapper.find("h1").text()).toBe("Protein folding / Intake form / Results");
  });

  it("goes back to the survey's builder", async () => {
    const wrapper = await mountView();

    const back = wrapper.find("a");
    expect(back.text()).toBe("Back to Builder");
    expect(back.attributes("href")).toBe(`/project/${PROJECT_ID}/survey/${SURVEY.id}`);
    expect(back.find("svg[data-icon=inline-start]").exists()).toBe(true);
  });

  it("splits the page into two white panels", async () => {
    const wrapper = await mountView();

    const [left, right] = wrapper.findAll("section");
    expect(left!.element.contains(list(wrapper).element)).toBe(true);
    expect(right!.element.contains(detail(wrapper).element)).toBe(true);
    for (const panel of [list(wrapper), detail(wrapper)]) {
      expect(panel.classes()).toContain("bg-background");
      expect(panel.classes()).not.toContain("bg-muted");
    }
  });

  it("lists the responses with when they were sent and to which version", async () => {
    const wrapper = await mountView();

    const rows = list(wrapper).findAll("button");
    expect(rows.map((row) => row.text())).toEqual([
      `${new Date(LATEST.submitted_at).toLocaleString()}Version 2`,
      `${new Date(OLDER.submitted_at).toLocaleString()}Version 1`,
    ]);
    expect(rows.every((row) => row.attributes("aria-pressed") === "false")).toBe(true);
    expect(detail(wrapper).text()).toBe("Select a response to see its answers.");
  });

  it("shows a response's answers against its own version's questions", async () => {
    const wrapper = await mountView();

    await open(wrapper, 0);
    expect(list(wrapper).findAll("button")[0]!.attributes("aria-pressed")).toBe("true");
    expect(detail(wrapper).text()).toContain("Would you return?");
    expect(pressedPoints(wrapper)).toEqual([["4"]]);

    await open(wrapper, 1);
    expect(list(wrapper).findAll("button")[0]!.attributes("aria-pressed")).toBe("false");
    expect(detail(wrapper).text()).toContain(
      `Submitted ${new Date(OLDER.submitted_at).toLocaleString()} to version 1`,
    );
    expect(detail(wrapper).text()).not.toContain("Would you return?");
    const questions = detail(wrapper)
      .findAll("p.font-medium")
      .map((p) => p.text());
    expect(questions).toEqual(["How was it?", "Anything else?"]);
    expect(pressedPoints(wrapper)).toEqual([["2"], []]);
  });

  it("draws the response as the survey preview does, without a way to change it", async () => {
    const wrapper = await mountView();

    await open(wrapper, 1);

    const card = detail(wrapper).find('[data-slot="card"]');
    expect(card.find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(card.text()).toContain("Read the passage below.");
    const points = detail(wrapper).findAll('[data-slot="toggle-group-item"]');
    expect(points.every((point) => point.attributes("disabled") !== undefined)).toBe(true);
    expect(detail(wrapper).findAll("button")).toHaveLength(points.length);
  });

  it("says when there are no responses yet", async () => {
    const wrapper = await mountView({ responses: [] });

    expect(list(wrapper).text()).toBe("No responses yet.");
  });

  it("says when the survey can't be found", async () => {
    const wrapper = await mountView({
      survey: jsonResponse({ detail: "Survey not found" }, 404),
    });

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.text()).toContain("This survey couldn't be found.");
    expect(wrapper.find("section").exists()).toBe(false);
  });
});
