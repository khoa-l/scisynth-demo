import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import type {
  DnDEndEvent,
  DroppableOptions,
  SortableDropEvent,
  SortableListOptions,
} from "@vue-dnd-kit/core";
import { flushPromises } from "@vue/test-utils";

import type { SurveyBlock } from "../lib/survey-blocks";
import ProjectSurveyView from "../views/ProjectSurveyView.vue";
import {
  PROJECT_ID,
  SURVEY,
  fetchMock,
  jsonResponse,
  mountPage,
  request,
  requests,
} from "./helpers";

const sortableLists = vi.hoisted(() => new Map<string, unknown>());
const dropTargets = vi.hoisted(() => new Map<string, unknown>());
const trashDrag = vi.hoisted(() => ({ state: { accepting: false, over: false } }));

vi.mock("@vue-dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vue-dnd-kit/core")>();
  const { computed, reactive, toValue } = await import("vue");
  const state = reactive({ accepting: false, over: false });
  trashDrag.state = state;
  return {
    ...actual,
    makeDroppable: ((target, options) => {
      dropTargets.set(toValue(options?.label) ?? "", options);
      const result = actual.makeDroppable(target, options);
      return {
        ...result,
        isAccepting: computed(() => state.accepting || result.isAccepting.value),
        isOver: computed(() => state.over || result.isOver.value),
      };
    }) satisfies typeof actual.makeDroppable,
    makeSortableList: ((target, options) => {
      sortableLists.set(toValue(options.label) ?? "", options);
      return actual.makeSortableList(target, options);
    }) satisfies typeof actual.makeSortableList,
  };
});

function sortableList(label: string) {
  return sortableLists.get(label) as SortableListOptions<SurveyBlock>;
}

function drop(label: string, items: SurveyBlock[]) {
  const options = sortableList(label);
  const preventDefault = vi.fn();
  const event = { result: new Map([[options.id!, items]]), preventDefault };
  options.onDrop!(event as unknown as SortableDropEvent<SurveyBlock>);
  return preventDefault;
}

