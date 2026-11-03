<script setup lang="ts">
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Background } from "@vue-flow/background";
import {
  Panel,
  VueFlow,
  connectionExists,
  useVueFlow,
  type ValidConnectionFunc,
} from "@vue-flow/core";
import { useDebounceFn, whenever } from "@vueuse/core";
import { computed, markRaw, onBeforeUnmount, watch } from "vue";

import type { DatasetPublic } from "@/client";
import {
  datasetsGetDatasetQueryKey,
  datasetsUpdateDatasetMutation,
} from "@/client/@tanstack/vue-query.gen";
import DatasetNode from "@/components/DatasetNode.vue";
import SaveFailedAlert from "@/components/SaveFailedAlert.vue";
import {
  NODE_KIND_MIME,
  canConnect,
  defaultParams,
  findKind,
  nodeCatalogQuery,
  type DatasetNodeData,
} from "@/lib/dataset-nodes/catalog";
import { DATASET_NODE, flowNode, fromGraph, toGraph } from "@/lib/dataset-nodes/graph";
import { saveKey, saveScope, useSaveFailed } from "@/lib/save-state";

const props = defineProps<{ projectId: string; dataset: DatasetPublic }>();

const nodeTypes = { [DATASET_NODE]: markRaw(DatasetNode) };
const defaultEdgeOptions = { style: { strokeWidth: 2 } };

const queryClient = useQueryClient();
const { data: catalog } = useQuery(nodeCatalogQuery);
const {
  addEdges,
  addNodes,
  edges,
  fitView,
  nodes,
  onConnect,
  onNodesInitialized,
  screenToFlowCoordinate,
  setEdges,
  setNodes,
  updateNode,
} = useVueFlow();

const graph = computed(() => toGraph(nodes.value, edges.value));
const serialized = computed(() => JSON.stringify(graph.value));
let loaded = false;
let lastSaved: string | undefined;

whenever(
  catalog,
  (value) => {
    const saved = fromGraph(props.dataset.content, value);
    setNodes(saved.nodes);
    setEdges(saved.edges);
    lastSaved = JSON.stringify(toGraph(saved.nodes, saved.edges));
    loaded = true;
    if (saved.nodes.length) {
      const { off } = onNodesInitialized(() => {
        off();
        fitView({ maxZoom: 1 });
      });
    }
  },
  { immediate: true, once: true },
);

const { mutate } = useMutation(() => ({
  ...datasetsUpdateDatasetMutation(),
  mutationKey: saveKey("dataset", props.dataset.id),
  scope: saveScope("dataset", props.dataset.id),
  onSuccess: (dataset) =>
    queryClient.setQueryData(
      datasetsGetDatasetQueryKey({
        path: { project_id: props.projectId, dataset_id: dataset.id },
      }),
      dataset,
    ),
  onError: () => {
    lastSaved = undefined;
  },
}));
const saveFailed = useSaveFailed(() => saveKey("dataset", props.dataset.id));

function save() {
  if (!loaded || serialized.value === lastSaved) return;
  lastSaved = serialized.value;
  mutate({
    path: { project_id: props.projectId, dataset_id: props.dataset.id },
    body: { content: graph.value },
  });
}

const saveSoon = useDebounceFn(save, 500);
watch(serialized, () => saveSoon());
onBeforeUnmount(() => saveSoon.flush());

onConnect((connection) => {
  if (!connectionExists(connection, edges.value)) {
    addEdges({ ...connection, id: crypto.randomUUID() });
  }
});

const isValidConnection: ValidConnectionFunc = (connection, { sourceNode, targetNode }) =>
  !!catalog.value &&
  connection.source !== connection.target &&
  canConnect(catalog.value, {
    sourceKind: (sourceNode.data as DatasetNodeData).kind,
    sourcePort: connection.sourceHandle,
    targetKind: (targetNode.data as DatasetNodeData).kind,
    targetPort: connection.targetHandle,
  });

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes(NODE_KIND_MIME)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function onDrop(event: DragEvent) {
  const name = event.dataTransfer?.getData(NODE_KIND_MIME) ?? "";
  const kind = catalog.value && findKind(catalog.value, name);
  if (!kind) return;
  event.preventDefault();
  const id = crypto.randomUUID();
  const { off } = onNodesInitialized(() => {
    off();
    updateNode(id, (node) => ({
      position: {
        x: node.position.x - node.dimensions.width / 2,
        y: node.position.y - node.dimensions.height / 2,
      },
    }));
  });
  addNodes(
    flowNode(id, screenToFlowCoordinate({ x: event.clientX, y: event.clientY }), {
      kind: kind.name,
      params: defaultParams(kind),
    }),
  );
}
</script>

<template>
  <VueFlow
    aria-label="Node graph"
    class="bg-muted inset-shadow-sm"
    :node-types="nodeTypes"
    :default-edge-options="defaultEdgeOptions"
    :is-valid-connection="isValidConnection"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <Background variant="lines" color="#dcdcdc" />
    <Panel v-if="saveFailed" position="top-center" class="rounded-lg bg-background">
      <SaveFailedAlert @retry="save" />
    </Panel>
  </VueFlow>
</template>
