import { describe, it, expect } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";

import PublicSurveyView from "../views/PublicSurveyView.vue";
import { fetchMock, jsonResponse, mountPage, requests } from "./helpers";

const PUBLIC_ID = "Jx2k8LmN0pQr4StUv6WxY";

async function mountView() {
  const { wrapper } = await mountPage(PublicSurveyView, {
    props: { publicId: PUBLIC_ID },
    queryClient: new QueryClient(),
  });
  return wrapper;
}

describe("Public survey page", () => {
  it("loads the published survey by its public id and shows its name", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ name: "Intake form", version_id: "Eq-OvCTLPC6Urz_TXE8eJ", content: {} }),
    );
    const wrapper = await mountView();

    expect(new URL(requests()[0]!.url).pathname).toBe(`/api/public/surveys/${PUBLIC_ID}`);
    expect(wrapper.find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(wrapper.text()).toContain("This survey has no questions yet.");
  });

  it("says the survey isn't available when it is missing or unpublished", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Survey not found" }, 404));
    const wrapper = await mountView();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toBe("This survey isn't available.");
  });

  it("shows the published task's text blocks", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        name: "Intake form",
        version_id: "Eq-OvCTLPC6Urz_TXE8eJ",
        content: { blocks: [{ id: "b1", type: "text", text: "Read the passage below." }] },
      }),
    );
    const wrapper = await mountView();

    expect(wrapper.find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(wrapper.findAll("p").map((p) => p.text())).toEqual(["Read the passage below."]);
    expect(wrapper.text()).not.toContain("no questions");
  });
});