afterEach(() => {
  trashDrag.state.accepting = false;
  trashDrag.state.over = false;
});

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
  it("has a grey builder with General and Data tabs below it, and a grey preview", async () => {
    const wrapper = await mountView();

    const builder = wrapper.find('[aria-label="Survey builder"]');
    const preview = wrapper.find('[aria-label="Survey preview"]');
    for (const panel of [builder, preview]) {
      expect(panel.classes()).toEqual(expect.arrayContaining(["bg-muted", "inset-shadow-sm"]));
    }
    const hint = builder.find("p");
    expect(hint.text()).toBe("Drag a block here to build the task.");
    expect(builder.classes()).toContain("relative");
    expect(hint.classes()).toEqual(
      expect.arrayContaining(["absolute", "inset-0", "flex", "items-center", "justify-center"]),
    );
    const [left, right] = wrapper.findAll("section");
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

  function saveLikeTheServer() {
    fetchMock.mockImplementation(async (input) => {
      const body = await (input as Request).clone().json();
      return jsonResponse({ ...SURVEY, ...body });
    });
  }

  const hello: SurveyBlock = { id: "b1", type: "text", text: "Hello" };
  const goodbye: SurveyBlock = { id: "b2", type: "text", text: "Goodbye" };

  function builderRows(wrapper: Awaited<ReturnType<typeof mountView>>) {
    return wrapper.findAll('[aria-label="Survey builder"] li');
  }

  it("offers a sortable Text block under General and nothing under Data yet", async () => {
    const wrapper = await mountView();

    const palette = wrapper.find(
      '[aria-label="Survey details"] [role="tabpanel"][data-state="active"]',
    );
    const blocks = palette.findAll("li");
    expect(blocks.map((block) => block.text())).toEqual(["Text"]);
    expect(blocks[0]!.attributes("aria-roledescription")).toBe("sortable");
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "Data")!
      .trigger("mousedown", { button: 0 });
    await flushPromises();
    expect(
      wrapper.find('[aria-label="Survey details"] [role="tabpanel"][data-state="active"]').text(),
    ).toBe("");
  });

  it("copies fresh Text blocks out of the palette without changing it", async () => {
    await mountView();

    const palette = sortableList("Survey blocks");
    expect(palette.group).toEqual({ name: "survey-blocks", pull: "clone", put: false });
    expect(palette.sort).toBe(false);
    const [template] = (palette.items as () => SurveyBlock[])();
    const first = palette.clone!(template!);
    const second = palette.clone!(template!);
    expect(first).toEqual({ id: expect.any(String), type: "text", text: "" });
    expect(new Set([template!.id, first.id, second.id]).size).toBe(3);
  });

  it("lets the whole builder take drops from the palette's group", async () => {
    const wrapper = await mountView();

    const builder = sortableList("Survey task");
    expect(builder.group).toBe("survey-blocks");
    expect((builder.dropzone as { value: Element }).value).toBe(
      wrapper.find('[aria-label="Survey builder"]').element,
    );
  });

  it("saves a dropped block and shows it in the task", async () => {
    const wrapper = await mountView();
    saveLikeTheServer();

    const preventDefault = drop("Survey task", [{ id: "new", type: "text", text: "" }]);
    await flushPromises();

    expect(preventDefault).toHaveBeenCalled();
    expect(await request("PATCH").json()).toEqual({
      content: { blocks: [{ id: "new", type: "text", text: "" }] },
    });
    const rows = builderRows(wrapper);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attributes("aria-roledescription")).toBe("sortable");
    expect(rows[0]!.find("textarea").attributes("placeholder")).toBe("Write some text…");
    expect(wrapper.find('[aria-label="Survey builder"]').text()).not.toContain("Drag a block");
  });

  it("saves the new order when blocks are reordered", async () => {
    const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello, goodbye] } });
    saveLikeTheServer();

    drop("Survey task", [goodbye, hello]);
    await flushPromises();

    expect(await request("PATCH").json()).toEqual({ content: { blocks: [goodbye, hello] } });
    expect(
      builderRows(wrapper).map(
        (row) => (row.find("textarea").element as HTMLTextAreaElement).value,
      ),
    ).toEqual(["Goodbye", "Hello"]);
  });

  it("saves the text of a block when it is edited", async () => {
    const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello] } });
    saveLikeTheServer();

    const textarea = wrapper.find('[aria-label="Survey builder"] textarea');
    expect((textarea.element as HTMLTextAreaElement).value).toBe("Hello");
    await textarea.setValue("Read the passage below.");
    await textarea.trigger("change");
    await flushPromises();

    expect(new URL(request("PATCH").url).pathname).toBe(
      `/api/projects/${PROJECT_ID}/surveys/${SURVEY.id}`,
    );
    expect(await request("PATCH").json()).toEqual({
      content: { blocks: [{ ...hello, text: "Read the passage below." }] },
    });
    expect((textarea.element as HTMLTextAreaElement).value).toBe("Read the passage below.");
  });

  function trash() {
    return dropTargets.get("Trash") as DroppableOptions;
  }

  function accepts(data: unknown) {
    const rule = trash().accept as (context: { active: { data: unknown } }) => boolean;
    return rule({ active: { data } });
  }

  it("lets the folder take back blocks from the task, but not from the palette", async () => {
    await mountView();

    expect(accepts("survey-task-block")).toBe(true);
    expect(accepts(undefined)).toBe(false);
  });

  it("removes a block from the task when it is dropped on the folder", async () => {
    await mountView();
    const remove = vi.fn();

    trash().onDrop!({ source: { list: "survey-builder", remove } } as unknown as DnDEndEvent);

    expect(remove).toHaveBeenCalledOnce();
  });

  it("saves the task without a block once it has been removed", async () => {
    const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello, goodbye] } });
    saveLikeTheServer();

    drop("Survey task", [goodbye]);
    await flushPromises();

    expect(await request("PATCH").json()).toEqual({ content: { blocks: [goodbye] } });
    expect(builderRows(wrapper)).toHaveLength(1);
  });

  it("turns the folder into a trash while a task block is dragged", async () => {
    const wrapper = await mountView();
    const details = () => wrapper.find('[aria-label="Survey details"]');
    expect(details().text()).not.toContain("Drop here to remove");

    trashDrag.state.accepting = true;
    await flushPromises();
    const overlay = details().find(".absolute.inset-0");
    expect(overlay.text()).toBe("Drop here to remove");
    expect(overlay.find("svg").exists()).toBe(true);
    expect(overlay.classes()).toEqual(
      expect.arrayContaining(["border-dashed", "bg-background/90"]),
    );
    expect(overlay.classes()).not.toContain("text-destructive");

    trashDrag.state.over = true;
    await flushPromises();
    expect(details().find(".absolute.inset-0").classes()).toEqual(
      expect.arrayContaining(["border-destructive", "bg-destructive/10", "text-destructive"]),
    );
  });

  function preview(wrapper: Awaited<ReturnType<typeof mountView>>) {
    return wrapper.find('[aria-label="Survey preview"]');
  }

  it("previews an empty survey with its name", async () => {
    const wrapper = await mountView();

    expect(preview(wrapper).find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(preview(wrapper).text()).toContain("This survey has no questions yet.");
  });

  it("previews the task's text blocks in order, skipping empty ones", async () => {
    const blank: SurveyBlock = { id: "b3", type: "text", text: "" };
    const wrapper = await mountView({ ...SURVEY, content: { blocks: [goodbye, blank, hello] } });

    const paragraphs = preview(wrapper).findAll("p");
    expect(paragraphs.map((p) => p.text())).toEqual(["Goodbye", "Hello"]);
    expect(paragraphs[0]!.classes()).toEqual(
      expect.arrayContaining(["whitespace-pre-line", "wrap-anywhere"]),
    );
    expect(preview(wrapper).text()).not.toContain("no questions");
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

  it("updates the preview when blocks are reordered", async () => {
    const wrapper = await mountView({ ...SURVEY, content: { blocks: [hello, goodbye] } });
    saveLikeTheServer();

    drop("Survey task", [goodbye, hello]);
    await flushPromises();

    expect(
      preview(wrapper)
        .findAll("p")
        .map((p) => p.text()),
    ).toEqual(["Goodbye", "Hello"]);
  });
});
