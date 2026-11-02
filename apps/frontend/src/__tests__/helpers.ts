import { vi } from "vite-plus/test";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import type { Component } from "vue";
import { createMemoryHistory, createRouter, type RouteRecordRaw } from "vue-router";

import { projectsGetProjectQueryKey } from "../client/@tanstack/vue-query.gen";
import { routes } from "../router";

export const PROJECT_ID = "V11k9b8XeABv2ISddF304";

export const PROJECT = {
  id: PROJECT_ID,
  name: "Protein folding",
  created_at: "2026-11-02T00:00:00Z",
};

export const DATASET = {
  id: "Eq-OvCTLPC6Urz_TXE8eJ",
  name: "Raw reads",
  created_at: "2026-11-02T00:00:00Z",
};

export const SURVEY = {
  id: "pZtIo1NJJ5C48xzJcDG3F",
  name: "Intake form",
  created_at: "2026-11-02T00:00:00Z",
  content: {},
  public_id: null,
  published_version: null,
};

export const fetchMock = vi.fn<typeof fetch>();

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function requests() {
  return fetchMock.mock.calls.map((call) => call[0] as Request);
}

export function request(method: string) {
  return requests().find((request) => request.method === method)!;
}

export function respondTo(responses: Record<string, Response>, fallback: unknown) {
  fetchMock.mockImplementation(async (input) => {
    const method = (input as Request).method;
    return responses[method] ?? jsonResponse(fallback);
  });
}

export function testQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(
    projectsGetProjectQueryKey({ path: { project_id: PROJECT_ID } }),
    PROJECT,
  );
  return queryClient;
}

function stubRoutes(records: RouteRecordRaw[], components: Record<string, Component>) {
  return records.map((record): RouteRecordRaw => {
    const key = String(record.name ?? record.path);
    const stub = record.children
      ? { template: "<RouterView />" }
      : { template: "<p>{{ String($route.name) }} page</p>" };
    return {
      ...record,
      component: components[key] ?? stub,
      children: record.children && stubRoutes(record.children, components),
    } as RouteRecordRaw;
  });
}

export function testRouter(components: Record<string, Component> = {}) {
  return createRouter({ history: createMemoryHistory(), routes: stubRoutes(routes, components) });
}

export async function mountPage(
  component: Component,
  {
    props = {},
    path = "/",
    router = testRouter(),
    queryClient = testQueryClient(),
  }: {
    props?: Record<string, unknown>;
    path?: string;
    router?: ReturnType<typeof testRouter>;
    queryClient?: QueryClient;
  } = {},
) {
  await router.push(path);
  const wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
  });
  await flushPromises();
  return { wrapper, router, queryClient };
}

export function dialog() {
  return document.querySelector('[role="dialog"]');
}

export function alertDialog() {
  return document.querySelector('[role="alertdialog"]');
}

export function button(container: ParentNode | null, label: string) {
  return [...(container?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent?.trim() === label,
  )!;
}

export async function submitName(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]')!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  document.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  await flushPromises();
}
