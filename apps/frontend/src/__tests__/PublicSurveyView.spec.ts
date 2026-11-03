import { describe, it, expect } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";
import { flushPromises } from "@vue/test-utils";

import PublicSurveyView from "../views/PublicSurveyView.vue";
import { fetchMock, jsonResponse, mountPage, request, requests } from "./helpers";

const PUBLIC_ID = "Jx2k8LmN0pQr4StUv6WxY";
const VERSION_ID = "Eq-OvCTLPC6Urz_TXE8eJ";
const EMPTY = { name: "Intake form", version_id: VERSION_ID, content: {} };

async function mountView() {
  const { wrapper } = await mountPage(PublicSurveyView, {
    props: { publicId: PUBLIC_ID },
    queryClient: new QueryClient(),
  });
  return wrapper;
}

describe("Public survey page", () => {
  it("loads the published survey by its public id and shows its name", async () => {
    fetchMock.mockResolvedValue(jsonResponse(EMPTY));
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
        ...EMPTY,
        content: { blocks: [{ id: "b1", type: "text", text: "Read the passage below." }] },
      }),
    );
    const wrapper = await mountView();

    expect(wrapper.find('[data-slot="card-title"]').text()).toBe("Intake form");
    expect(wrapper.findAll("p").map((p) => p.text())).toEqual(["Read the passage below."]);
    expect(wrapper.text()).not.toContain("no questions");
  });

  describe("responding", () => {
    const SURVEY = {
      ...EMPTY,
      content: {
        blocks: [
          { id: "q1", type: "scale", text: "How clear was it?" },
          { id: "e1", type: "end" },
        ],
      },
    };

    function answerWith(submitted: () => Response) {
      fetchMock.mockImplementation(async (input) =>
        (input as Request).method === "POST" ? submitted() : jsonResponse(SURVEY),
      );
    }

    async function answerAndSubmit(wrapper: Awaited<ReturnType<typeof mountView>>) {
      await wrapper.findAll('[data-slot="toggle-group-item"]')[2]!.trigger("click");
      await wrapper.find('[data-slot="card-footer"] button').trigger("click");
      await flushPromises();
    }

    it("sends the answers for the published version and says thanks", async () => {
      answerWith(() => jsonResponse({ id: "r1", submitted_at: "2026-11-03T00:00:00Z" }, 201));
      const wrapper = await mountView();

      await answerAndSubmit(wrapper);

      expect(new URL(request("POST").url).pathname).toBe(
        `/api/public/surveys/${PUBLIC_ID}/responses`,
      );
      expect(await request("POST").json()).toEqual({ version_id: VERSION_ID, data: { q1: 3 } });
      expect(wrapper.find('[data-slot="card-title"]').text()).toBe("Intake form");
      expect(wrapper.text()).toContain("Thanks, your response has been recorded.");
      expect(wrapper.find("button").exists()).toBe(false);
    });

    it("keeps the answers and asks to try again when sending fails", async () => {
      answerWith(() => jsonResponse({ detail: "Server error" }, 500));
      const wrapper = await mountView();

      await answerAndSubmit(wrapper);

      const alert = wrapper.find('[role="alert"]');
      expect(alert.text()).toBe("Couldn't send your response. Please try again.");
      expect(alert.classes()).toContain("text-destructive");
      const three = wrapper.findAll('[data-slot="toggle-group-item"]')[2]!;
      expect(three.attributes("aria-pressed")).toBe("true");

      answerWith(() => jsonResponse({ id: "r1", submitted_at: "2026-11-03T00:00:00Z" }, 201));
      await wrapper.find('[data-slot="card-footer"] button').trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("Thanks, your response has been recorded.");
    });
  });
});
