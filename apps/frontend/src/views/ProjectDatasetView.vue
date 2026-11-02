<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { datasetsGetDatasetOptions } from "@/client/@tanstack/vue-query.gen";
import NodeGraph from "@/components/NodeGraph.vue";
import ProjectItemPage from "@/components/ProjectItemPage.vue";

const props = defineProps<{ projectId: string; datasetId: string }>();

const { data: dataset, isError } = useQuery(
  computed(() =>
    datasetsGetDatasetOptions({
      path: { project_id: props.projectId, dataset_id: props.datasetId },
    }),
  ),
);
</script>

<template>
  <ProjectItemPage
    :project-id="projectId"
    noun="dataset"
    :item-name="dataset?.name"
    :is-error="isError"
    back-to="project-datasets"
    back-label="Datasets"
  >
    <template #left>
      <NodeGraph />
    </template>
  </ProjectItemPage>
</template>
