import { describe, it, expect } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";

import ProjectPage from "../components/ProjectPage.vue";
import ProjectOverviewView from "../views/ProjectOverviewView.vue";
import { PROJECT, PROJECT_ID, jsonResponse, fetchMock, mountPage, requests } from "./helpers";

const props = { projectId: PROJECT_ID };
const emptyQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("ProjectPage", () => {
  it("loads the project from the API and shows its name as the heading", async () => {
    fetchMock.mockResolvedValue(jsonResponse(PROJECT));
    const { wrapper } = await mountPage(ProjectPage, { props, queryClient: emptyQueryClient() });

    expect(new URL(requests()[0]!.url).pathname).toBe(`/api/projects/${PROJECT_ID}`);
    expect(wrapper.find("h1").text()).toBe("Protein folding");
  });

  it("shows a message when the project can't be found", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Project not found" }, 404));
    const { wrapper } = await mountPage(ProjectPage, { props, queryClient: emptyQueryClient() });

    expect(wrapper.text()).toContain("This project couldn't be found.");
    expect(wrapper.find("h1").exists()).toBe(false);
  });
});

describe("Overview view", () => {
  it("shows the project name with no action buttons", async () => {
    const { wrapper } = await mountPage(ProjectOverviewView, { props });

    expect(wrapper.find("h1").text()).toBe("Protein folding");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
