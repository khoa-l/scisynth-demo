<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { datasetsGetDatasetOptions } from "@/client/@tanstack/vue-query.gen";
import NodeCatalog from "@/components/NodeCatalog.vue";
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
      <div class="flex h-full flex-col">
        <div class="min-h-0 flex-3">
          <NodeGraph />
        </div>
        <div role="group" aria-label="Node details" class="min-h-0 flex-1">
          <NodeCatalog />
        </div>
      </div>
    </template>
  </ProjectItemPage>
</template>
