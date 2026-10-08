<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";

const props = defineProps<{ id: string }>();

const { findNode } = useVueFlow(FLOW_ID);
const graph = useFlowGraph();

// This node's own parameters (the seed of a sampler that draws at random)
const own = computed(
  () => findNode(props.id)?.data?.params as Record<string, ParamValue> | undefined,
);

// What to ask the backend for: the sampler connected to this node's input, run
const request = computed(() => requestOf(graph.value, props.id));
const samplerType = computed(() => request.value?.type);
// Changes whenever the rows would change
const requestKey = computed(() => JSON.stringify(request.value ?? null));

const table = ref<DataRows>();

const { status, message, refresh } = useLatestRequest(requestKey, async (signal) => {
  const current = request.value;
  if (!current || current.waiting) {
    table.value = undefined;
    return { waiting: current?.waiting ?? "" };
  }
  table.value = await $fetch<DataRows>("/api/data", { method: "POST", body: current.body, signal });
});

onMounted(refresh);
watch(samplerType, refresh, { flush: "post" }); // connecting or swapping a sampler: show at once

// the header and the rows in view, plus half of the next one as a hint that there are more
const height = `${DATA_PREVIEW.rowHeight * (DATA_PREVIEW.visible + 1.5)}px`;
</script>

<template>
  <!-- nothing is shown (and the node stays normal size) until a sampler is connected;
       nodrag/nowheel: let the grid scroll without dragging or zooming the canvas -->
  <div v-if="samplerType" class="nodrag nowheel mt-2 flex flex-col gap-2 text-left">
    <div v-if="kindOf(samplerType).seeded" class="w-44">
      <ParamInputs :id="id" type="data" :params="own" />
    </div>
    <RequestNote :status="status" :message="message" what="Data" />
    <DataGrid v-if="table && status === 'idle'" :table="table" :height="height" />
  </div>
</template>
