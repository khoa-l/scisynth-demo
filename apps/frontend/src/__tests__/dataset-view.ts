import { VueFlow, type Connection } from "@vue-flow/core";
import { flushPromises, type DOMWrapper } from "@vue/test-utils";

import type { DatasetPublic } from "../client";
import ProjectDatasetView from "../views/ProjectDatasetView.vue";
import {
  DATASET,
  PROJECT_ID,
  fakeDataTransfer,
  fetchMock,
  jsonResponse,
  mountPage,
} from "./helpers";

export const AXIS = { dtype: "f4", bdata: "AAAAAAAAgD8=", shape: "2" };
const NO_PREVIEW = { layout: "grid", axes: ["x", "y"], x: AXIS, y: AXIS, channels: [] };

export function answerWith(dataset: DatasetPublic) {
  fetchMock.mockImplementation(async (input) =>
    new URL((input as Request).url).pathname === "/api/previews/nodes"
      ? jsonResponse(NO_PREVIEW)
      : jsonResponse(dataset),
  );
}

export async function mountView(dataset: DatasetPublic = DATASET) {
  answerWith(dataset);
  const { wrapper } = await mountPage(ProjectDatasetView, {
    props: { projectId: PROJECT_ID, datasetId: DATASET.id },
  });
  return wrapper;
}

export type Wrapper = Awaited<ReturnType<typeof mountView>>;

export function details(wrapper: Wrapper) {
  return wrapper.find('[role="group"][aria-label="Dataset details"]');
}

export function visiblePanel(wrapper: Wrapper) {
  return details(wrapper)
    .findAll('[role="tabpanel"]')
    .find((panel) => panel.attributes("data-state") === "active")!;
}

export function paletteItem(wrapper: Wrapper, label: string) {
  return visiblePanel(wrapper)
    .findAll("li")
    .find((item) => item.text() === label)!;
}

export async function dropKind(wrapper: Wrapper, name: string) {
  const dataTransfer = fakeDataTransfer();
  dataTransfer.setData("application/x-scisynth-node", name);
  await wrapper.find(".vue-flow").trigger("drop", { dataTransfer, clientX: 0, clientY: 0 });
  await flushPromises();
  const nodes = wrapper.findAll(".vue-flow__node");
  return nodes[nodes.length - 1]!;
}

export async function connect(
  wrapper: Wrapper,
  source: DOMWrapper<Element>,
  target: DOMWrapper<Element>,
  targetHandle: string,
  sourceHandle = "field",
) {
  const flow = wrapper.findComponent(VueFlow).vm as unknown as {
    emits: { connect: (connection: Connection) => void };
  };
  flow.emits.connect({
    source: source.attributes("data-id")!,
    sourceHandle,
    target: target.attributes("data-id")!,
    targetHandle,
  });
  await flushPromises();
}

export async function enter(input: DOMWrapper<Element>, value: string) {
  (input.element as HTMLInputElement).value = value;
  await input.trigger("input");
  await input.trigger("blur");
}
