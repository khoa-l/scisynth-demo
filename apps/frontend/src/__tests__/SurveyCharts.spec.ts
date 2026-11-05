import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";
import { flushPromises } from "@vue/test-utils";
import type { PlotData } from "plotly.js";
import Plotly from "plotly.js-dist-min";

import type { DatasetPublic } from "../client";
import type { ChartBlock, ChartSource, LabelBlock, SurveyBlock } from "../lib/survey-blocks";
import ProjectSurveyResultsView from "../views/ProjectSurveyResultsView.vue";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import PublicSurveyView from "../views/PublicSurveyView.vue";
import { AXIS } from "./dataset-view";
import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, mountPage, requests } from "./helpers";
import { preview } from "./survey-view";

const FIRST = { dtype: "f4", bdata: "AAAAAAAAgD8AAABAAABAQA==", shape: "2, 2" };
const SECOND = { ...FIRST, bdata: "AACAQAAAoEAAAMBAAADgQA==" };
const PREVIEW = { layout: "grid", axes: ["x", "y"], x: AXIS, y: AXIS, channels: [FIRST, SECOND] };

const node = (id: string, kind: string) => ({
  id,
  kind,
  params: {},
  position: { x: 0, y: 0 },
  preview_hidden: false,
});

const DATASET: DatasetPublic = {
  id: "Eq-OvCTLPC6Urz_TXE8eJ",
  name: "Raw reads",
  created_at: "2026-11-02T00:00:00Z",
  content: {
    version: 1,
    nodes: [
      node("field", "GaussianField"),
      node("grid", "GridSampler"),
      node("other", "GaussianField"),
    ],
    edges: [],
  },
};

const SOURCE: ChartSource = { dataset_id: DATASET.id, node_id: "grid", channels: [0] };

function chart(changes: Partial<ChartBlock> = {}): ChartBlock {
  return { id: "c1", type: "chart", text: "", appearance: "shown", source: SOURCE, ...changes };
}

function labeling(changes: Partial<LabelBlock> = {}): LabelBlock {
  return {
    id: "l1",
    type: "label",
    text: "",
    appearance: "blank",
    source: SOURCE,
    labels: [{ id: "defect", name: "Defect", color: "#e11d48" }],
    tools: ["point", "lasso", "brush"],
    ...changes,
  };
}

const react = vi.mocked(Plotly.react);

afterEach(() => {
  react.mockClear();
});

function answerAsTheServer(survey: object) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const { pathname } = new URL(request.url);
    if (pathname === "/api/previews/nodes") return jsonResponse(PREVIEW);
    if (pathname === `/api/projects/${PROJECT_ID}/datasets`) return jsonResponse([DATASET]);
    if (pathname === `/api/projects/${PROJECT_ID}/datasets/${DATASET.id}`) {
      return jsonResponse(DATASET);
    }
    if (request.method === "PATCH") {
      return jsonResponse({ ...survey, ...(await request.clone().json()) });
    }
    return jsonResponse(survey);
  });
}

async function mountBuilder(block: SurveyBlock) {
  answerAsTheServer({ ...SURVEY, content: { blocks: [block] } });
  const { wrapper } = await mountPage(ProjectSurveyView, {
    props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
  });
  return wrapper;
}

function row(wrapper: Awaited<ReturnType<typeof mountBuilder>>) {
  return wrapper.find('[aria-label="Survey builder"] li');
}

async function openData(wrapper: Awaited<ReturnType<typeof mountBuilder>>) {
  await row(wrapper).find('[data-slot="select-trigger"]').trigger("keydown", { key: "Enter" });
  await flushPromises();
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')];
}

async function savedBlocks() {
  const patches = requests().filter((r) => r.method === "PATCH");
  return (await patches[patches.length - 1]!.clone().json()).content.blocks;
}

function drawn(element: Element) {
  const call = react.mock.calls.filter(([target]) => target === element).at(-1);
  return call?.[1][0] as PlotData | undefined;
}

