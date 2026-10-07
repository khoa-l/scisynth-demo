<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";

const props = defineProps<{ id: string; type: string; params?: Record<string, ParamValue> }>();

const { nodes, edges } = useVueFlow(FLOW_ID);
const hovered = useHoverContainer();

const kind = computed(() => kindOf(props.type));
const topHeight = computed(() => containerTopHeight(kind.value));

// The same layout the canvas uses to place the nodes inside, so what is drawn here (the areas and
// the height of the whole node) always agrees with where those nodes are.
const layout = computed(() =>
  layoutFor({ id: props.id, data: { type: props.type } }, nodes.value, edges.value),
);

const isHovered = (zone: string) => hovered.value?.id === props.id && hovered.value.zone === zone;
</script>

<template>
  <!-- A container is a header, then (if it has inputs) a white section of fixed height with them,
       then the body with its zones. The negative margins run both out to the card's edges. -->
  <div
    v-if="topHeight"
    class="-mx-2.5 shrink-0 border-b bg-(--node-surface) px-2.5 py-2"
    :style="{ height: `${topHeight}px`, borderColor: catTint(45) }"
  >
    <!-- compact, like the Preview's seed (w-44): the fields do not stretch across the node -->
    <div class="w-44">
      <ParamInputs :id="id" :type="type" :params="params" class="mt-0!" />
    </div>
  </div>
  <!-- The body is translucent (tints of the node's color), so the canvas shows through it, and as
       tall as its zones need. A zone is an area for one kind of node: the nodes in it are separate
       canvas nodes drawn over it, stacked by FlowCanvas. A zone shows a hint while empty and
       lights up while a node that it takes is dragged over it. -->
  <div
    class="relative -mx-2.5 -mb-2.5 rounded-b-[2px]"
    :style="{ height: `${layout.bodyHeight}px`, backgroundColor: catTint(4) }"
  >
    <div
      v-for="box in layout.zones"
      :key="box.zone.id"
      class="absolute rounded-md border"
      :style="{
        left: `${box.left - 1}px`,
        top: `${box.top - HEADER_HEIGHT - topHeight}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        backgroundColor: catTint(isHovered(box.zone.id) ? 18 : 8),
        borderColor: catTint(isHovered(box.zone.id) ? 100 : 35),
        borderStyle: isHovered(box.zone.id) ? 'dashed' : 'solid',
      }"
    >
      <span
        class="absolute -top-2 left-2 bg-(--node-surface) px-1 text-[10px] leading-4 text-muted"
        >{{ box.zone.label }}</span
      >
      <span
        v-if="!box.members.length"
        class="absolute inset-0 flex items-center justify-center text-muted"
        >{{ box.zone.hint }}</span
      >
    </div>
  </div>
</template>
