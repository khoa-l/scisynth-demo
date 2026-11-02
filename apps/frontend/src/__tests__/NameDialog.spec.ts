import { afterEach, describe, it, expect } from "vite-plus/test";

import { flushPromises, mount } from "@vue/test-utils";
import { h } from "vue";

import NameDialog from "../components/NameDialog.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

async function openDialog(props: Record<string, unknown> = {}) {
  const wrapper = mount(NameDialog, {
    props: { title: "Rename thing", initialName: "Original", ...props },
    slots: { default: () => h("button", { type: "button" }, "Open") },
    attachTo: document.body,
  });
  await wrapper.find("button").trigger("click");
  await flushPromises();
  return wrapper;
}

function dialog() {
  return document.querySelector('[role="dialog"]');
}

function nameInput() {
  return document.querySelector<HTMLInputElement>('input[name="name"]')!;
}

async function typeName(value: string) {
  nameInput().value = value;
  nameInput().dispatchEvent(new Event("input"));
  await flushPromises();
}

async function submit() {
  document.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  await flushPromises();
}

describe("NameDialog", () => {
  it("renders the given title, description, labels and initial name", async () => {
    const wrapper = await openDialog({
      description: "Pick something",
      label: "Title",
      submitLabel: "Create",
    });
    expect(dialog()?.textContent).toContain("Rename thing");
    expect(dialog()?.textContent).toContain("Pick something");
    expect(dialog()?.querySelector("label")?.textContent).toBe("Title");
    expect(dialog()?.querySelector('button[type="submit"]')?.textContent?.trim()).toBe("Create");
    expect(nameInput().value).toBe("Original");
    wrapper.unmount();
  });

  it("emits the trimmed name on submit", async () => {
    const wrapper = await openDialog();
    await typeName("  New name  ");
    await submit();
    expect(wrapper.emitted("submit")).toEqual([["New name"]]);
    wrapper.unmount();
  });

  it("shows a validation error and does not emit for a blank name", async () => {
    const wrapper = await openDialog();
    await typeName("   ");
    await submit();
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(dialog()?.textContent).toContain("Enter a name");
    wrapper.unmount();
  });

  it("shows an error message and disables submit while pending", async () => {
    const wrapper = await openDialog({ error: "Server said no", pending: true });
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe("Server said no");
    expect(dialog()?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      true,
    );
    wrapper.unmount();
  });

  it("resets to the initial name each time it opens", async () => {
    const wrapper = await openDialog();
    await typeName("Discarded");
    const cancel = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (button) => button.textContent?.trim() === "Cancel",
    )!;
    cancel.click();
    await flushPromises();
    expect(dialog()).toBeNull();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(nameInput().value).toBe("Original");
    wrapper.unmount();
  });
});
