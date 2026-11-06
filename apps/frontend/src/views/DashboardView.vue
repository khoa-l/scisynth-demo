<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import {
  projectsCreateProjectMutation,
  projectsGetProjectsQueryKey,
} from "@/client/@tanstack/vue-query.gen";
import NewItemButton from "@/components/NewItemButton.vue";
import ProjectList from "@/components/ProjectList.vue";

const queryClient = useQueryClient();

const { mutateAsync: createProject } = useMutation({
  ...projectsCreateProjectMutation(),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: projectsGetProjectsQueryKey() });
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-medium tracking-tight">Dashboard</h1>
    <NewItemButton
      label="Empty Project"
      title="New project"
      description="Give your project a name."
      initial-name="untitled-project"
      :create="(name) => createProject({ body: { name } })"
    />
    <ProjectList class="mt-6" />
  </div>
</template>
