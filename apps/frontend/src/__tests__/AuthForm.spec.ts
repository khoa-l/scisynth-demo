import { describe, it, expect } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import AuthForm from "../components/AuthForm.vue";

function mountAuthForm(mode: "login" | "register") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div />" } },
      { path: "/login", name: "login", component: { template: "<div />" } },
      { path: "/register", name: "register", component: { template: "<div />" } },
    ],
  });
  return mount(AuthForm, {
    props: { mode },
    global: { plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
  });
}

describe("AuthForm", () => {
  it("shows validation errors when submitted empty", async () => {
    const wrapper = mountAuthForm("login");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Enter a valid email address");
    expect(wrapper.text()).toContain("Enter your password");
  });

  it("requires a longer password when registering", async () => {
    const wrapper = mountAuthForm("register");
    await wrapper.find("input[type=email]").setValue("ada@example.com");
    await wrapper.find("input[type=password]").setValue("short");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Use at least 8 characters");
  });
});
