<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";

import {
  authLogoutMutation,
  projectsCreateProjectMutation,
  projectsGetProjectsQueryKey,
} from "@/client/@tanstack/vue-query.gen";
import ProjectList from "@/components/ProjectList.vue";
import { Button } from "@/components/ui/button";
import { meQueryOptions } from "@/lib/auth";

const router = useRouter();
const queryClient = useQueryClient();

const { mutate: logout, isPending: isLoggingOut } = useMutation({
  ...authLogoutMutation(),
  onSuccess: async () => {
    queryClient.clear();
    queryClient.setQueryData(meQueryOptions.queryKey, null);
    await router.push({ name: "login" });
  },
});

const { mutate: createProject, isPending: isCreatingProject } = useMutation({
  ...projectsCreateProjectMutation(),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsGetProjectsQueryKey() }),
});
</script>

<template>
  <div class="flex h-svh overflow-hidden bg-sidebar">
    <aside
      class="flex w-56 shrink-0 flex-col justify-end border-r bg-sidebar p-4 text-sidebar-foreground"
    >
      <Button variant="outline" class="w-full" :disabled="isLoggingOut" @click="logout({})">
        Log out
      </Button>
    </aside>
    <main
      class="relative z-10 min-w-0 flex-1 overflow-auto rounded-tl-xl bg-background p-6 shadow-lg"
    >
      <h1 class="text-2xl font-medium tracking-tight">Dashboard</h1>
      <Button
        variant="outline"
        size="lg"
        class="mt-4 h-10 px-4"
        :disabled="isCreatingProject"
        @click="createProject({})"
      >
        <Plus data-icon="inline-start" />
        Empty Project
      </Button>
      <ProjectList class="mt-6" />
    </main>
  </div>
</template>
