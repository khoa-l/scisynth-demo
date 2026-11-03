import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import { flushPromises, type DOMWrapper } from "@vue/test-utils";
import type { PlotData } from "plotly.js";
import Plotly from "plotly.js-cartesian-dist-min";

import { AXIS, connect, dropKind, enter, mountView } from "./dataset-view";
import { DATASET, fetchMock, jsonResponse, requests } from "./helpers";

const CHANNEL = { dtype: "f4", bdata: "AAAAAAAAgD8AAABAAABAQA==", shape: "2, 2" };
const SECOND_CHANNEL = { ...CHANNEL, bdata: "AACAQAAAoEAAAMBAAADgQA==" };
const PREVIEW = { layout: "grid", x: AXIS, y: AXIS, channels: [CHANNEL] };
const FIELD_PARAMS = {
  length_scale: 0.1,
  amplitude: 1,
  mean: 0,
  resolution: 128,
  order: 1,
  seed: 0,
};

const react = vi.mocked(Plotly.react);

afterEach(() => {
  vi.useRealTimers();
  react.mockClear();
});

function answerPreviews(preview: () => Response) {
  fetchMock.mockImplementation(async (input) =>
    new URL((input as Request).url).pathname === "/api/previews/nodes"
      ? preview()
      : jsonResponse(DATASET),
  );
}

function previews() {
  return requests().filter((r) => new URL(r.url).pathname === "/api/previews/nodes");
}

function thumbnail(node: DOMWrapper<Element>) {
  return node.find('[role="img"]');
}

