<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { Handle, Position, useNodeConnections, useVueFlow, type NodeProps } from "@vue-flow/core";
import { computed } from "vue";

import DatasetNodeParams from "@/components/DatasetNodeParams.vue";
import DatasetNodeThumbnail from "@/components/DatasetNodeThumbnail.vue";
import {
  findKind,
  nodeCatalogQuery,
  requiredConnections,
  type DatasetNodeData,
} from "@/lib/dataset-nodes/catalog";
import { nodePreviewRequest, toGraph } from "@/lib/dataset-nodes/graph";
import { groupBackground } from "@/lib/dataset-nodes/group-colors";
import type { ParamValue, PortDef } from "@/lib/dataset-nodes/types";

const props = defineProps<NodeProps<DatasetNodeData>>();

const PREVIEWABLE_GENERATORS = new Set(["GaussianField"]);
const PREVIEWED_FROM_INPUTS = new Set(["composite", "sampler", "defect", "transform"]);

const { data: catalog } = useQuery(nodeCatalogQuery);
const kind = computed(() => catalog.value && findKind(catalog.value, props.data.kind));

const { edges, nodes, updateNodeData } = useVueFlow();
const incoming = useNodeConnections({ handleType: "target" });

function connectionCount(port: PortDef) {
  return incoming.value.filter((connection) => connection.targetHandle === port.id).length;
}

const showsThumbnail = computed(() => {
  if (!kind.value) return false;
  if (PREVIEWED_FROM_INPUTS.has(kind.value.group)) {
    return kind.value.inputs.every((port) => connectionCount(port) >= requiredConnections(port));
  }
  return PREVIEWABLE_GENERATORS.has(kind.value.name);
});

const previewRequest = computed(() =>
  nodePreviewRequest(toGraph(nodes.value, edges.value), props.id),
);

function setParam(name: string, value: ParamValue) {
  updateNodeData<DatasetNodeData>(props.id, { params: { ...props.data.params, [name]: value } });
}
</script>

<template>
  <div
    v-if="kind"
    class="relative w-64 rounded-lg border bg-background text-sm shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <DatasetNodeThumbnail
      v-if="showsThumbnail"
      :label="kind.label"
      :request="previewRequest"
      class="absolute -inset-x-px bottom-full mb-2"
    />
    <div
      data-slot="node-title"
      class="rounded-t-[calc(var(--radius-lg)-1px)] border-b px-3 py-2 font-medium"
      :style="{ background: groupBackground(kind.group) }"
    >
      {{ kind.label }}
    </div>
    <div class="flex flex-col gap-1 py-2">
      <div v-for="port in kind.inputs" :key="port.id" class="relative px-3 text-muted-foreground">
        <Handle
          :id="port.id"
          type="target"
          :position="Position.Left"
          class="size-2.5!"
          :connectable="port.multiple ? true : 'single'"
        />
        {{ port.label }}
        <span
          v-if="connectionCount(port) < requiredConnections(port)"
          data-slot="port-shortfall"
          class="text-destructive"
        >
          {{ connectionCount(port) }}/{{ requiredConnections(port) }}
        </span>
      </div>
      <div
        v-for="port in kind.outputs"
        :key="port.id"
        class="relative px-3 text-right text-muted-foreground"
      >
        <Handle :id="port.id" type="source" :position="Position.Right" class="size-2.5!" />
        {{ port.label }}
      </div>
    </div>
    <DatasetNodeParams
      v-if="Object.keys(kind.params).length"
      :params="kind.params"
      :values="data.params"
      class="border-t px-3 py-2"
      @update="setParam"
    />
  </div>
  <div
    v-else-if="catalog"
    class="w-64 rounded-lg border border-dashed bg-background text-sm text-muted-foreground shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div data-slot="node-title" class="px-3 py-2 font-medium">Unknown: {{ data.kind }}</div>
  </div>
</template>
