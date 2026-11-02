import { describe, it, expect } from "vite-plus/test";

import { createMemoryHistory, createRouter } from "vue-router";

import { routes } from "../router";

const PROJECT_ID = "3f2b8c1e-5d4a-4e6f-9b7c-0a1d2e3f4a5b";

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

  it("serves Data, Survey and Results at their own URLs", () => {
    const router = testRouter();
    expect(router.resolve(`/project/${PROJECT_ID}/data`).name).toBe("project-data");
    expect(router.resolve(`/project/${PROJECT_ID}/survey`).name).toBe("project-survey");
    expect(router.resolve(`/project/${PROJECT_ID}/results`).name).toBe("project-results");
  });

  it("opens data and survey items at their own URLs", () => {
    const router = testRouter();
    expect(router.resolve(`/project/${PROJECT_ID}/data/3`).name).toBe("project-dataset");
    expect(router.resolve(`/project/${PROJECT_ID}/survey/4`).name).toBe("project-survey-item");
  });
});
