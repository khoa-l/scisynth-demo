<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";

import {
  projectsCreateProjectMutation,
  projectsGetProjectsQueryKey,
} from "@/client/@tanstack/vue-query.gen";
import NameDialog from "@/components/NameDialog.vue";
import ProjectList from "@/components/ProjectList.vue";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/auth";

const queryClient = useQueryClient();

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
</template>
