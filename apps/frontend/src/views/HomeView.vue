<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";

import { authLogoutMutation } from "@/client/@tanstack/vue-query.gen";
import { Button } from "@/components/ui/button";
import { meQueryOptions } from "@/lib/auth";

const router = useRouter();
const queryClient = useQueryClient();

const { mutate: logout, isPending } = useMutation({
  ...authLogoutMutation(),
  onSuccess: async () => {
    queryClient.clear();
    queryClient.setQueryData(meQueryOptions.queryKey, null);
    await router.push({ name: "login" });
  },
});
</script>

<template>
  <div class="flex h-svh flex-col">
    <header class="h-14 shrink-0 border-b"></header>
    <div class="flex min-h-0 flex-1">
      <aside class="flex w-64 shrink-0 flex-col justify-end border-r p-4">
        <Button variant="outline" class="w-full" :disabled="isPending" @click="logout({})">
          Log out
        </Button>
      </aside>
      <main class="min-w-0 flex-1 overflow-auto"></main>
    </div>
  </div>
</template>
