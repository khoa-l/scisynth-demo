<script setup lang="ts">
import { ChevronDown, Download, Table, Workflow } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { datasetsGetDatasetOptions } from "@/client/@tanstack/vue-query.gen";
import DatasetNodePalette from "@/components/DatasetNodePalette.vue";
import DatasetBuilder from "@/components/DatasetBuilder.vue";
import ProjectItemPage from "@/components/ProjectItemPage.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VIEWED_PREVIEW_ID } from "@/lib/dataset-nodes/viewed";

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
    :back-to="{ name: 'project-datasets', params: { projectId } }"
    back-label="Datasets"
    columns="grid-cols-[2fr_1fr]"
  >
    <template #actions>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="lg" class="h-10 px-4" :disabled="!dataset">
            <Download data-icon="inline-start" />
            Download
            <ChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>
            <Workflow />
            Graph
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Table />
            Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
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
        <div
          :id="VIEWED_PREVIEW_ID"
          role="region"
          aria-label="Viewed node"
          class="flex min-h-0 items-center justify-center p-4 @container-size"
        />
        <div />
      </div>
    </template>
  </ProjectItemPage>
</template>
