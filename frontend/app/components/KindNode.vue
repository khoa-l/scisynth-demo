<script setup lang="ts">
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";

const props = defineProps<NodeProps>();

const kind = computed(() => kindOf(props.data?.type));
const nodeType = computed(() => props.data?.type);

// A defect in a container's list (the Observer's stages) is connected to its neighbors vertically
// (top handle to the one above, bottom handle to the one below), by the list, not by hand. It has
// no side input any more, only the side output, which still feeds a Preview.
const { edges, findNode } = useVueFlow(FLOW_ID);
const listed = computed(() => isDefectKind(props.data?.type) && !!findNode(props.id)?.parentNode);
const hasPrev = computed(() =>
  edges.value.some((e) => e.target === props.id && e.targetHandle === "prev"),
);
const hasNext = computed(() =>
  edges.value.some((e) => e.source === props.id && e.sourceHandle === "next"),
);

// A node with an expandedWidth (the Preview) is normal size until something is connected to it
const connected = computed(() => edges.value.some((e) => e.target === props.id));
// Nodes with a body (an axis list, parameters, a plot) get a coloured header over a neutral
// body. A node that expands (the Preview) has a body only once something is connected.
const body = computed(() =>
  kind.value.expandedWidth
    ? connected.value
    : nodeType.value === "domain" ||
      !!kind.value.params ||
      !!kind.value.ports ||
      !!kind.value.zones,
);
const width = computed(() => (connected.value ? kind.value.expandedWidth : undefined));
</script>

<template>
  <!-- the category class sets the colours shared by the card's outline and the handles -->
  <div :class="`cat-${kind.category}`">
    <Handle v-if="kind.input !== false && !listed" type="target" :position="Position.Left" />
    <!-- The side output comes before the list's links on purpose: a connection saved without a
         handle name (every Preview connection) attaches to the first handle of its kind, in this
         order, so it must be the side output, not the "next" handle at the bottom. -->
    <Handle v-if="kind.output !== false" type="source" :position="Position.Right" />
    <!-- the vertical links of a list item: drawn only while they are in use, never started by hand -->
    <template v-if="listed">
      <Handle
        id="prev"
        type="target"
        :position="Position.Top"
        :connectable="false"
        :style="{ opacity: hasPrev ? 1 : 0 }"
      />
      <Handle
        id="next"
        type="source"
        :position="Position.Bottom"
        :connectable="false"
        :style="{ opacity: hasNext ? 1 : 0 }"
      />
    </template>
    <KindCard
      :type="data?.type"
      :label="label as string"
      :width="width"
      :container="!!kind.zones"
      :body="body"
    >
      <ContainerBody v-if="kind.zones" :id="id" :type="data?.type" :params="data?.params" />
      <DomainAxes v-else-if="data?.type === 'domain'" :id="id" :axes="data.axes ?? []" />
      <PreviewPlot v-else-if="data?.type === 'preview'" :id="id" />
      <ParamInputs v-else-if="kind.params" :id="id" :type="data?.type" :params="data?.params" />
    </KindCard>
  </div>
</template>
