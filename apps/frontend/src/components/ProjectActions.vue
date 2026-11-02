<script setup lang="ts">
import { Pencil, Trash } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";

import type { ProjectPublic } from "@/client";
import {
  projectsDeleteProjectMutation,
  projectsGetProjectsQueryKey,
  projectsUpdateProjectMutation,
} from "@/client/@tanstack/vue-query.gen";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import NameDialog from "@/components/NameDialog.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { errorMessage } from "@/lib/auth";

const props = defineProps<{ project: ProjectPublic }>();

const queryClient = useQueryClient();
const projectsKey = projectsGetProjectsQueryKey();

const renameOpen = ref(false);
const deleteOpen = ref(false);

const {
  mutate: rename,
  isPending: isRenaming,
  error: renameError,
  reset: resetRename,
} = useMutation({
  ...projectsUpdateProjectMutation(),
  onSuccess: (project) => {
    queryClient.setQueryData<ProjectPublic[]>(projectsKey, (projects) =>
      projects?.map((existing) => (existing.id === project.id ? project : existing)),
    );
    renameOpen.value = false;
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
});

const {
  mutate: remove,
  isPending: isDeleting,
  error: deleteError,
  reset: resetDelete,
} = useMutation({
  ...projectsDeleteProjectMutation(),
  onSuccess: () => {
    deleteOpen.value = false;
    queryClient.setQueryData<ProjectPublic[]>(projectsKey, (projects) =>
      projects?.filter((existing) => existing.id !== props.project.id),
    );
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
});

const renameErrorMessage = computed(() =>
  renameError.value ? errorMessage(renameError.value) : null,
);
const deleteErrorMessage = computed(() =>
  deleteError.value ? errorMessage(deleteError.value) : null,
);

watch(renameOpen, (isOpen) => {
  if (isOpen) resetRename();
});

watch(deleteOpen, (isOpen) => {
  if (isOpen) resetDelete();
});

function onRename(name: string) {
  if (name === props.project.name) {
    renameOpen.value = false;
    return;
  }
  rename({ path: { project_id: props.project.id }, body: { name } });
}

function onDelete() {
  remove({ path: { project_id: props.project.id } });
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
      :pending="isRenaming"
      :error="renameErrorMessage"
      @submit="onRename"
    >
      <Button variant="outline" size="icon-sm" aria-label="Rename project">
        <Pencil />
      </Button>
    </NameDialog>
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete project?"
      :description="`“${project.name}” will be permanently deleted. This can't be undone.`"
      confirm-label="Delete"
      destructive
      :pending="isDeleting"
      :error="deleteErrorMessage"
      @confirm="onDelete"
    >
      <Button variant="outline" size="icon-sm" aria-label="Delete project">
        <Trash />
      </Button>
    </ConfirmDialog>
  </ButtonGroup>
</template>
