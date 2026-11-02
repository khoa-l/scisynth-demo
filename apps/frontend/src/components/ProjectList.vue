<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import type { ProjectPublic } from "@/client";
import {
  projectsDeleteProjectMutation,
  projectsGetProjectsOptions,
  projectsGetProjectsQueryKey,
  projectsUpdateProjectMutation,
} from "@/client/@tanstack/vue-query.gen";
import ItemList from "@/components/ItemList.vue";

const queryClient = useQueryClient();
const key = projectsGetProjectsQueryKey();

const { data: projects, isPending, isError } = useQuery(projectsGetProjectsOptions());

const { mutateAsync: update } = useMutation({
  ...projectsUpdateProjectMutation(),
  onSuccess: (updated) =>
    queryClient.setQueryData<ProjectPublic[]>(key, (list) =>
      list?.map((project) => (project.id === updated.id ? updated : project)),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key });
  },
});

const { mutateAsync: remove } = useMutation({
  ...projectsDeleteProjectMutation(),
  onSuccess: (_, { path }) =>
    queryClient.setQueryData<ProjectPublic[]>(key, (list) =>
      list?.filter((project) => project.id !== path.project_id),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key });
  },
});
</script>

<template>
  <ItemList
    :items="projects"
    :is-pending="isPending"
    :is-error="isError"
    noun="project"
    plural="projects"
    :to="(project) => ({ name: 'project', params: { projectId: project.id } })"
    :rename="(project, name) => update({ path: { project_id: project.id }, body: { name } })"
    :remove="(project) => remove({ path: { project_id: project.id } })"
  />
</template>
