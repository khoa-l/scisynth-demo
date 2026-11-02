<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import {
  authLogoutMutation,
  projectsCreateProjectMutation,
  projectsGetProjectsQueryKey,
} from "@/client/@tanstack/vue-query.gen";
import NameDialog from "@/components/NameDialog.vue";
import ProjectList from "@/components/ProjectList.vue";
import { Button } from "@/components/ui/button";
import { errorMessage, meQueryOptions } from "@/lib/auth";

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

const createOpen = ref(false);

const {
  mutate: createProject,
  isPending: isCreatingProject,
  error: createError,
  reset: resetCreate,
} = useMutation({
  ...projectsCreateProjectMutation(),
  onSuccess: async () => {
    createOpen.value = false;
    await queryClient.invalidateQueries({
      queryKey: projectsGetProjectsQueryKey(),
    });
  },
});

const createErrorMessage = computed(() =>
  createError.value ? errorMessage(createError.value) : null,
);

watch(createOpen, (isOpen) => {
  if (isOpen) resetCreate();
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
      <NameDialog
        v-model:open="createOpen"
        title="New project"
        description="Give your project a name."
        submit-label="Create"
        initial-name="untitled-project"
        :pending="isCreatingProject"
        :error="createErrorMessage"
        @submit="(name) => createProject({ body: { name } })"
      >
        <Button variant="outline" size="lg" class="mt-4 h-10 px-4">
          <Plus data-icon="inline-start" />
          Empty Project
        </Button>
      </NameDialog>
      <ProjectList class="mt-6" />
    </main>
  </div>
</template>
