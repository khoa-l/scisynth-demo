<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";

// Shares the canvas's flow store: the list mirrors the nodes, and selection is shared
const { nodes, removeNodes, addSelectedNodes, findNode, setCenter, getViewport, dimensions } =
  useVueFlow(FLOW_ID);

// slow in, slow out
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// Selecting a row selects the node and glides the canvas to it at the current zoom; longer trips
// take longer (400 to 900 ms), so the on-screen speed stays similar.
function select(id: string) {
  const node = findNode(id);
  if (!node) return;
  addSelectedNodes([node]);
  const { x, y } = node.computedPosition;
  const target = { x: x + node.dimensions.width / 2, y: y + node.dimensions.height / 2 };
  const view = getViewport();
  const distance =
    Math.hypot(
      target.x - (dimensions.value.width / 2 - view.x) / view.zoom,
      target.y - (dimensions.value.height / 2 - view.y) / view.zoom,
    ) * view.zoom; // screen pixels
  setCenter(target.x, target.y, {
    zoom: view.zoom,
    duration: Math.min(900, 400 + distance * 0.5),
    ease: easeInOutCubic,
  });
}

// Selecting a node on the canvas scrolls its row into view
const list = ref<HTMLElement>();
const selectedId = computed(() => nodes.value.find((n) => n.selected)?.id);
watch(
  selectedId,
  (id) => {
    if (id) list.value?.querySelector(`[data-node="${id}"]`)?.scrollIntoView({ block: "nearest" });
  },
  { flush: "post" },
);
</script>

<template>
  <ul ref="list" class="flex flex-col gap-2 p-1">
    <li
      v-for="node in nodes"
      :key="node.id"
      :data-node="node.id"
      class="side-item node-row flex items-center justify-between gap-2 rounded-md border border-default py-1 pl-3 pr-1"
      :class="[`cat-${kindOf(node.data?.type).category}`, { selected: node.selected }]"
      :style="{ backgroundColor: 'var(--cat-bg)' }"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        :aria-pressed="node.selected"
        @click="select(node.id)"
      >
        <UIcon
          :name="kindOf(node.data?.type).icon"
          class="size-4 shrink-0"
          :style="{ color: 'var(--cat-fg)' }"
        />
        <span class="truncate">{{ node.label }}</span>
      </button>
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        :aria-label="`Delete ${node.label}`"
        class="shrink-0"
        @click="removeNodes(node.id)"
      />
    </li>
  </ul>
</template>
