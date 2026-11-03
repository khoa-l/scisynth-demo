import { describe, it, expect } from "vite-plus/test";

import { flushPromises, mount } from "@vue/test-utils";
import { h } from "vue";

import ConfirmDialog from "../components/ConfirmDialog.vue";
import { alertDialog, button } from "./helpers";

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

describe("ConfirmDialog", () => {
  it("renders the given title, description and confirm label", async () => {
    await openDialog({ description: "Gone for good", confirmLabel: "Delete" });
    expect(alertDialog()?.textContent).toContain("Delete thing?");
    expect(alertDialog()?.textContent).toContain("Gone for good");
    expect(button(alertDialog(), "Delete")).toBeTruthy();
  });

  it("emits confirm and stays open for the caller to close", async () => {
    const wrapper = await openDialog({ confirmLabel: "Delete" });
    button(alertDialog(), "Delete").click();
    await flushPromises();
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    expect(alertDialog()).not.toBeNull();
  });

  it("closes on cancel without emitting", async () => {
    const wrapper = await openDialog();
    button(alertDialog(), "Cancel").click();
    await flushPromises();
    expect(wrapper.emitted("confirm")).toBeUndefined();
    expect(alertDialog()).toBeNull();
  });

  it("shows an error and disables both buttons while pending", async () => {
    await openDialog({ error: "Server said no", pending: true });
    expect(alertDialog()?.querySelector('[role="alert"]')?.textContent).toBe("Server said no");
    expect(button(alertDialog(), "Confirm").disabled).toBe(true);
    expect(button(alertDialog(), "Cancel").disabled).toBe(true);
  });

  it("uses the destructive button style when destructive", async () => {
    await openDialog({ destructive: true });
    expect(button(alertDialog(), "Confirm").className).toContain("text-destructive");
  });
});
