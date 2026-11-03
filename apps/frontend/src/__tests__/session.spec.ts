import { describe, it, expect } from "vite-plus/test";

import { flushPromises } from "@vue/test-utils";

import { projectsGetProjectsQueryKey } from "../client/@tanstack/vue-query.gen";
import { meQueryOptions } from "../lib/auth";
import { signOutWhenSessionEnds } from "../lib/session";
import { PROJECT, PROJECT_ID, testQueryClient, testRouter } from "./helpers";

const USER = { id: "Uakgb_J5m9g-0JDMbcJqL", email: "user@email.com" };
const UNAUTHORIZED = new Response(null, { status: 401 });

async function signedInAt(path: string) {
  const queryClient = testQueryClient();
  queryClient.setQueryData(meQueryOptions.queryKey, USER);
  queryClient.setQueryData(projectsGetProjectsQueryKey(), [PROJECT]);
  const router = testRouter();
  await router.push(path);
  return { queryClient, router, handle: signOutWhenSessionEnds(queryClient, router) };
}

describe("Session ending", () => {
  it("forgets the user and sends them to log in, coming back afterwards", async () => {
    const path = `/project/${PROJECT_ID}/dataset`;
    const { queryClient, router, handle } = await signedInAt(path);

    handle(UNAUTHORIZED, new Request("http://test/api/projects"));
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe(path);
    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toBeNull();
    expect(queryClient.getQueryData(projectsGetProjectsQueryKey())).toBeUndefined();
  });

  it("leaves failed sign-ins and public pages alone", async () => {
    const signingIn = await signedInAt(`/project/${PROJECT_ID}`);
    signingIn.handle(UNAUTHORIZED, new Request("http://test/api/auth/login"));

    const answering = await signedInAt("/s/Jx2k8LmN0pQr4StUv6WxY");
    answering.handle(UNAUTHORIZED, new Request("http://test/api/projects"));

    for (const { queryClient } of [signingIn, answering]) {
      expect(queryClient.getQueryData(meQueryOptions.queryKey)).toEqual(USER);
    }
    expect(signingIn.router.currentRoute.value.name).toBe("project");
    expect(answering.router.currentRoute.value.name).toBe("public-survey");
  });
});
