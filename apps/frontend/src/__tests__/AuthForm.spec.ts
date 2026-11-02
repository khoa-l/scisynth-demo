import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import AuthForm from "../components/AuthForm.vue";
import { mountPage } from "./helpers";

async function mountAuthForm(mode: "login" | "register") {
  const { wrapper } = await mountPage(AuthForm, { props: { mode } });
  return wrapper;
}

describe("AuthForm", () => {
  it("shows validation errors when submitted empty", async () => {
    const wrapper = await mountAuthForm("login");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Enter a valid email address");
    expect(wrapper.text()).toContain("Enter your password");
  });

  it("requires a longer password when registering", async () => {
    const wrapper = await mountAuthForm("register");
    await wrapper.find("input[type=email]").setValue("ada@example.com");
    await wrapper.find("input[type=password]").setValue("short");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Use at least 8 characters");
  });
});
