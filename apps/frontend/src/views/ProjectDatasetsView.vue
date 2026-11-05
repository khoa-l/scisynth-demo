<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import {
  datasetsCreateDatasetMutation,
  datasetsGetDatasetsQueryKey,
  datasetsUploadDatasetMutation,
} from "@/client/@tanstack/vue-query.gen";
import DatasetList from "@/components/DatasetList.vue";
import NewItemButton from "@/components/NewItemButton.vue";
import ProjectPage from "@/components/ProjectPage.vue";
import UploadDatasetButton from "@/components/UploadDatasetButton.vue";

const props = defineProps<{ projectId: string }>();

const queryClient = useQueryClient();

function refreshDatasets() {
  void queryClient.invalidateQueries({
    queryKey: datasetsGetDatasetsQueryKey({ path: { project_id: props.projectId } }),
  });
}

const { mutateAsync: createDataset } = useMutation({
  ...datasetsCreateDatasetMutation(),
  onSuccess: refreshDatasets,
});

const { mutateAsync: uploadDataset } = useMutation({
  ...datasetsUploadDatasetMutation(),
  onSuccess: refreshDatasets,
});
</script>

<template>
  <ProjectPage :project-id="projectId">
    <div class="flex gap-2">
      <NewItemButton
        label="New Dataset"
        title="New dataset"
        description="Give your dataset a name."
        initial-name="untitled-dataset"
        :create="(name) => createDataset({ path: { project_id: projectId }, body: { name } })"
      />
      <UploadDatasetButton
        :upload="(file) => uploadDataset({ path: { project_id: projectId }, body: file })"
      />
    </div>
    <DatasetList class="mt-6" :project-id="projectId" />
  </ProjectPage>
</template>
