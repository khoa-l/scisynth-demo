<script setup lang="ts">
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";

const props = defineProps<NodeProps>();

const kind = computed(() => kindOf(props.data?.type));
const nodeType = computed(() => props.data?.type);

// In a container, the list links a node to its neighbors (bottom handle to the next, top handle from
// the one above), so it has only the side output.
const { edges, findNode, updateNodeInternals } = useVueFlow(FLOW_ID);
const contained = computed(() => !!findNode(props.id)?.parentNode);
// VueFlow measures handles only on resize, so re-measure when a node joins or leaves a container
watch(contained, () => updateNodeInternals([props.id]), { flush: "post" });

const hasPrev = computed(() =>
  edges.value.some((e) => e.target === props.id && e.targetHandle === "prev"),
);
const hasNext = computed(() =>
  edges.value.some((e) => e.source === props.id && e.sourceHandle === "next"),
);

// A node with expandedWidth is normal size until something connects to it
const connected = computed(() => edges.value.some((e) => e.target === props.id));
// Nodes with a body get a coloured header over a neutral body; an expanding node only once connected.
const body = computed(() =>
  kind.value.expandedWidth
    ? connected.value
    : nodeType.value === "domain" ||
      !!kind.value.params ||
      !!kind.value.ports ||
      !!kind.value.zones,
);
// A node a task uses as a source links to the task
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
  <!-- the category class colours the outline and handles -->
  <div :class="`cat-${kind.category}`">
    <Handle v-if="kind.input !== false && !contained" type="target" :position="Position.Left" />
    <!-- Keep the side output first: a connection saved without a handle name (every Preview one)
         takes the first handle of its kind. -->
    <Handle v-if="kind.output !== false" type="source" :position="Position.Right" />
    <!-- the list's links: shown only while in use; the sampler heads the list, so nothing above it -->
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
