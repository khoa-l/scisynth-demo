import { afterEach, beforeEach, vi } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import { client } from "../client/client.gen";

export const fetchMock = vi.fn<typeof fetch>();

export function mockApi() {
  beforeEach(() => {
    fetchMock.mockReset();
    client.setConfig({ baseUrl: "http://test", fetch: fetchMock });
  });

  afterEach(() => {
    client.setConfig({ baseUrl: undefined, fetch: undefined });
    document.body.innerHTML = "";
  });
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function requests() {
  return fetchMock.mock.calls.map((call) => call[0] as Request);
}

export function dialog() {
  return document.querySelector('[role="dialog"]');
}

export async function submitName(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]')!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  document.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  await flushPromises();
}
