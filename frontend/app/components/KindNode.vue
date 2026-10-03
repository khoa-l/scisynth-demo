<script setup lang="ts">
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";

const props = defineProps<NodeProps>();

const kind = computed(() => kindOf(props.data?.type));
const nodeType = computed(() => props.data?.type);

// A node with an expandedWidth (the Preview) is normal size until something is connected to it
const { edges } = useVueFlow(FLOW_ID);
const connected = computed(() => edges.value.some((e) => e.target === props.id));
// Nodes with a body (an axis list, parameters, a plot) get a coloured header over a neutral
// body. A node that expands (the Preview) has a body only once something is connected.
const body = computed(() =>
  kind.value.expandedWidth ? connected.value : nodeType.value === "domain" || !!kind.value.params,
);
const width = computed(() => (connected.value ? kind.value.expandedWidth : undefined));
</script>

<template>
  <!-- the category class sets the colours shared by the card's outline and the handles -->
  <div :class="`cat-${kind.category}`">
    <Handle v-if="kind.input !== false" type="target" :position="Position.Left" />
    <KindCard :type="data?.type" :label="label as string" :width="width" :body="body">
      <DomainAxes v-if="data?.type === 'domain'" :id="id" :axes="data.axes ?? []" />
      <PreviewPlot v-else-if="data?.type === 'preview'" :id="id" />
      <ParamInputs v-else-if="kind.params" :id="id" :type="data?.type" :params="data?.params" />
    </KindCard>
    <Handle v-if="kind.output !== false" type="source" :position="Position.Right" />
  </div>
</template>
