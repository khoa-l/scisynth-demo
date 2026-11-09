<script setup lang="ts">
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import { ArrowLeft } from "@lucide/vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Background } from "@vue-flow/background";
import {
  ConnectionLineType,
  Panel,
  VueFlow,
  connectionExists,
  useVueFlow,
  type ValidConnectionFunc,
  type ViewportTransform,
} from "@vue-flow/core";
import { useDebounceFn, useLocalStorage, useMounted, whenever } from "@vueuse/core";
import { computed, markRaw, nextTick, onBeforeUnmount, provide, ref, watch } from "vue";

import type { DatasetPublic, GroupPort } from "@/client";
import {
  datasetsGetDatasetQueryKey,
  datasetsUpdateDatasetMutation,
} from "@/client/@tanstack/vue-query.gen";
import DatasetGroup from "@/components/DatasetGroup.vue";
import DatasetNode from "@/components/DatasetNode.vue";
import GraphSettings from "@/components/GraphSettings.vue";
import GroupPortsNode from "@/components/GroupPortsNode.vue";
import SaveFailedAlert from "@/components/SaveFailedAlert.vue";
import {
  NODE_KIND_MIME,
  canConnect,
  defaultParams,
  findKind,
  nodeCatalogQuery,
} from "@/lib/dataset-nodes/catalog";
import {
  DATASET_NODE,
  flowNode,
  fromGraph,
  toGraph,
  type DatasetNodeData,
} from "@/lib/dataset-nodes/graph";
import {
  DATASET_GROUP,
  GROUP_INPUT,
  GROUP_OUTPUT,
  closeGroup,
  groupPortEdge,
  memberConnection,
  openGroup,
  standInId,
  withGroupEdges,
  type GroupData,
  type GroupSide,
} from "@/lib/dataset-nodes/groups";
import { GRAPH_SETTINGS_ID, LINE_TYPES, type LineType } from "@/lib/dataset-nodes/graph-settings";
import { autoLayout } from "@/lib/dataset-nodes/layout";
import { VIEWED_GROUP, VIEWED_NODE } from "@/lib/dataset-nodes/viewed";
import { saveKey, saveScope, useSaveFailed } from "@/lib/save-state";

const props = defineProps<{ projectId: string; dataset: DatasetPublic }>();

const nodeTypes = {
  [DATASET_NODE]: markRaw(DatasetNode),
  [DATASET_GROUP]: markRaw(DatasetGroup),
  [GROUP_INPUT]: markRaw(GroupPortsNode),
  [GROUP_OUTPUT]: markRaw(GroupPortsNode),
};
const tab =
  "flex items-center gap-1.5 rounded-b-lg border border-t-0 bg-background px-3 py-1 text-sm font-medium shadow-sm";
const lineStyle = { strokeWidth: 3 };
const lineType = useLocalStorage<LineType>(
  `dataset-builder-line-type:${props.dataset.id}`,
  ConnectionLineType.Bezier,
);
if (!LINE_TYPES.includes(lineType.value)) lineType.value = ConnectionLineType.Bezier;
const defaultEdgeOptions = computed(() => ({ type: lineType.value, style: lineStyle }));

provide(VIEWED_NODE, ref(null));
const viewedGroup = ref<string | null>(null);
provide(VIEWED_GROUP, viewedGroup);

const queryClient = useQueryClient();
const { data: catalog } = useQuery(nodeCatalogQuery);
const {
  addEdges,
  addNodes,
  edges,
  findNode,
  findEdge,
  fitView,
  getViewport,
  nodes,
  onConnect,
  onEdgesChange,
  onNodesInitialized,
  removeEdges,
  removeSelectedElements,
  screenToFlowCoordinate,
  setEdges,
  setNodes,
  setViewport,
  updateNode,
  vueFlowRef,
} = useVueFlow();

const graph = computed(() => toGraph(nodes.value, edges.value));
const serialized = computed(() => JSON.stringify(graph.value));
let loaded = false;
let lastSaved: string | undefined;

const mounted = useMounted();

