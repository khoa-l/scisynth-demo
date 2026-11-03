import { afterEach, describe, it, expect, vi } from "vite-plus/test";

import type {
  DnDEndEvent,
  OverlayProps,
  DroppableOptions,
  SortableDropEvent,
  SortableListOptions,
} from "@vue-dnd-kit/core";
import { flushPromises, mount } from "@vue/test-utils";
import type { FunctionalComponent } from "vue";

import type { SurveyBlock } from "../lib/survey-blocks";
import { PROJECT_ID, SURVEY, request } from "./helpers";
import { goodbye, hello, mountView, preview, saveLikeTheServer } from "./survey-view";

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

function builderRows(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper.findAll('[aria-label="Survey builder"] li');
}

afterEach(() => {
  trashDrag.state.accepting = false;
  trashDrag.state.over = false;
});

describe("Survey builder", () => {
  describe("block palette", () => {
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

    it("drags a freshly drawn chip from the palette rather than a copy of the hovered one", async () => {
      await mountView();

      const overlay = sortableList("Survey blocks").overlay as FunctionalComponent<OverlayProps>;
      const chip = mount(overlay, {
        props: {
          items: [
            { id: "new", item: { id: "new", type: "text", text: "" }, data: undefined, type: [] },
          ],
        },
      } as never);

      expect(chip.text()).toBe("Text");
      expect(chip.attributes("style")).toBeUndefined();
    });
  });

  describe("task", () => {
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
      expect(
        preview(wrapper)
          .findAll("p")
          .map((p) => p.text()),
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
  });

  describe("trash", () => {
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
  });
});