describe("Chart blocks", () => {
  describe("in the builder", () => {
    it("offers each dataset's nodes and saves the chosen one with its first channel", async () => {
      const wrapper = await mountBuilder(chart({ source: null }));

      const trigger = row(wrapper).find('[data-slot="select-trigger"]');
      expect(trigger.text()).toBe("Choose a node from a dataset…");
      const options = await openData(wrapper);
      const groups = document.querySelectorAll('[data-slot="select-label"]');
      expect([...groups].map((group) => group.textContent?.trim())).toEqual(["Raw reads"]);
      expect(options.map((option) => option.textContent?.trim())).toEqual([
        "Gaussian field",
        "Grid sampler",
        "Gaussian field 2",
      ]);

      options[1]!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await flushPromises();

      expect((await savedBlocks())[0].source).toEqual(SOURCE);
      expect(trigger.text()).toBe("Raw reads / Grid sampler");
    });

    it("lets the author pick the channels to show, but not none", async () => {
      const wrapper = await mountBuilder(chart());
      const channel = (n: number) => row(wrapper).find(`[aria-label="Channel ${n}"]`);
      expect(channel(1).attributes("aria-pressed")).toBe("true");
      expect(channel(2).attributes("aria-pressed")).toBe("false");

      await channel(2).trigger("click");
      await flushPromises();
      expect((await savedBlocks())[0].source.channels).toEqual([0, 1]);

      await channel(1).trigger("click");
      await flushPromises();
      expect((await savedBlocks())[0].source.channels).toEqual([1]);
      const saves = requests().filter((r) => r.method === "PATCH").length;

      await channel(2).trigger("click");
      await flushPromises();
      expect(requests().filter((r) => r.method === "PATCH")).toHaveLength(saves);
    });

    it("shows a chart with its data or blanked out", async () => {
      const wrapper = await mountBuilder(chart());
      const blank = row(wrapper)
        .findAll("button")
        .find((button) => button.text() === "Blank")!;
      await blank.trigger("click");
      await flushPromises();

      expect((await savedBlocks())[0].appearance).toBe("blank");
    });

    it("saves a caption", async () => {
      const wrapper = await mountBuilder(chart());

      const caption = row(wrapper).find('input[aria-label="Caption"]');
      await caption.setValue("Where are the defects?");
      await caption.trigger("change");
      await flushPromises();

      expect((await savedBlocks())[0].text).toBe("Where are the defects?");
    });
  });

  describe("in the preview", () => {
    it("draws the chosen channels of the live data like the dataset view", async () => {
      const wrapper = await mountBuilder(chart({ source: { ...SOURCE, channels: [1] } }));

      const plot = preview(wrapper).find('[role="img"]');
      expect(plot.attributes("aria-label")).toBe("Chart");
      expect(drawn(plot.element)).toMatchObject({
        type: "heatmap",
        z: SECOND,
        colorscale: "Viridis",
        showscale: true,
      });
      expect(preview(wrapper).find('[aria-label="Next channel"]').exists()).toBe(false);
    });

    it("draws a blank chart in plain grey", async () => {
      const wrapper = await mountBuilder(chart({ appearance: "blank", text: "Paint this" }));

      const plot = preview(wrapper).find('[role="img"]');
      expect(drawn(plot.element)).toMatchObject({
        colorscale: [
          [0, "#a3a3a3"],
          [1, "#a3a3a3"],
        ],
        showscale: false,
      });
      expect(preview(wrapper).find("figcaption").text()).toBe("Paint this");
    });

    it("leaves out a chart that has no data chosen yet", async () => {
      const wrapper = await mountBuilder(chart({ source: null }));

      expect(preview(wrapper).text()).toContain("This survey has no questions yet.");
      expect(preview(wrapper).find('[role="img"]').exists()).toBe(false);
    });
  });

  it("shows respondents the chart frozen when the survey was published", async () => {
    const VERSION_ID = "Vq1k8LmN0pQr4StUv6WxY";
    const PUBLIC_ID = "Jx2k8LmN0pQr4StUv6WxY";
    fetchMock.mockImplementation(async (input) =>
      new URL((input as Request).url).pathname.endsWith("/charts/c1")
        ? jsonResponse({ ...PREVIEW, channels: [SECOND] })
        : jsonResponse({
            name: "Intake form",
            version_id: VERSION_ID,
            content: { blocks: [chart({ source: null, has_chart: true })] },
          }),
    );

    const { wrapper } = await mountPage(PublicSurveyView, {
      props: { publicId: PUBLIC_ID },
      queryClient: new QueryClient(),
    });
    await flushPromises();

    expect(requests().map((r) => new URL(r.url).pathname)).toEqual([
      `/api/public/surveys/${PUBLIC_ID}`,
      `/api/public/surveys/${PUBLIC_ID}/versions/${VERSION_ID}/charts/c1`,
    ]);
    expect(drawn(wrapper.find('[role="img"]').element)).toMatchObject({ z: SECOND });
  });

  describe("in the results", () => {
    const SURVEY_URL = `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`;
    const RESPONSE = { id: "R1", version: 1, submitted_at: "2026-11-02T10:00:00Z", data: {} };

    async function mountResults(block: ChartBlock) {
      const version = {
        id: "Vq1k8LmN0pQr4StUv6WxY",
        number: 1,
        content: { blocks: [block] },
        published_at: "2026-11-02T00:00:00Z",
      };
      fetchMock.mockImplementation(async (input) => {
        const { pathname } = new URL((input as Request).url);
        if (pathname === `${SURVEY_URL}/responses`) return jsonResponse([RESPONSE]);
        if (pathname === `${SURVEY_URL}/versions`) return jsonResponse([version]);
        if (pathname.endsWith("/charts/c1")) {
          return jsonResponse({ ...PREVIEW, channels: [FIRST] });
        }
        return jsonResponse(SURVEY);
      });
      const { wrapper } = await mountPage(ProjectSurveyResultsView, {
        props: { projectId: PROJECT_ID, surveyId: SURVEY.id },
      });
      await wrapper.find('[aria-label="Responses"] button').trigger("click");
      await flushPromises();
      return { wrapper, version };
    }

    function showData(wrapper: Awaited<ReturnType<typeof mountResults>>["wrapper"]) {
      return wrapper.findAll("button").find((button) => button.text() === "Show data");
    }

    it("shows the owner the chart frozen with the version a response answered", async () => {
      const { wrapper, version } = await mountResults(chart());

      expect(requests().map((r) => new URL(r.url).pathname)).toContain(
        `${SURVEY_URL}/versions/${version.id}/charts/c1`,
      );
      const plot = wrapper.find('[aria-label="Response"] [role="img"]');
      expect(drawn(plot.element)).toMatchObject({ z: FIRST });
      expect(showData(wrapper)).toBeUndefined();
    });

    it("shows a blank chart as respondents saw it until the owner shows its data", async () => {
      const { wrapper } = await mountResults(chart({ appearance: "blank" }));
      const plot = wrapper.find('[aria-label="Response"] [role="img"]');
      expect(drawn(plot.element)).toMatchObject({ showscale: false });

      await showData(wrapper)!.trigger("click");
      await flushPromises();

      expect(showData(wrapper)!.attributes("aria-pressed")).toBe("true");
      expect(drawn(plot.element)).toMatchObject({ z: FIRST, colorscale: "Viridis" });
    });
  });

  describe("Labeling in the builder", () => {
    function labelRows(wrapper: Awaited<ReturnType<typeof mountBuilder>>) {
      return row(wrapper).findAll('[aria-label="Labels"] li');
    }

    it("asks for an instruction, the chart and the labels", async () => {
      const wrapper = await mountBuilder(labeling());

      expect(row(wrapper).find('[data-slot="block-title"]').text()).toBe("Labeling");
      expect(row(wrapper).find('input[aria-label="Instruction"]').exists()).toBe(true);
      expect(row(wrapper).find('[data-slot="select-trigger"]').text()).toBe(
        "Raw reads / Grid sampler",
      );
      const [only] = labelRows(wrapper);
      expect((only!.find('input[type="color"]').element as HTMLInputElement).value).toBe("#e11d48");
      expect(
        (only!.find('input[aria-label="Name of Defect"]').element as HTMLInputElement).value,
      ).toBe("Defect");
      expect(only!.find('[aria-label="Remove Defect"]').attributes("disabled")).toBeDefined();
    });

    it("adds, renames, recolors and removes labels", async () => {
      const wrapper = await mountBuilder(labeling());

      const add = row(wrapper)
        .findAll("button")
        .find((button) => button.text() === "Add label")!;
      await add.trigger("click");
      await flushPromises();
      const added = (await savedBlocks())[0].labels[1];
      expect(added).toEqual({ id: expect.any(String), name: "Label 2", color: "#2563eb" });

      const name = labelRows(wrapper)[1]!.find('input[aria-label="Name of Label 2"]');
      await name.setValue("Clean");
      await name.trigger("change");
      await flushPromises();
      expect((await savedBlocks())[0].labels[1].name).toBe("Clean");

      const color = labelRows(wrapper)[1]!.find('input[type="color"]');
      await color.setValue("#000000");
      await color.trigger("change");
      await flushPromises();
      expect((await savedBlocks())[0].labels[1].color).toBe("#000000");

      await labelRows(wrapper)[0]!.find('[aria-label="Remove Defect"]').trigger("click");
      await flushPromises();
      expect((await savedBlocks())[0].labels).toEqual([
        { id: added.id, name: "Clean", color: "#000000" },
      ]);
    });

    it("keeps a label's name when it is cleared", async () => {
      const wrapper = await mountBuilder(labeling());

      const name = labelRows(wrapper)[0]!.find("input:not([type=color])");
      await name.setValue("  ");
      await name.trigger("change");
      await flushPromises();

      expect((name.element as HTMLInputElement).value).toBe("Defect");
      expect(requests().some((r) => r.method === "PATCH")).toBe(false);
    });

    it("chooses the tools respondents get, but not none", async () => {
      const wrapper = await mountBuilder(labeling({ tools: ["point"] }));
      const tool = (name: string) =>
        row(wrapper)
          .findAll("button")
          .find((button) => button.text() === name)!;

      await tool("Lasso").trigger("click");
      await flushPromises();
      expect((await savedBlocks())[0].tools).toEqual(["point", "lasso"]);
      const saves = requests().filter((r) => r.method === "PATCH").length;

      await tool("Point").trigger("click");
      await tool("Lasso").trigger("click");
      await flushPromises();
      expect((await savedBlocks())[0].tools).toEqual(["lasso"]);
      expect(requests().filter((r) => r.method === "PATCH")).toHaveLength(saves + 1);
    });
  });
});
