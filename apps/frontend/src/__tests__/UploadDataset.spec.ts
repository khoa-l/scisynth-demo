import { flushPromises } from "@vue/test-utils";
import { describe, it, expect } from "vite-plus/test";

import ProjectDatasetsView from "../views/ProjectDatasetsView.vue";
import {
  DATASET,
  PROJECT_ID,
  button,
  dialog,
  jsonResponse,
  mountPage,
  request,
  respondTo,
} from "./helpers";

const EXPORTED = {
  format: "scisynth-dataset",
  version: 1,
  name: "Raw reads",
  generator: { scisynth: "abc123", numpy: "2.5.4" },
  graph: DATASET.content,
};

async function openDialog() {
  const { wrapper } = await mountPage(ProjectDatasetsView, { props: { projectId: PROJECT_ID } });
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "Upload Dataset")!
    .trigger("click");
  await flushPromises();
}

async function choose(contents: string, name = "raw-reads.scisynth.json") {
  const input = dialog()!.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File([contents], name)] });
  input.dispatchEvent(new Event("change"));
  await flushPromises();
}

function nameInput() {
  return dialog()!.querySelector<HTMLInputElement>('input:not([type="file"])');
}

describe("Upload dataset", () => {
  it("creates a dataset from a downloaded file under the name given", async () => {
    respondTo({ POST: jsonResponse({ ...DATASET, name: "Copy" }, 201) }, []);
    await openDialog();

    await choose(JSON.stringify(EXPORTED));
    expect(nameInput()?.value).toBe("Raw reads");
    nameInput()!.value = "  Copy ";
    nameInput()!.dispatchEvent(new Event("input"));
    await flushPromises();
    button(dialog(), "Upload").click();
    await flushPromises();

    expect(new URL(request("POST").url).pathname).toBe(
      `/api/projects/${PROJECT_ID}/datasets/upload`,
    );
    expect(await request("POST").json()).toEqual({ ...EXPORTED, name: "Copy" });
    expect(dialog()).toBeNull();
  });

  it("says when the file can't be read", async () => {
    await openDialog();

    await choose("not json");

    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      "This file isn't a scisynth dataset.",
    );
    expect(nameInput()).toBeNull();
    expect(button(dialog(), "Upload").disabled).toBe(true);
  });

  it("says when the server can't open the file", async () => {
    respondTo({ POST: jsonResponse({ detail: [{ msg: "Input should be 1" }] }, 422) }, []);
    await openDialog();

    await choose(JSON.stringify({ ...EXPORTED, version: 2 }));
    button(dialog(), "Upload").click();
    await flushPromises();

    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      "This file isn't a scisynth dataset.",
    );
  });
});