whenever(
  () => mounted.value && catalog.value,
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
  { once: true },
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

watch(lineType, (type) => setEdges((current) => current.map((edge) => ({ ...edge, type }))));

const saveSoon = useDebounceFn(save, 500);
watch(serialized, () => saveSoon());
onBeforeUnmount(() => saveSoon.flush());

let mainViewport: ViewportTransform | undefined;

watch(viewedGroup, (groupId) => {
  removeSelectedElements();
  const view = groupId
    ? openGroup(nodes.value, edges.value, groupId)
    : closeGroup(nodes.value, edges.value);
  setNodes(view.nodes);
  setEdges(view.edges);
  if (groupId) {
    mainViewport = getViewport();
    const { off } = onNodesInitialized(() => {
      off();
      fitView({ maxZoom: 1 });
    });
  } else if (mainViewport) {
    setViewport(mainViewport);
  }
});

function setGroupPorts(side: GroupSide, update: (ports: GroupPort[]) => GroupPort[]) {
  updateNode<GroupData>(viewedGroup.value!, (group) => ({
    data: { ...group.data, [side]: update(group.data[side]) },
  }));
}

function exposePort(side: GroupSide, port: GroupPort) {
  const edge = groupPortEdge(side, port);
  if (findEdge(edge.id)) return;
  setGroupPorts(side, (ports) => [...ports, port]);
  addEdges(edge);
}

function hidePort(side: GroupSide, port: GroupPort) {
  setGroupPorts(side, (ports) =>
    ports.filter((exposed) => exposed.node !== port.node || exposed.port !== port.port),
  );
  const outside = edges.value.filter((edge) =>
    side === "inputs"
      ? edge.target === port.node &&
        edge.targetHandle === port.port &&
        findNode(edge.source)?.parentNode !== viewedGroup.value
      : edge.source === port.node &&
        edge.sourceHandle === port.port &&
        findNode(edge.target)?.parentNode !== viewedGroup.value,
  );
  if (outside.length) removeEdges(outside);
}

onConnect((connection) => {
  const { source, sourceHandle, target, targetHandle } = connection;
  if (source === GROUP_INPUT) return exposePort("inputs", { node: target, port: targetHandle! });
  if (target === GROUP_OUTPUT) return exposePort("outputs", { node: source, port: sourceHandle! });
  const real = memberConnection(connection, nodes.value);
  if (!connectionExists(real, edges.value)) {
    addEdges({ ...real, id: crypto.randomUUID() });
    setEdges(withGroupEdges(nodes.value, edges.value));
  }
});

onEdgesChange((changes) => {
  const removed = changes.flatMap((change) => (change.type === "remove" ? [change] : []));
  const ids = new Set(removed.map((change) => change.id));
  const real = edges.value.filter((edge) => ids.has(standInId(edge.id)));
  if (real.length) removeEdges(real);
  for (const { source, sourceHandle, target, targetHandle } of removed) {
    if (source === GROUP_INPUT) hidePort("inputs", { node: target, port: targetHandle! });
    if (target === GROUP_OUTPUT) hidePort("outputs", { node: source, port: sourceHandle! });
  }
});

const isValidConnection: ValidConnectionFunc = (connection) => {
  if (connection.source === GROUP_INPUT) return findNode(connection.target)?.type === DATASET_NODE;
  if (connection.target === GROUP_OUTPUT) return findNode(connection.source)?.type === DATASET_NODE;
  const real = memberConnection(connection, nodes.value);
  const kindOf = (id: string) => (findNode(id)?.data as DatasetNodeData | undefined)?.kind ?? "";
  return (
    !!catalog.value &&
    real.source !== real.target &&
    canConnect(catalog.value, {
      sourceKind: kindOf(real.source),
      sourcePort: real.sourceHandle,
      targetKind: kindOf(real.target),
      targetPort: real.targetHandle,
    })
  );
};

function layOut() {
  setNodes(autoLayout(nodes.value, edges.value, viewedGroup.value ?? undefined));
  nextTick(() => fitView({ maxZoom: 1 }));
}

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
    const title = vueFlowRef.value?.querySelector<HTMLElement>(
      `[data-id="${id}"] [data-slot="node-title"]`,
    );
    updateNode(id, (node) => ({
      position: {
        x: node.position.x - node.dimensions.width / 2,
        y: node.position.y - (title?.offsetHeight ?? 0) / 2,
      },
    }));
  });
  const point = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  const group = viewedGroup.value && findNode(viewedGroup.value);
  const node = flowNode(
    id,
    group ? { x: point.x - group.position.x, y: point.y - group.position.y } : point,
    { kind: kind.name, params: defaultParams(kind) },
  );
  addNodes(group ? { ...node, parentNode: group.id } : node);
}
</script>

<template>
  <VueFlow
    :aria-label="viewedGroup ? 'Group view' : 'Node graph'"
    class="bg-muted inset-shadow-sm"
    :node-types="nodeTypes"
    :default-edge-options="defaultEdgeOptions"
    :connection-line-type="lineType"
    :connection-line-style="lineStyle"
    :connection-radius="40"
    :is-valid-connection="isValidConnection"
    multi-selection-key-code="Shift"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <Background variant="lines" color="#dcdcdc" />
    <Panel v-if="viewedGroup" position="top-left" class="m-0">
      <button type="button" :class="tab" @click="viewedGroup = null">
        <ArrowLeft class="size-4" />
        Main graph
      </button>
    </Panel>
    <Panel position="top-center" class="m-0 flex flex-col items-center gap-2">
      <div v-if="viewedGroup" data-slot="group-view-title" :class="tab">Group</div>
      <SaveFailedAlert v-if="saveFailed" class="w-max first:mt-4" @retry="save" />
    </Panel>
    <Teleport defer :to="`#${GRAPH_SETTINGS_ID}`">
      <GraphSettings v-model:line-type="lineType" @auto-layout="layOut" />
    </Teleport>
  </VueFlow>
</template>
