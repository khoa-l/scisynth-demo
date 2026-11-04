import { describe, it, expect, vi } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";
import { flushPromises, type DOMWrapper, type VueWrapper } from "@vue/test-utils";
import Plotly from "plotly.js-cartesian-dist-min";

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

function placeOnScreen(wrapper: VueWrapper, scale = 100) {
  const plot = wrapper.find('[role="img"]').element as HTMLElement & { _fullLayout?: object };
  plot._fullLayout = {
    xaxis: { _offset: 0, l2p: (value: number) => value * scale },
    yaxis: { _offset: 0, l2p: (value: number) => 100 - value * scale },
  };
}

function recordDrawing() {
  const fillRect = vi.fn();
  const context = {
    scale: vi.fn(),
    fillRect,
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  return fillRect;
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

async function pickLabel(wrapper: VueWrapper, id: string) {
  await wrapper.find('select[aria-label="Label"]').setValue(id);
}

async function submitted(wrapper: VueWrapper) {
  await choose(wrapper, "Submit");
  await flushPromises();
  return (await request("POST").json()).data;
}

describe("Labeling a chart", () => {
  it("asks the question above the chart, with a dropdown of labels, an eraser and the tools", async () => {
    const wrapper = await mountSurvey();

    expect(wrapper.find("figure p").text()).toBe("Paint the defects");
    const select = wrapper.find('select[aria-label="Label"]');
    expect(select.findAll("option").map((option) => option.text())).toEqual(["Defect", "Clean"]);
    expect((select.element as HTMLSelectElement).value).toBe("defect");
    const eraser = wrapper.findAll("button").find((button) => button.text() === "Eraser")!;
    expect(eraser.attributes("aria-pressed")).toBe("false");
    const tools = wrapper.find('[aria-label="Tools"]').findAll("button");
    expect(tools.map((tool) => tool.attributes("aria-label"))).toEqual(["Point", "Lasso", "Brush"]);
    expect(tools[0]!.attributes("aria-pressed")).toBe("true");
    const navigation = wrapper.find('[aria-label="Navigation"]').findAll("button");
    expect(navigation.map((button) => button.attributes("aria-label"))).toEqual([
      "Move",
      "Zoom",
      "Reset view",
    ]);
  });

  it("names a single label instead of offering a dropdown", async () => {
    const wrapper = await mountSurvey({ ...BLOCK, labels: [BLOCK.labels[0]!] });

    expect(wrapper.find("select").exists()).toBe(false);
    expect(wrapper.find("figure").text()).toContain("Defect");
    await drag(wrapper, [[0, 100]]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [0] } });
  });

  it("only offers the tools the author chose", async () => {
    const wrapper = await mountSurvey({ ...BLOCK, tools: ["lasso"] });

    const tools = wrapper.find('[aria-label="Tools"]').findAll("button");
    expect(tools.map((tool) => tool.attributes("aria-label"))).toEqual(["Lasso"]);
    await drag(wrapper, [
      [-10, -10],
      [50, -10],
      [50, 50],
      [-10, 50],
    ]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [2] } });
  });

  it("labels the point nearest a click, replacing any label it had", async () => {
    const wrapper = await mountSurvey();

    await drag(wrapper, [[98, 3]]);
    await pickLabel(wrapper, "clean");
    await drag(wrapper, [[97, 2]]);
    await drag(wrapper, [[2, 98]]);

    expect(await submitted(wrapper)).toEqual({ l1: { clean: [0, 3] } });
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
    await pickLabel(wrapper, "clean");
    await drag(wrapper, [[0, 100]]);

    await choose(wrapper, "Eraser");
    await drag(wrapper, [[0, 100]]);

    expect(await submitted(wrapper)).toEqual({ l1: { defect: [1] } });
  });

  it("goes back to labeling when a label is picked while erasing", async () => {
    const wrapper = await mountSurvey();
    await choose(wrapper, "Eraser");

    await pickLabel(wrapper, "clean");
    await drag(wrapper, [[0, 100]]);

    const eraser = wrapper.findAll("button").find((button) => button.text() === "Eraser")!;
    expect(eraser.attributes("aria-pressed")).toBe("false");
    expect(await submitted(wrapper)).toEqual({ l1: { clean: [0] } });
  });

  it("leaves the answer out when nothing is labelled", async () => {
    const wrapper = await mountSurvey();
    await drag(wrapper, [[0, 100]]);
    await choose(wrapper, "Eraser");
    await drag(wrapper, [[0, 100]]);

    expect(await submitted(wrapper)).toEqual({});
  });

  it("hides the labels to show the points underneath, still labeling", async () => {
    const fillRect = recordDrawing();
    const wrapper = await mountSurvey();

    await drag(wrapper, [[0, 100]]);
    expect(fillRect).toHaveBeenLastCalledWith(-50, 50, 100, 100);
    fillRect.mockClear();

    await choose(wrapper, "Hide labels");
    await flushPromises();
    await drag(wrapper, [[100, 100]]);

    const hide = wrapper.find('[aria-label="Hide labels"]');
    expect(hide.attributes("aria-pressed")).toBe("true");
    expect(fillRect).not.toHaveBeenCalled();
    expect(await submitted(wrapper)).toEqual({ l1: { defect: [0, 1] } });
  });

  it("moves and zooms the chart with plotly instead of labeling", async () => {
    const relayout = vi.mocked(Plotly.relayout);
    const wrapper = await mountSurvey();
    const plot = wrapper.find('[role="img"]').element;
    const [, , layout, config] = vi.mocked(Plotly.react).mock.lastCall!;
    expect(layout).toMatchObject({ uirevision: "navigable" });
    expect(config).toMatchObject({ scrollZoom: true, displayModeBar: false });

    await choose(wrapper, "Move");
    await flushPromises();
    expect(relayout).toHaveBeenLastCalledWith(plot, { dragmode: "pan" });
    expect(wrapper.find("canvas").classes()).toContain("pointer-events-none");
    await drag(wrapper, [[0, 100]]);

    await choose(wrapper, "Zoom");
    await flushPromises();
    expect(relayout).toHaveBeenLastCalledWith(plot, { dragmode: "zoom" });

    await choose(wrapper, "Reset view");
    await flushPromises();
    expect(relayout).toHaveBeenLastCalledWith(plot, {
      "xaxis.autorange": true,
      "yaxis.autorange": true,
    });

    await choose(wrapper, "Point");
    await flushPromises();
    expect(relayout).toHaveBeenLastCalledWith(plot, { dragmode: false });
    expect(await submitted(wrapper)).toEqual({});
  });

  it("goes back to the last labeling tool when the eraser is picked while moving", async () => {
    const relayout = vi.mocked(Plotly.relayout);
    const wrapper = await mountSurvey();
    const pressed = (label: string) =>
      wrapper.find(`[aria-label="${label}"]`).attributes("aria-pressed");
    await drag(wrapper, [[0, 100]]);
    await choose(wrapper, "Lasso");

    await choose(wrapper, "Move");
    await choose(wrapper, "Eraser");
    await flushPromises();

    expect([pressed("Move"), pressed("Lasso")]).toEqual(["false", "true"]);
    expect(relayout).toHaveBeenLastCalledWith(wrapper.find('[role="img"]').element, {
      dragmode: false,
    });

    await choose(wrapper, "Zoom");
    const eraser = wrapper.findAll("button").find((button) => button.text() === "Eraser")!;
    expect(eraser.attributes("aria-pressed")).toBe("false");

    await choose(wrapper, "Eraser");
    await drag(wrapper, [
      [-10, 90],
      [10, 90],
      [10, 110],
      [-10, 110],
    ]);
    expect(await submitted(wrapper)).toEqual({});
  });

  it("draws the labels again where the chart has moved to", async () => {
    const listeners = new Map<string, () => void>();
    vi.mocked(Plotly.react).mockImplementationOnce(async (element) => {
      Object.assign(element as object, {
        on: (event: string, listener: () => void) => listeners.set(event, listener),
      });
      return element as never;
    });
    const fillRect = recordDrawing();
    const wrapper = await mountSurvey();
    await drag(wrapper, [[0, 100]]);
    fillRect.mockClear();

    placeOnScreen(wrapper, 50);
    listeners.get("plotly_relayout")!();

    expect(fillRect).toHaveBeenLastCalledWith(-25, 75, 50, 50);
    expect(listeners.has("plotly_relayouting")).toBe(true);
  });

  it("shows the owner a response's labels, to move around but not change", async () => {
    const SURVEY_URL = `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`;
    const version = { id: VERSION_ID, number: 1, content: { blocks: [BLOCK] }, published_at: "" };
    const response = {
      id: "r1",
      version: 1,
      submitted_at: "2026-11-02T10:00:00Z",
      data: { l1: { defect: [0], clean: [3] } },
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
    expect(legend.findAll("li").map((item) => item.text())).toEqual(["Defect 1", "Clean 1"]);
    expect(shown.find('[aria-label="Tools"]').exists()).toBe(false);
    const move = shown.find('[aria-label="Navigation"] [aria-label="Move"]');
    expect(move.attributes("aria-pressed")).toBe("true");
    expect(shown.find('[aria-label="Hide labels"]').exists()).toBe(true);
    expect(shown.find("canvas").classes()).toContain("pointer-events-none");
  });
});
