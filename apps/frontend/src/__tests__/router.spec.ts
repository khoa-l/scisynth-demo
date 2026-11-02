import { describe, it, expect } from "vite-plus/test";

import { createMemoryHistory, createRouter } from "vue-router";

import { routes } from "../router";

const PROJECT_ID = "V11k9b8XeABv2ISddF304";

function testRouter() {
  return createRouter({ history: createMemoryHistory(), routes });
}

describe("project routes", () => {
  it("opens a project on its Overview page", async () => {
    const router = testRouter();
    await router.push({ name: "project", params: { projectId: PROJECT_ID } });
    expect(router.currentRoute.value.name).toBe("project");
    expect(router.currentRoute.value.fullPath).toBe(`/project/${PROJECT_ID}`);
  });

  it("serves Datasets and Survey at their own URLs", () => {
    const router = testRouter();
    expect(router.resolve(`/project/${PROJECT_ID}/dataset`).name).toBe("project-datasets");
    expect(router.resolve(`/project/${PROJECT_ID}/survey`).name).toBe("project-surveys");
  });

  it("opens a dataset and a survey at their own URLs", () => {
    const router = testRouter();
    expect(router.resolve(`/project/${PROJECT_ID}/dataset/Eq-OvCTLPC6Urz_TXE8eJ`).name).toBe(
      "project-dataset",
    );
    expect(router.resolve(`/project/${PROJECT_ID}/survey/pZtIo1NJJ5C48xzJcDG3F`).name).toBe(
      "project-survey",
    );
  });
});

describe("public routes", () => {
  it("opens a published survey at /s/ without signing in", () => {
    const route = testRouter().resolve("/s/Jx2k8LmN0pQr4StUv6WxY");
    expect(route.name).toBe("public-survey");
    expect(route.params.publicId).toBe("Jx2k8LmN0pQr4StUv6WxY");
    expect(route.matched.some((record) => record.meta.requiresAuth)).toBe(false);
  });
});
