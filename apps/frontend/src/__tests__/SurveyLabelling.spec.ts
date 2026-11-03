import { describe, it, expect } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";
import { flushPromises, type DOMWrapper, type VueWrapper } from "@vue/test-utils";

import type { LabelBlock } from "../lib/survey-blocks";
import ProjectSurveyResultsView from "../views/ProjectSurveyResultsView.vue";
import PublicSurveyView from "../views/PublicSurveyView.vue";
import { AXIS } from "./dataset-view";
import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, mountPage, request } from "./helpers";

const PUBLIC_ID = "Jx2k8LmN0pQr4StUv6WxY";
const VERSION_ID = "Vq1k8LmN0pQr4StUv6WxY";
const CELLS = { dtype: "f4", bdata: "AAAAAAAAgD8AAABAAABAQA==", shape: "2, 2" };
const GRID = { layout: "grid", axes: ["x", "y"], x: AXIS, y: AXIS, channels: [CELLS] };

const BLOCK: LabelBlock = {
  id: "l1",
  type: "label",
  text: "Paint the defects",
  appearance: "blank",
  source: { dataset_id: "Eq-OvCTLPC6Urz_TXE8eJ", node_id: "grid", channels: [0] },
  labels: [
    { id: "defect", name: "Defect", color: "#e11d48" },
    { id: "clean", name: "Clean", color: "#2563eb" },
  ],
  tools: ["point", "lasso", "brush"],
};

function answerWith(block: LabelBlock) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === "POST") return jsonResponse({ id: "r1", submitted_at: "" }, 201);
    return new URL(request.url).pathname.endsWith("/charts/l1")
      ? jsonResponse(GRID)
      : jsonResponse({
          name: "Intake form",
          version_id: VERSION_ID,
          content: { blocks: [block, { id: "e1", type: "end" }] },
        });
  });
}

function placeOnScreen(wrapper: VueWrapper) {
  const plot = wrapper.find('[role="img"]').element as HTMLElement & { _fullLayout?: object };
  plot._fullLayout = {
    xaxis: { _offset: 0, l2p: (value: number) => value * 100 },
    yaxis: { _offset: 0, l2p: (value: number) => 100 - value * 100 },
  };
}

async function mountSurvey(block: LabelBlock = BLOCK) {
  answerWith(block);
  const { wrapper } = await mountPage(PublicSurveyView, {
    props: { publicId: PUBLIC_ID },
    queryClient: new QueryClient(),
  });
  await flushPromises();
  placeOnScreen(wrapper);
  return wrapper;
}

async function pointer(canvas: DOMWrapper<Element>, type: string, x: number, y: number) {
  canvas.element.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }));
  await flushPromises();
}

async function drag(wrapper: VueWrapper, path: [number, number][]) {
  const canvas = wrapper.find("canvas");
  const [[x, y], ...rest] = path as [[number, number], ...[number, number][]];
  await pointer(canvas, "pointerdown", x, y);
  for (const [nextX, nextY] of rest) await pointer(canvas, "pointermove", nextX, nextY);
  await pointer(canvas, "pointerup", 0, 0);
}

async function choose(wrapper: VueWrapper, name: string) {
  const button = wrapper
    .findAll("button")
    .find((button) => button.text() === name || button.attributes("aria-label") === name)!;
  await button.trigger("click");
}

async function submitted(wrapper: VueWrapper) {
  await choose(wrapper, "Submit");
  await flushPromises();
  return (await request("POST").json()).data;
}

describe("Labelling a chart", () => {
  it("asks the question above the chart, with the labels, an eraser and the tools", async () => {
    const wrapper = await mountSurvey();

    expect(wrapper.find("figure p").text()).toBe("Paint the defects");
    const labels = wrapper.find('[aria-label="Labels"]').findAll("button");
    expect(labels.map((label) => label.text())).toEqual(["Defect", "Clean", "Eraser"]);
    expect(labels[0]!.attributes("aria-pressed")).toBe("true");
    const tools = wrapper.find('[aria-label="Tools"]').findAll("button");
    expect(tools.map((tool) => tool.attributes("aria-label"))).toEqual(["Point", "Lasso", "Brush"]);
    expect(tools[0]!.attributes("aria-pressed")).toBe("true");
  });

  it("only offers the tools the author chose", async () => {
    const wrapper = await mountSurvey({ ...BLOCK, tools: ["lasso"] });

    expect(wrapper.find('[aria-label="Tools"]').exists()).toBe(false);
    await drag(wrapper, [
      [-10, -10],
      [50, -10],
      [50, 50],
      [-10, 50],
    ]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [2] } });
  });

  it("labels the point nearest a click, with as many labels as it is given", async () => {
    const wrapper = await mountSurvey();

    await drag(wrapper, [[98, 3]]);
    await choose(wrapper, "Clean");
    await drag(wrapper, [[97, 2]]);
    await drag(wrapper, [[2, 98]]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [3], clean: [0, 3] } });
  });

  it("labels every point inside a lasso", async () => {
    const wrapper = await mountSurvey();
    await choose(wrapper, "Lasso");

    await drag(wrapper, [
      [-10, -10],
      [50, -10],
      [50, 110],
      [-10, 110],
    ]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [0, 2] } });
  });

  it("labels every point the brush passes over", async () => {
    const wrapper = await mountSurvey();
    await choose(wrapper, "Brush");

    await drag(wrapper, [
      [0, 100],
      [50, 100],
      [100, 100],
    ]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [0, 1] } });
  });

  it("erases every label from the points it touches", async () => {
    const wrapper = await mountSurvey();
    await drag(wrapper, [[0, 100]]);
    await drag(wrapper, [[100, 100]]);
    await choose(wrapper, "Clean");
    await drag(wrapper, [[0, 100]]);

    await choose(wrapper, "Eraser");
    await drag(wrapper, [[0, 100]]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [1] } });
  });

  it("leaves the answer out when nothing is labelled", async () => {
    const wrapper = await mountSurvey();
    await drag(wrapper, [[0, 100]]);
    await choose(wrapper, "Eraser");
    await drag(wrapper, [[0, 100]]);

    expect(await submitted(wrapper)).toEqual({});
  });

  it("shows the owner a response's labels without the tools", async () => {
    const SURVEY_URL = `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`;
    const version = { id: VERSION_ID, number: 1, content: { blocks: [BLOCK] }, published_at: "" };
    const response = {
      id: "r1",
      version: 1,
      submitted_at: "2026-11-02T10:00:00Z",
      data: { l1: { defect: [0, 3], clean: [3] } },
    };
    fetchMock.mockImplementation(async (input) => {
      const { pathname } = new URL((input as Request).url);
      if (pathname === `${SURVEY_URL}/responses`) return jsonResponse([response]);
      if (pathname === `${SURVEY_URL}/versions`) return jsonResponse([version]);
      if (pathname.endsWith("/charts/l1")) return jsonResponse(GRID);
      return jsonResponse(SURVEY);
    });
    const { wrapper } = await mountPage(ProjectSurveyResultsView, {
      props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
    });

    await wrapper.find('[aria-label="Responses"] button').trigger("click");
    await flushPromises();

    const shown = wrapper.find('[aria-label="Response"]');
    const legend = shown.find('ul[aria-label="Labels"]');
    expect(legend.findAll("li").map((item) => item.text())).toEqual(["Defect 2", "Clean 1"]);
    expect(shown.find('[aria-label="Tools"]').exists()).toBe(false);
    expect(shown.find("canvas").classes()).toContain("pointer-events-none");
  });
});
