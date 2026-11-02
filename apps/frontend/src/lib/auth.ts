import { queryOptions } from "@tanstack/vue-query";

import { authMe, type UserPublic } from "@/client";

export const meQueryOptions = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async (): Promise<UserPublic | null> => {
    const { data } = await authMe();
    return data ?? null;
  },
  staleTime: Infinity,
});

export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  if (error && typeof error === "object" && "detail" in error && typeof error.detail === "string") {
    return error.detail;
  }
  return fallback;
}
