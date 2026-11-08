import { afterEach, beforeEach, vi } from "vite-plus/test";

import { enableAutoUnmount } from "@vue/test-utils";

import { client } from "../client/client.gen";
import { fetchMock } from "./helpers";

vi.mock("plotly.js-dist-min", () => ({
  default: { react: vi.fn(), relayout: vi.fn(), purge: vi.fn() },
}));

beforeEach(() => {
  fetchMock.mockReset();
  client.setConfig({ baseUrl: "http://test", fetch: fetchMock });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  client.setConfig({ baseUrl: undefined, fetch: undefined });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  localStorage.clear();
});

enableAutoUnmount(afterEach);
