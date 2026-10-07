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

// A node can only point at a parent that is already there, so containers go first. The saved
// order (and what counts as "unchanged" for saving) follows.
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

// Connections saved against an input that no longer exists (the Observer's old sampler port, now
// a zone) are dropped; the cleaned list is saved right after loading.
const typeById = new Map(initialNodes.map((n) => [n.id, n.type]));
setEdges(
  props.initialEdges
    .filter(
      (e) =>
        !e.targetHandle ||
        e.targetHandle === "prev" ||
        kindOf(typeById.get(e.target)).ports?.some((port) => port.id === e.targetHandle),
    )
    // the vertical links between neighbors in a list are straight
    .map((e) => (e.targetHandle === "prev" ? { ...e, type: "straight" } : e)),
);

// ---- behavior (each needs the study loaded above)

const { isValidConnection } = useConnectionRules();
const { zoneAt, showHover, placeInList } = useContainers();
useGraphSave(props.studyId, { nodes: initialNodes, edges: props.initialEdges });

// Once the saved nodes are measured, center the view on them, close up (padding 10%, zoomed in at
// most 150%), or, coming from a task (`?node=`), on the node it uses, selected. Nodes added later
// by dropping also trigger this event, so only fit the first time.
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
    // dropped on a zone that takes it (a defect on the stages list, a sampler on the sampler
    // zone): the node goes inside, and the container's layout puts it in its place
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