describe("Dataset node thumbnail", () => {
  it("draws a static heatmap of a Gaussian field above its node", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));

    const field = await dropKind(wrapper, "GaussianField");
    await flushPromises();

    expect(await previews()[0]!.json()).toEqual({
      node: field.attributes("data-id"),
      nodes: [{ id: field.attributes("data-id"), kind: "GaussianField", params: FIELD_PARAMS }],
      edges: [],
    });
    expect(thumbnail(field).attributes("aria-label")).toBe("Preview of Gaussian field");
    expect(thumbnail(field).classes()).toEqual(expect.arrayContaining(["aspect-square"]));
    expect([...thumbnail(field).element.parentElement!.classList]).toEqual(
      expect.arrayContaining(["absolute", "-inset-x-px", "bottom-full"]),
    );
    expect(field.find('[aria-label="Next channel"]').exists()).toBe(false);
    expect(react).toHaveBeenCalledWith(
      thumbnail(field).element,
      [
        {
          type: "heatmap",
          x: AXIS,
          y: AXIS,
          z: CHANNEL,
          colorscale: "Viridis",
          showscale: false,
        },
      ],
      {
        margin: { t: 0, r: 0, b: 0, l: 0 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
      },
      { staticPlot: true },
    );
  });

  it("previews a composite once enough terms are connected", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const sum = await dropKind(wrapper, "Sum");
    const first = await dropKind(wrapper, "GaussianField");
    const second = await dropKind(wrapper, "GaussianField");
    const requested = () => Promise.all(previews().map((r) => r.clone().json()));

    expect(thumbnail(sum).exists()).toBe(false);
    await connect(wrapper, first, sum, "terms");
    expect(thumbnail(sum).exists()).toBe(false);
    expect((await requested()).some((body) => body.node === sum.attributes("data-id"))).toBe(false);

    await connect(wrapper, second, sum, "terms");
    await flushPromises();

    expect(thumbnail(sum).attributes("aria-label")).toBe("Preview of Sum");
    const body = (await requested()).find((b) => b.node === sum.attributes("data-id"))!;
    expect(body.nodes.map((n: { kind: string }) => n.kind).sort()).toEqual([
      "GaussianField",
      "GaussianField",
      "Sum",
    ]);
    expect(body.edges).toHaveLength(2);
    expect(body.nodes.every((n: object) => !("position" in n))).toBe(true);
  });

  it("steps through a Multichannel's channels with the arrows above its preview", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse({ ...PREVIEW, channels: [CHANNEL, SECOND_CHANNEL] }));
    const channels = await dropKind(wrapper, "Multichannel");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), channels, "channels");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), channels, "channels");
    await flushPromises();
    const previous = channels.find('[aria-label="Previous channel"]');
    const next = channels.find('[aria-label="Next channel"]');
    const shownChannel = () => (react.mock.lastCall![1][0] as PlotData).z;

    expect(previous.element.parentElement!.textContent!.trim()).toBe("Channel 1");
    expect(previous.attributes("disabled")).toBeDefined();
    expect(shownChannel()).toEqual(CHANNEL);

    await next.trigger("click");
    await flushPromises();

    expect(previous.element.parentElement!.textContent!.trim()).toBe("Channel 2");
    expect(next.attributes("disabled")).toBeDefined();
    expect(previous.attributes("disabled")).toBeUndefined();
    expect(shownChannel()).toEqual(SECOND_CHANNEL);
  });

  it("previews a Multichannel from a single channel", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const channels = await dropKind(wrapper, "Multichannel");
    expect(thumbnail(channels).exists()).toBe(false);

    await connect(wrapper, await dropKind(wrapper, "GaussianField"), channels, "channels");
    await flushPromises();

    expect(thumbnail(channels).exists()).toBe(true);
  });

  it("previews a sampler once a latent is connected to it", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const sampler = await dropKind(wrapper, "GridSampler");
    await flushPromises();
    expect(thumbnail(sampler).exists()).toBe(false);

    await connect(wrapper, await dropKind(wrapper, "GaussianField"), sampler, "latent");
    await flushPromises();

    expect(thumbnail(sampler).attributes("aria-label")).toBe("Preview of Grid sampler");
    const bodies = await Promise.all(previews().map((r) => r.clone().json()));
    const body = bodies.find((b) => b.node === sampler.attributes("data-id"))!;
    expect(body.nodes.map((n: { kind: string }) => n.kind).sort()).toEqual([
      "GaussianField",
      "GridSampler",
    ]);
  });

  it("offers the channel arrows on a sampler of a Multichannel", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse({ ...PREVIEW, channels: [CHANNEL, SECOND_CHANNEL] }));
    const channels = await dropKind(wrapper, "Multichannel");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), channels, "channels");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), channels, "channels");
    const sampler = await dropKind(wrapper, "GridSampler");

    await connect(wrapper, channels, sampler, "latent");
    await flushPromises();
    await sampler.find('[aria-label="Next channel"]').trigger("click");
    await flushPromises();

    expect(sampler.find('[aria-live="polite"]').text()).toBe("Channel 2");
    const [element, [trace]] = react.mock.lastCall!;
    expect(element).toBe(thumbnail(sampler).element);
    expect((trace as PlotData).z).toEqual(SECOND_CHANNEL);
  });

  it("draws a point sampler's preview as a coloured scatter", async () => {
    const wrapper = await mountView();
    const points = { ...AXIS, bdata: "AAAAAAAAAD8AAIA/", shape: "3" };
    answerPreviews(() =>
      jsonResponse({ layout: "points", x: points, y: points, channels: [points] }),
    );
    const sampler = await dropKind(wrapper, "PointSampler");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), sampler, "latent");
    await flushPromises();

    const call = react.mock.calls.find(([element]) => element === thumbnail(sampler).element);
    expect(call![1]).toEqual([
      {
        type: "scatter",
        mode: "markers",
        x: points,
        y: points,
        marker: { color: points, colorscale: "Viridis", size: 3 },
      },
    ]);
  });

  it("previews a defect applied to the observation connected to it", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const noise = await dropKind(wrapper, "GaussianNoise");
    const sampler = await dropKind(wrapper, "GridSampler");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), sampler, "latent");
    expect(thumbnail(noise).exists()).toBe(false);

    await connect(wrapper, sampler, noise, "observation", "observation");
    await flushPromises();

    expect(thumbnail(noise).attributes("aria-label")).toBe("Preview of Gaussian noise");
    const bodies = await Promise.all(previews().map((r) => r.clone().json()));
    const body = bodies.find((b) => b.node === noise.attributes("data-id"))!;
    expect(body.nodes.map((n: { kind: string }) => n.kind).sort()).toEqual([
      "GaussianField",
      "GaussianNoise",
      "GridSampler",
    ]);
    expect(body.edges).toHaveLength(2);
  });

  it("previews a Downsample of the observation connected to it", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const downsample = await dropKind(wrapper, "Downsample");
    const sampler = await dropKind(wrapper, "GridSampler");
    await connect(wrapper, await dropKind(wrapper, "GaussianField"), sampler, "latent");
    expect(thumbnail(downsample).exists()).toBe(false);

    await connect(wrapper, sampler, downsample, "observation", "observation");
    await flushPromises();

    expect(thumbnail(downsample).attributes("aria-label")).toBe("Preview of Downsample");
  });

  it("sends only the nodes upstream of the preview", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const field = await dropKind(wrapper, "GaussianField");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    const before = previews().length;

    const gain = await dropKind(wrapper, "Gain");
    await enter(gain.find("input"), "3");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(previews()).toHaveLength(before);
    const body = await previews()[0]!.json();
    expect(body.nodes.map((n: { id: string }) => n.id)).toEqual([field.attributes("data-id")]);
  });

  it("redraws the thumbnail when a parameter or the seed changes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));
    const field = await dropKind(wrapper, "GaussianField");
    const labels = field.findAll("label");
    expect(labels[labels.length - 1]!.text()).toBe("Seed");
    const seed = field.find(`#${labels[labels.length - 1]!.attributes("for")}`);

    await enter(field.find("input"), "0.3");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await enter(seed, "5");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const [, scale, seeded] = await Promise.all(previews().map((r) => r.clone().json()));
    expect(scale.nodes[0].params.length_scale).toBe(0.3);
    expect(seeded.nodes[0].params.seed).toBe(5);
  });

  it("shows why a field can't be previewed in place of its thumbnail", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse({ detail: "resolution is over the limit" }, 422));

    const field = await dropKind(wrapper, "GaussianField");
    await flushPromises();

    expect(thumbnail(field).exists()).toBe(false);
    const alert = field.find('[role="alert"]');
    expect(alert.text()).toBe("Couldn't preview this node.resolution is over the limit");
    expect(alert.classes()).toContain("text-destructive");
    expect(alert.element.parentElement!.classList).toContain("relative");
  });

  it("only draws thumbnails for latents it can preview", async () => {
    const wrapper = await mountView();
    answerPreviews(() => jsonResponse(PREVIEW));

    const analytic = await dropKind(wrapper, "AnalyticField");
    await flushPromises();

    expect(thumbnail(analytic).exists()).toBe(false);
    expect(previews()).toHaveLength(0);
  });
});
