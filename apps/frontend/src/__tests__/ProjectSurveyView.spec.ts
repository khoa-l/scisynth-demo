import { describe, it, expect, vi } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import { PROJECT_ID, SURVEY, fetchMock, jsonResponse, request, requests } from "./helpers";
import { PUBLISHED, findButton, hello, mountView, preview, saveLikeTheServer } from "./survey-view";

describe("Survey view", () => {
  it("has a grey builder with General and Data tabs below it, and a grey preview", async () => {
    const wrapper = await mountView();

    const builder = wrapper.find('[aria-label="Survey builder"]');
    const preview = wrapper.find('[aria-label="Survey preview"]');
    for (const panel of [builder, preview]) {
      expect(panel.classes()).toEqual(
        expect.arrayContaining(["bg-muted", "inset-shadow-sm", "p-4"]),
      );
    }
    for (const column of [builder.find("ol").element, preview.find("div").element]) {
      expect([...column.classList]).toEqual(
        expect.arrayContaining(["mx-auto", "w-full", "max-w-2xl"]),
      );
    }
    const hint = builder.find("p");
    expect(hint.text()).toBe("Drag a block here to build the task.");
    expect(builder.classes()).toContain("relative");
    expect(hint.classes()).toEqual(
      expect.arrayContaining(["absolute", "inset-0", "flex", "items-center", "justify-center"]),
    );
    const [left, right] = wrapper.findAll("section");
    expect(left!.element.parentElement!.classList).toContain("grid-cols-2");
    expect(left!.element.contains(builder.element)).toBe(true);
    expect(right!.element.contains(preview.element)).toBe(true);

    const details = wrapper.find('[role="group"][aria-label="Survey details"]');
    const builderArea = builder.element.parentElement!;
    const detailsArea = details.element.parentElement!;
    expect(builderArea.classList).toContain("flex-3");
    expect(detailsArea.classList).toContain("flex-1");
    expect(builderArea.nextElementSibling).toBe(detailsArea);
    const tablist = details.find('[role="tablist"]');
    expect(tablist.attributes("aria-label")).toBe("Survey sections");
    const tabs = tablist.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["General", "Data"]);
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual(["true", "false"]);
  });

  it("updates the preview as you type, and saves only when you leave the box", async () => {
    const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello] } });
    saveLikeTheServer();

    const textarea = wrapper.find('[aria-label="Survey builder"] textarea');
    (textarea.element as HTMLTextAreaElement).value = "Hello there";
    await textarea.trigger("input");
    await flushPromises();
    expect(preview(wrapper).find("p").text()).toBe("Hello there");
    expect(requests().some((r) => r.method === "PATCH")).toBe(false);

    await textarea.trigger("change");
    await flushPromises();
    expect(await request("PATCH").json()).toEqual({
      content: { blocks: [{ ...hello, text: "Hello there" }] },
    });
  });

  describe("publishing", () => {
    function holdSaves() {
      let release!: (status?: number) => void;
      const gate = new Promise<number>((resolve) => (release = (status = 200) => resolve(status)));
      fetchMock.mockImplementation(async (input) => {
        const req = input as Request;
        if (req.method !== "PATCH") return jsonResponse(PUBLISHED);
        const status = await gate;
        const body = await req.clone().json();
        return status === 200
          ? jsonResponse({ ...SURVEY, ...body })
          : jsonResponse({ detail: "Server error" }, status);
      });
      return (status?: number) => release(status);
    }

    async function editText(wrapper: Awaited<ReturnType<typeof mountView>>, text: string) {
      const textarea = wrapper.find('[aria-label="Survey builder"] textarea');
      (textarea.element as HTMLTextAreaElement).value = text;
      await textarea.trigger("input");
      await textarea.trigger("change");
    }

    function methods() {
      return requests().map((r) => r.method);
    }

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

    it("waits for a save in flight before publishing", async () => {
      const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello] } });
      const release = holdSaves();

      await editText(wrapper, "Hello there");
      await findButton(wrapper, "Publish")!.trigger("click");
      await flushPromises();
      expect(methods()).toEqual(["GET", "PATCH"]);

      release();
      await flushPromises();
      expect(methods()).toEqual(["GET", "PATCH", "POST"]);
      expect(findButton(wrapper, "Unpublish")).toBeDefined();
    });

    it("doesn't publish when the save it was waiting for fails", async () => {
      const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello] } });
      const release = holdSaves();

      await editText(wrapper, "Hello there");
      await findButton(wrapper, "Publish")!.trigger("click");
      release(500);
      await flushPromises();

      expect(methods()).toEqual(["GET", "PATCH"]);
      expect(wrapper.find('[role="alert"]').text()).toContain("Couldn't save your changes.");
    });

    it("shows a failed save, blocks publishing, and saves again on retry", async () => {
      const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello] } });
      fetchMock.mockResolvedValue(jsonResponse({ detail: "Server error" }, 500));

      await editText(wrapper, "Hello there");
      await flushPromises();
      const alert = wrapper.find('[aria-label="Survey builder"] [role="alert"]');
      expect(alert.text()).toContain("Couldn't save your changes.");
      expect(alert.classes()).toEqual(expect.arrayContaining(["text-destructive"]));
      expect(preview(wrapper).find("p").text()).toBe("Hello there");
      expect(findButton(wrapper, "Publish")!.attributes("disabled")).toBeDefined();

      saveLikeTheServer();
      await findButton(wrapper, "Try again")!.trigger("click");
      await flushPromises();

      expect(await request("PATCH").json()).toEqual({
        content: { blocks: [{ ...hello, text: "Hello there" }] },
      });
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(findButton(wrapper, "Publish")!.attributes("disabled")).toBeUndefined();
    });
  });
});
