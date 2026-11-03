<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { datasetsGetDatasetOptions } from "@/client/@tanstack/vue-query.gen";
import DatasetNodePalette from "@/components/DatasetNodePalette.vue";
import DatasetBuilder from "@/components/DatasetBuilder.vue";
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
          <DatasetBuilder
            v-if="dataset"
            :key="dataset.id"
            :project-id="projectId"
            :dataset="dataset"
          />
        </div>
        <div role="group" aria-label="Dataset details" class="min-h-0 flex-1">
          <DatasetNodePalette />
        </div>
      </div>
    </template>
    <template #right>
      <div class="grid h-full grid-rows-[2fr_1fr] divide-y bg-background">
        <div />
        <div />
      </div>
    </template>
  </ProjectItemPage>
</template>
