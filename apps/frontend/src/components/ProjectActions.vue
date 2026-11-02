<script setup lang="ts">
import { Pencil, Trash } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";

import type { ProjectPublic } from "@/client";
import {
  projectsGetProjectsQueryKey,
  projectsUpdateProjectMutation,
} from "@/client/@tanstack/vue-query.gen";
import NameDialog from "@/components/NameDialog.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { errorMessage } from "@/lib/auth";

const props = defineProps<{ project: ProjectPublic }>();

const queryClient = useQueryClient();
const renameOpen = ref(false);

const {
  mutate: rename,
  isPending,
  error,
  reset,
} = useMutation({
  ...projectsUpdateProjectMutation(),
  onSuccess: (project) => {
    queryClient.setQueryData<ProjectPublic[]>(projectsGetProjectsQueryKey(), (projects) =>
      projects?.map((existing) => (existing.id === project.id ? project : existing)),
    );
    renameOpen.value = false;
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: projectsGetProjectsQueryKey() }),
});

const renameError = computed(() => (error.value ? errorMessage(error.value) : null));

watch(renameOpen, (isOpen) => {
  if (isOpen) reset();
});

function onRename(name: string) {
  if (name === props.project.name) {
    renameOpen.value = false;
    return;
  }
  rename({ path: { project_id: props.project.id }, body: { name } });
}
</script>

<template>
  <ButtonGroup
    aria-label="Project actions"
    class="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-aria-expanded:opacity-100"
  >
    <NameDialog
      v-model:open="renameOpen"
      title="Rename project"
      description="Enter a new name for this project."
      :initial-name="project.name"
      :pending="isPending"
      :error="renameError"
      @submit="onRename"
    >
      <Button variant="outline" size="icon-sm" aria-label="Rename project">
        <Pencil />
      </Button>
    </NameDialog>
    <Button variant="outline" size="icon-sm" aria-label="Delete project">
      <Trash />
    </Button>
  </ButtonGroup>
</template>
