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
