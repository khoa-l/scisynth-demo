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

const caption = computed(() => {
  const t = table.value;
  if (!t) return "";
  const rows = `${t.rowCount} ${t.rowCount === 1 ? "row" : "rows"}`;
  return t.rowCount > t.rows.length ? `${rows}, the first ${t.rows.length} shown` : rows;
});

const COLUMN_MIN_WIDTH = 80;
const columns = computed(() => table.value?.columns ?? []);
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value.length}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`,
  minWidth: `${columns.value.length * COLUMN_MIN_WIDTH}px`,
}));
// the rows in view, plus half of the next one as a hint that there are more
const listHeight = `${DATA_PREVIEW.rowHeight * (DATA_PREVIEW.visible + 0.5)}px`;
</script>

<template>
  <!-- nothing is shown (and the node stays normal size) until a sampler is connected;
       nodrag/nowheel: let the list scroll without dragging or zooming the canvas -->
  <div v-if="samplerType" class="nodrag nowheel mt-2 flex flex-col gap-2 text-left">
    <div v-if="kindOf(samplerType).seeded" class="w-44">
      <ParamInputs :id="id" type="data" :params="own" />
    </div>
    <p v-if="status === 'waiting'" class="text-muted">{{ message }}</p>
    <p v-else-if="status === 'error'" class="text-error">
      Data unavailable{{ message ? `: ${message}` : "" }}
    </p>
    <template v-else-if="table">
      <!-- the table scrolls sideways when it has more columns than fit -->
      <div class="overflow-x-auto rounded-md bg-default ring ring-inset ring-default">
        <div :style="{ minWidth: gridStyle.minWidth }">
          <div
            class="grid h-6 items-center border-b border-default bg-accented text-highlighted"
            :style="gridStyle"
            role="row"
          >
            <span v-for="column in columns" :key="column" class="truncate px-2" :title="column">
              {{ column }}
            </span>
          </div>
          <UScrollArea
            v-slot="{ item }"
            :items="table.rows"
            :virtualize="{
              estimateSize: DATA_PREVIEW.rowHeight,
              skipMeasurement: true,
              overscan: 4,
            }"
            :style="{ height: listHeight }"
            aria-label="The first rows of the sampler's output"
          >
            <div
              class="grid items-center border-b border-default last:border-b-0"
              :style="{ ...gridStyle, height: `${DATA_PREVIEW.rowHeight}px` }"
              role="row"
            >
              <span
                v-for="(value, i) in item as (number | null)[]"
                :key="i"
                class="truncate px-2"
                :title="String(value)"
              >
                {{ formatCell(value) }}
              </span>
            </div>
          </UScrollArea>
        </div>
      </div>
      <p class="text-muted">{{ caption }}</p>
    </template>
    <p v-else-if="status === 'loading'" class="text-muted">Loading data…</p>
  </div>
</template>
