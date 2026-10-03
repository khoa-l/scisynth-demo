<script setup lang="ts">
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/vue";

const props = defineProps<{
  studyId: number;
  initialNodes: SavedNode[];
  initialEdges: SavedEdge[];
}>();

const {
  nodes,
  edges,
  setNodes,
  setEdges,
  addNodes,
  addEdges,
  removeEdges,
  findNode,
  onConnect,
  screenToFlowCoordinate,
  onNodesInitialized,
  fitView,
} = useVueFlow(FLOW_ID);

setNodes(
  props.initialNodes.map((n) => ({
    id: n.id,
    type: "kind",
    label: n.label,
    data: { type: n.type, ...n.data },
    position: { x: n.x, y: n.y },
  })),
);

setEdges(props.initialEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));

// Only connections that a node kind accepts (for now: defects into a Preview) are allowed
function isValidConnection(connection: { source: string; target: string }) {
  return canConnect(
    findNode(connection.source)?.data?.type,
    findNode(connection.target)?.data?.type,
  );
}

// An input takes one connection, so a new one replaces the old
onConnect((connection) => {
  removeEdges(edges.value.filter((e) => e.target === connection.target).map((e) => e.id));
  addEdges(connection);
});

// Once the saved nodes are measured, center the view on them, close up (padding 10%, zoomed in at most 150%).
// Nodes added later by dropping also trigger this event, so only fit the first time.
let fitted = props.initialNodes.length === 0;
onNodesInitialized(() => {
  if (fitted) return;
  fitted = true;
  fitView({ maxZoom: 1.5, padding: 0.1 });
});

// Save the study's canvas state (nodes and connections) whenever anything is added, moved or removed
const SAVE_DELAY_MS = 300;
let lastSaved = JSON.stringify({ nodes: props.initialNodes, edges: props.initialEdges });
let timer: ReturnType<typeof setTimeout> | undefined;

function snapshot() {
  return {
    nodes: nodes.value.map((n): SavedNode => {
      const { type, ...data } = n.data ?? {};
      return {
        id: n.id,
        type: String(type ?? ""),
        label: String(n.label ?? ""),
        x: n.position.x,
        y: n.position.y,
        data,
      };
    }),
    edges: edges.value.map((e): SavedEdge => ({ id: e.id, source: e.source, target: e.target })),
  };
}

async function save() {
  clearTimeout(timer);
  timer = undefined;
  const state = snapshot();
  const serialized = JSON.stringify(state);
  if (serialized === lastSaved) return;
  lastSaved = serialized;
  await $fetch(`/api/studies/${props.studyId}/graph`, { method: "PUT", body: state });
}

watch(
  () => JSON.stringify(snapshot()),
  () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  },
);

// Don't lose a pending save when leaving the page
onBeforeUnmount(() => {
  if (timer) save();
});

const element = ref<HTMLElement>();
const { isDropTarget } = useDroppable({ id: "canvas", element });

useDragDropMonitor({
  onDragEnd(event) {
    const kind = NODE_KINDS.find((k) => k.type === event.operation.source?.id);
    if (event.canceled || event.operation.target?.id !== "canvas" || !kind) return;
    const pointer = screenToFlowCoordinate(event.operation.position.current);
    addNodes({
      id: newNodeId(),
      type: "kind",
      label: kind.label,
      data: { type: kind.type, ...(kind.params ? { params: paramsOf(kind) } : {}) },
      position: {
        x: pointer.x - nodeWidth(kind) / 2,
        y: pointer.y - NODE_SIZE.height / 2,
      },
    });
  },
});
</script>

<template>
  <div ref="element" class="h-full w-full" :class="{ 'bg-elevated': isDropTarget }">
    <VueFlow :id="FLOW_ID" :min-zoom="0.1" :is-valid-connection="isValidConnection">
      <template #node-kind="nodeProps">
        <KindNode v-bind="nodeProps" />
      </template>
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>
