import type { QueryClient } from "@tanstack/vue-query";
import type { Router } from "vue-router";

import { meQueryOptions } from "@/lib/auth";

export function signOutWhenSessionEnds(queryClient: QueryClient, router: Router) {
  return (response: Response, request: Request) => {
    const route = router.currentRoute.value;
    if (
      response.status === 401 &&
      !new URL(request.url).pathname.startsWith("/api/auth/") &&
      route.meta.requiresAuth &&
      queryClient.getQueryData(meQueryOptions.queryKey)
    ) {
      queryClient.clear();
      queryClient.setQueryData(meQueryOptions.queryKey, null);
      void router.push({ name: "login", query: { redirect: route.fullPath } });
    }
    return response;
  };
}
