import { afterEach, beforeEach, vi } from "vite-plus/test";

import { enableAutoUnmount } from "@vue/test-utils";

import { client } from "../client/client.gen";
import { fetchMock } from "./helpers";

beforeEach(() => {
  fetchMock.mockReset();
  client.setConfig({ baseUrl: "http://test", fetch: fetchMock });
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
});

enableAutoUnmount(afterEach);
