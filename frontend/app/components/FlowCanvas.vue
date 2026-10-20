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
  setNodes,
  setEdges,
  addNodes,
  screenToFlowCoordinate,
  onNodesInitialized,
  fitView,
  findNode,
  addSelectedNodes,
} = useVueFlow(FLOW_ID);

// ---- loading the saved study

// A node needs its parent present first, so containers go first.
const initialNodes = [...props.initialNodes].sort(
  (a, b) => Number(!!a.parent) - Number(!!b.parent),
);

setNodes(
  initialNodes.map((n) => ({
    id: n.id,
    type: "kind",
    label: n.label,
    data: { type: n.type, ...n.data },
    position: { x: n.x, y: n.y },
    parentNode: n.parent ?? undefined,
  })),
);

// Drop connections to inputs that no longer exist (the Observer's old sampler port); the cleaned
// list is saved after loading.
const typeById = new Map(initialNodes.map((n) => [n.id, n.type]));
setEdges(
  props.initialEdges
    .filter(
      (e) =>
        !e.targetHandle ||
        e.targetHandle === "prev" ||
        kindOf(typeById.get(e.target)).ports?.some((port) => port.id === e.targetHandle),
    )
    // list links are straight
    .map((e) => (e.targetHandle === "prev" ? { ...e, type: "straight" } : e)),
);

// ---- behavior

const { isValidConnection } = useConnectionRules();
const { zoneAt, showHover, placeInList } = useContainers();
useGraphSave(props.studyId, { nodes: initialNodes, edges: props.initialEdges });

// Once nodes are measured, fit the view (or, from a task's `?node=`, that node, selected). Dropped
// nodes trigger this too, so only the first time.
const focus = useRoute().query.node;
let fitted = props.initialNodes.length === 0;
onNodesInitialized(() => {
  if (fitted) return;
  fitted = true;
  const node = typeof focus === "string" ? findNode(focus) : undefined;
  if (node) addSelectedNodes([node]);
  fitView({ maxZoom: 1.5, padding: node ? 1 : 0.1, nodes: node ? [node.id] : undefined });
});

// ---- dragging a new node in from the sidebar

const element = ref<HTMLElement>();
const { isDropTarget } = useDroppable({ id: "canvas", element });

useDragDropMonitor({
  onDragMove(event) {
    const kind = NODE_KINDS.find((k) => k.type === event.operation.source?.id);
    if (!kind) return;
    showHover(zoneAt(screenToFlowCoordinate(event.operation.position.current), kind.type));
  },
  onDragEnd(event) {
    showHover();
    const kind = NODE_KINDS.find((k) => k.type === event.operation.source?.id);
    if (event.canceled || event.operation.target?.id !== "canvas" || !kind) return;
    const pointer = screenToFlowCoordinate(event.operation.position.current);
    // dropped on a zone that takes it: it goes inside and the container places it
    const hit = zoneAt(pointer, kind.type);
    const id = newNodeId();
    addNodes({
      id,
      type: "kind",
      label: kind.label,
      data: { type: kind.type, ...(kind.params ? { params: paramsOf(kind) } : {}) },
      position: { x: pointer.x - nodeWidth(kind) / 2, y: pointer.y - NODE_SIZE.height / 2 },
      parentNode: hit?.container.id,
    });
    if (hit) placeInList(hit, id, pointer.y);
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
      <MiniMap node-color="var(--minimap-node)" mask-color="var(--minimap-mask)" />
    </VueFlow>
  </div>
</template>
