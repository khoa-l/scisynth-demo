<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import {
  datasetsCreateDatasetMutation,
  datasetsGetDatasetsQueryKey,
} from "@/client/@tanstack/vue-query.gen";
import DatasetList from "@/components/DatasetList.vue";
import NewItemButton from "@/components/NewItemButton.vue";
import ProjectPage from "@/components/ProjectPage.vue";

const props = defineProps<{ projectId: string }>();

const queryClient = useQueryClient();

const { mutateAsync: createDataset } = useMutation({
  ...datasetsCreateDatasetMutation(),
  onSuccess: () => {
    void queryClient.invalidateQueries({
      queryKey: datasetsGetDatasetsQueryKey({ path: { project_id: props.projectId } }),
    });
  },
});
</script>

<template>
  <ProjectPage :project-id="projectId">
    <NewItemButton
      label="New Dataset"
      title="New dataset"
      description="Give your dataset a name."
      initial-name="untitled-dataset"
      :create="(name) => createDataset({ path: { project_id: projectId }, body: { name } })"
    />
    <DatasetList class="mt-6" :project-id="projectId" />
  </ProjectPage>
</template>
