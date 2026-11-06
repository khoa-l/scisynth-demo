import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import {
  datasetsGetDatasetsQueryKey,
  surveysGetSurveysQueryKey,
} from "../client/@tanstack/vue-query.gen";
import ProjectDatasetsView from "../views/ProjectDatasetsView.vue";
import ProjectSurveysView from "../views/ProjectSurveysView.vue";
import {
  PROJECT_ID,
  alertDialog,
  button,
  captureDownloads,
  dialog,
  fileResponse,
  jsonResponse,
  mountPage,
  request,
  respondTo,
  submitName,
  testQueryClient,
} from "./helpers";

const SECOND = { id: "pZtIo1NJJ5C48xzJcDG3F", name: "Second", created_at: "2026-11-02T00:00:01Z" };
const FIRST = { id: "Eq-OvCTLPC6Urz_TXE8eJ", name: "First", created_at: "2026-11-02T00:00:00Z" };
const items = [SECOND, FIRST];

describe.each([
  {
    name: "Datasets",
    view: ProjectDatasetsView,
    queryKey: () => datasetsGetDatasetsQueryKey({ path: { project_id: PROJECT_ID } }),
    url: `/api/projects/${PROJECT_ID}/datasets`,
    noun: "dataset",
    itemPath: `/project/${PROJECT_ID}/dataset`,
    newLabel: "New Dataset",
    initialName: "untitled-dataset",
    publishable: false,
    actions: ["Download dataset"],
  },
  {
    name: "Surveys",
    view: ProjectSurveysView,
    queryKey: () => surveysGetSurveysQueryKey({ path: { project_id: PROJECT_ID } }),
    url: `/api/projects/${PROJECT_ID}/surveys`,
    noun: "survey",
    itemPath: `/project/${PROJECT_ID}/survey`,
    newLabel: "New Survey",
    initialName: "untitled-survey",
    publishable: true,
    actions: ["Publish survey"],
  },
])(
  "$name view",
  ({ view, queryKey, url, noun, itemPath, newLabel, initialName, publishable, actions }) => {
    async function mountView() {
      const queryClient = testQueryClient();
      queryClient.setQueryData(queryKey(), items);
      return mountPage(view, { props: { projectId: PROJECT_ID }, queryClient });
    }

    it("shows the items as a grid of squares that link to each item", async () => {
      const { wrapper } = await mountView();

      const rows = wrapper.findAll("li");
      expect(rows.map((row) => row.find("p").text())).toEqual(["Second", "First"]);
      expect(rows.every((row) => row.find(".aspect-square").exists())).toBe(true);
      expect(rows.map((row) => row.find("a").attributes("href"))).toEqual([
        `${itemPath}/${SECOND.id}`,
        `${itemPath}/${FIRST.id}`,
      ]);
    });

    it("opens an item when it is clicked in either view", async () => {
      for (const viewLabel of ["Grid view", "List view"]) {
        const { wrapper, router } = await mountView();
        await wrapper.find(`[aria-label="${viewLabel}"]`).trigger("click");
        await wrapper.findAll("li")[1]!.find("a").trigger("click");
        await flushPromises();
        expect(router.currentRoute.value.fullPath).toBe(`${itemPath}/${FIRST.id}`);
        wrapper.unmount();
      }
    });

    it(`creates an item from the ${newLabel} button`, async () => {
      respondTo({ POST: jsonResponse({ ...SECOND, id: "fjz26ezxp_dKE9W_vb5hf" }, 201) }, items);
      const { wrapper } = await mountView();
      await wrapper
        .findAll("button")
        .find((b) => b.text() === newLabel)!
        .trigger("click");
      await flushPromises();
      expect(dialog()?.textContent).toContain(`New ${noun}`);
      expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
        initialName,
      );

      await submitName("  Fresh  ");
      expect(new URL(request("POST").url).pathname).toBe(url);
      expect(await request("POST").json()).toEqual({ name: "Fresh" });
      expect(dialog()).toBeNull();
    });

    it("renames an item and updates the list", async () => {
      const renamed = { ...FIRST, name: "Renamed" };
      respondTo({ PATCH: jsonResponse(renamed) }, [SECOND, renamed]);
      const { wrapper, queryClient } = await mountView();
      await wrapper.findAll("li")[1]!.find(`[aria-label="Rename ${noun}"]`).trigger("click");
      await flushPromises();
      await submitName("Renamed");

      expect(new URL(request("PATCH").url).pathname).toBe(`${url}/${FIRST.id}`);
      expect(await request("PATCH").json()).toEqual({ name: "Renamed" });
      expect(queryClient.getQueryData(queryKey())).toEqual([SECOND, renamed]);
      expect(dialog()).toBeNull();
    });

    it("deletes an item after confirmation and removes it from the list", async () => {
      respondTo({ DELETE: new Response(null, { status: 204 }) }, [FIRST]);
      const { wrapper, queryClient } = await mountView();
      await wrapper.findAll("li")[0]!.find(`[aria-label="Delete ${noun}"]`).trigger("click");
      await flushPromises();
      expect(alertDialog()?.textContent).toContain(`Delete ${noun}?`);
      button(alertDialog(), "Delete").click();
      await flushPromises();

      expect(new URL(request("DELETE").url).pathname).toBe(`${url}/${SECOND.id}`);
      expect(queryClient.getQueryData(queryKey())).toEqual([FIRST]);
      expect(alertDialog()).toBeNull();
    });

    it(`has ${actions.join(", ")}, rename and delete in each item's actions`, async () => {
      const { wrapper } = await mountView();

      for (const row of wrapper.findAll("li")) {
        const labels = row
          .find('[role="group"]')
          .findAll("button")
          .map((b) => b.attributes("aria-label"));
        expect(labels).toEqual([...actions, `Rename ${noun}`, `Delete ${noun}`]);
      }
    });

    it.runIf(!publishable)("downloads all of an item's data from its actions", async () => {
      respondTo({ GET: fileResponse() }, items);
      const { wrapper } = await mountView();
      const downloads = captureDownloads();

      await wrapper.findAll("li")[0]!.find('[aria-label="Download dataset"]').trigger("click");
      await flushPromises();

      expect(new URL(request("GET").url).pathname).toBe(`${url}/${SECOND.id}/data`);
      expect(downloads.names()).toEqual([`${SECOND.name}-data.zip`]);
    });

    it.runIf(publishable)("publishes and unpublishes an item from its actions", async () => {
      const published = { ...SECOND, public_id: "Jx2k8LmN0pQr4StUv6WxY", published_version: 1 };
      const unpublished = { ...published, published_version: null };
      respondTo({ POST: jsonResponse(published), DELETE: jsonResponse(unpublished) }, items);
      const { wrapper, queryClient } = await mountView();
      const row = () => wrapper.findAll("li")[0]!;

      await row().find(`[aria-label="Publish ${noun}"]`).trigger("click");
      await flushPromises();
      expect(new URL(request("POST").url).pathname).toBe(`${url}/${SECOND.id}/publish`);
      expect(queryClient.getQueryData(queryKey())).toEqual([published, FIRST]);

      await row().find(`[aria-label="Unpublish ${noun}"]`).trigger("click");
      await flushPromises();
      expect(new URL(request("DELETE").url).pathname).toBe(`${url}/${SECOND.id}/publish`);
      expect(queryClient.getQueryData(queryKey())).toEqual([unpublished, FIRST]);
      expect(row().find(`[aria-label="Publish ${noun}"]`).exists()).toBe(true);
    });

    it.runIf(publishable)("says on the publish button why publishing failed", async () => {
      const reason = "A chart can't be shown: The chart's dataset isn't in this project";
      respondTo({ POST: jsonResponse({ detail: reason }, 422) }, items);
      const { wrapper } = await mountView();
      const publish = () => wrapper.findAll("li")[0]!.find(`[aria-label="Publish ${noun}"]`);

      await publish().trigger("click");
      await flushPromises();

      expect(publish().attributes("title")).toBe(reason);
    });
  },
);
