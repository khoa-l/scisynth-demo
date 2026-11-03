import { useMutationState, type QueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

export function saveKey(resource: string, id: string) {
  return [`${resource}-save`, id];
}

export function saveScope(resource: string, id: string) {
  return { id: `${resource}:${id}` };
}

export function lastSaveFailed(queryClient: QueryClient, mutationKey: string[]) {
  const saves = queryClient.getMutationCache().findAll({ mutationKey });
  return saves[saves.length - 1]?.state.status === "error";
}

export function useSaveFailed(mutationKey: () => string[]) {
  const statuses = useMutationState(() => ({
    filters: { mutationKey: mutationKey() },
    select: (mutation) => mutation.state.status,
  }));
  return computed(() => statuses.value[statuses.value.length - 1] === "error");
}
