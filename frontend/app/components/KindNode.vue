<script setup lang="ts">
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";

const props = defineProps<NodeProps>();

const kind = computed(() => kindOf(props.data?.type));
const nodeType = computed(() => props.data?.type);

// A node in a container (a sampler or defect in the Observer) is connected to its neighbors
// vertically by the container's list, not by hand: its bottom handle to the next node, and (a
// defect) its top handle to the one above. It has no side input, only the side output, which
// still feeds a Preview or a Plot.
const { edges, findNode, updateNodeInternals } = useVueFlow(FLOW_ID);
const contained = computed(() => !!findNode(props.id)?.parentNode);
// VueFlow measures where a node's handles are only when the node is resized, so when a node joins or
// leaves a container (its handles change) it has to be told to measure again; otherwise connections
// keep going to the handles it used to have (a defect taken out of a list was connected at its top)
watch(contained, () => updateNodeInternals([props.id]), { flush: "post" });

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
// A node a task uses as a source links to that task
const route = useRoute();
const tasks = inject(NODE_TASKS, {})[props.id] ?? [];
const link = tasks.length
  ? {
      to: `/admin/studies/${route.params.id}/tasks?task=${tasks[0]}`,
      title: tasks.length === 1 ? "Used in a task" : `Used in ${tasks.length} tasks`,
    }
  : undefined;

const width = computed(() => (connected.value ? kind.value.expandedWidth : undefined));
</script>

<template>
  <!-- the category class sets the colours shared by the card's outline and the handles -->
  <div :class="`cat-${kind.category}`">
    <Handle v-if="kind.input !== false && !contained" type="target" :position="Position.Left" />
    <!-- The side output comes before the list's links on purpose: a connection saved without a
         handle name (every Preview connection) attaches to the first handle of its kind, in this
         order, so it must be the side output, not the "next" handle at the bottom. -->
    <Handle v-if="kind.output !== false" type="source" :position="Position.Right" />
    <!-- the vertical links of the container's list: drawn only while they are in use, never started
         by hand. The sampler heads the list, so it has nothing above it. -->
    <template v-if="contained">
      <Handle
        v-if="isDefectKind(data?.type)"
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
      :link="link"
    >
      <ContainerBody v-if="kind.zones" :id="id" :type="data?.type" :params="data?.params" />
      <DomainAxes v-else-if="data?.type === 'domain'" :id="id" :axes="data.axes ?? []" />
      <DataTable v-else-if="data?.type === 'data'" :id="id" />
      <NodePlot
        v-else-if="nodeType === 'preview' || nodeType === 'plot'"
        :id="id"
        :type="nodeType"
      />
      <ParamInputs v-else-if="kind.params" :id="id" :type="data?.type" :params="data?.params" />
    </KindCard>
  </div>
</template>
