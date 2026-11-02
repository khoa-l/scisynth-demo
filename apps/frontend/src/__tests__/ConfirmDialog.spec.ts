import { afterEach, describe, it, expect } from "vite-plus/test";

import { flushPromises, mount } from "@vue/test-utils";
import { h } from "vue";

import ConfirmDialog from "../components/ConfirmDialog.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

async function openDialog(props: Record<string, unknown> = {}) {
  const wrapper = mount(ConfirmDialog, {
    props: { title: "Delete thing?", ...props },
    slots: { default: () => h("button", { type: "button" }, "Open") },
    attachTo: document.body,
  });
  await wrapper.find("button").trigger("click");
  await flushPromises();
  return wrapper;
}

function dialog() {
  return document.querySelector('[role="alertdialog"]');
}

function dialogButton(label: string) {
  return [...(dialog()?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent?.trim() === label,
  )!;
}

describe("ConfirmDialog", () => {
  it("renders the given title, description and confirm label", async () => {
    const wrapper = await openDialog({ description: "Gone for good", confirmLabel: "Delete" });
    expect(dialog()?.textContent).toContain("Delete thing?");
    expect(dialog()?.textContent).toContain("Gone for good");
    expect(dialogButton("Delete")).toBeTruthy();
    wrapper.unmount();
  });

  it("emits confirm and stays open for the caller to close", async () => {
    const wrapper = await openDialog({ confirmLabel: "Delete" });
    dialogButton("Delete").click();
    await flushPromises();
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    expect(dialog()).not.toBeNull();
    wrapper.unmount();
  });

  it("closes on cancel without emitting", async () => {
    const wrapper = await openDialog();
    dialogButton("Cancel").click();
    await flushPromises();
    expect(wrapper.emitted("confirm")).toBeUndefined();
    expect(dialog()).toBeNull();
    wrapper.unmount();
  });

  it("shows an error and disables both buttons while pending", async () => {
    const wrapper = await openDialog({ error: "Server said no", pending: true });
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe("Server said no");
    expect(dialogButton("Confirm").disabled).toBe(true);
    expect(dialogButton("Cancel").disabled).toBe(true);
    wrapper.unmount();
  });

  it("uses the destructive button style when destructive", async () => {
    const wrapper = await openDialog({ destructive: true });
    expect(dialogButton("Confirm").className).toContain("text-destructive");
    wrapper.unmount();
  });
});
