<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import type { Node } from "@vue-flow/core";
import { computed, ref } from "vue";

import { datasetsGetDatasetOptions } from "@/client/@tanstack/vue-query.gen";
import NodeGraph from "@/components/NodeGraph.vue";
import NodeToolbar from "@/components/NodeToolbar.vue";
import ProjectItemPage from "@/components/ProjectItemPage.vue";
import type { NodeKind } from "@/lib/node-kinds";

const props = defineProps<{ projectId: string; datasetId: string }>();

const { data: dataset, isError } = useQuery(
  computed(() =>
    datasetsGetDatasetOptions({
      path: { project_id: props.projectId, dataset_id: props.datasetId },
    }),
  ),
);

const nodes = ref<Node[]>([]);

function addNode(kind: NodeKind) {
  const offset = 40 + nodes.value.length * 24;
  nodes.value = [
    ...nodes.value,
    {
      id: crypto.randomUUID(),
      type: kind.type,
      position: { x: offset, y: offset },
      data: { label: kind.label, kind: kind.name },
    },
  ];
}
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
    <template #left-toolbar>
      <NodeToolbar @add="addNode" />
    </template>
    <template #left>
      <NodeGraph v-model:nodes="nodes" />
    </template>
  </ProjectItemPage>
</template>
