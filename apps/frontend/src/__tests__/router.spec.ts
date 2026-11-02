import { describe, it, expect } from "vite-plus/test";

import { createMemoryHistory, createRouter } from "vue-router";

import { routes } from "../router";

function testRouter() {
  return createRouter({ history: createMemoryHistory(), routes });
}

describe("project routes", () => {
  it("opens a project on its Overview page", async () => {
    const router = testRouter();
    await router.push({ name: "project", params: { projectId: 7 } });
    expect(router.currentRoute.value.name).toBe("project");
    expect(router.currentRoute.value.fullPath).toBe("/projects/7");
  });

  it("serves Data, Survey and Results at their own URLs", () => {
    const router = testRouter();
    expect(router.resolve("/projects/7/data").name).toBe("project-data");
    expect(router.resolve("/projects/7/survey").name).toBe("project-survey");
    expect(router.resolve("/projects/7/results").name).toBe("project-results");
  });
});
