import { describe, it, expect } from "vite-plus/test";

import { createMemoryHistory, createRouter } from "vue-router";

import { routes } from "../router";
import { PROJECT_ID } from "./helpers";

const router = createRouter({ history: createMemoryHistory(), routes });

describe("routes", () => {
  it("opens a project on its Overview page", () => {
    expect(router.resolve(`/project/${PROJECT_ID}`).name).toBe("project");
  });

  it("serves Datasets and Surveys at their own singular URLs", () => {
    expect(router.resolve(`/project/${PROJECT_ID}/dataset`).name).toBe("project-datasets");
    expect(router.resolve(`/project/${PROJECT_ID}/survey`).name).toBe("project-surveys");
  });

  it("opens a dataset and a survey at their own URLs", () => {
    expect(router.resolve(`/project/${PROJECT_ID}/dataset/Eq-OvCTLPC6Urz_TXE8eJ`).name).toBe(
      "project-dataset",
    );
    expect(router.resolve(`/project/${PROJECT_ID}/survey/pZtIo1NJJ5C48xzJcDG3F`).name).toBe(
      "project-survey",
    );
  });

  it("opens a survey's results under the Surveys section", () => {
    const results = router.resolve(`/project/${PROJECT_ID}/survey/pZtIo1NJJ5C48xzJcDG3F/results`);
    expect(results.name).toBe("project-survey-results");
    expect(results.params.surveyId).toBe("pZtIo1NJJ5C48xzJcDG3F");
    expect(results.meta.projectSection).toBe("surveys");
  });

  it("requires signing in for the app but not for a published survey", () => {
    const requiresAuth = (path: string) =>
      router.resolve(path).matched.some((record) => record.meta.requiresAuth);
    expect(requiresAuth(`/project/${PROJECT_ID}`)).toBe(true);
    const survey = router.resolve("/s/Jx2k8LmN0pQr4StUv6WxY");
    expect(survey.name).toBe("public-survey");
    expect(survey.params.publicId).toBe("Jx2k8LmN0pQr4StUv6WxY");
    expect(requiresAuth("/s/Jx2k8LmN0pQr4StUv6WxY")).toBe(false);
  });
});
