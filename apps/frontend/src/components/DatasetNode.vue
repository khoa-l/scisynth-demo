<script setup lang="ts">
import { Download, Eye, EyeOff, ImageIcon, ImageOff, Trash2 } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { Handle, Position, useNodeConnections, useVueFlow, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed, inject, ref } from "vue";

import { previewsDownloadNodeData } from "@/client";

import DatasetNodeParams from "@/components/DatasetNodeParams.vue";
import DatasetNodePreview from "@/components/DatasetNodePreview.vue";
import { toggleVariants } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  findKind,
  nodeCatalogQuery,
  requiredConnections,
  type DatasetNodeData,
} from "@/lib/dataset-nodes/catalog";
import { nodePreviewRequest, toGraph } from "@/lib/dataset-nodes/graph";
import { groupBackground, groupHues } from "@/lib/dataset-nodes/group-colors";
import type { ParamValue, PortDef } from "@/lib/dataset-nodes/types";
import { VIEWED_NODE, VIEWED_PREVIEW_ID } from "@/lib/dataset-nodes/viewed";
import { download } from "@/lib/download";

const props = defineProps<NodeProps<DatasetNodeData>>();

const PREVIEWABLE_GENERATORS = new Set(["GaussianField", "GaussianBumps", "VoronoiRegions"]);
const PREVIEWED_FROM_INPUTS = new Set([
  "composite",
  "sampler",
  "defect",
  "transform",
  "projection",
]);

const { data: catalog } = useQuery(nodeCatalogQuery);
const kind = computed(() => catalog.value && findKind(catalog.value, props.data.kind));

const { edges, nodes, removeNodes, updateNodeData } = useVueFlow();
const incoming = useNodeConnections({ handleType: "target" });

function connectionCount(port: PortDef) {
  return incoming.value.filter((connection) => connection.targetHandle === port.id).length;
}

const hasPreview = computed(() => {
  if (!kind.value) return false;
  if (PREVIEWED_FROM_INPUTS.has(kind.value.group)) {
    return kind.value.inputs.every((port) => connectionCount(port) >= requiredConnections(port));
  }
  return PREVIEWABLE_GENERATORS.has(kind.value.name);
});

const previewRequest = computed(() =>
  nodePreviewRequest(toGraph(nodes.value, edges.value), props.id),
);

const plot = ref<"heatmap" | "scatter">("heatmap");

const viewed = inject(VIEWED_NODE, ref(null));
const isViewed = computed(() => viewed.value === props.id);

const pressed = computed(() => [
  ...(isViewed.value ? ["viewed"] : []),
  ...(props.data.previewHidden ? ["hidden"] : []),
]);

function setPressed(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  if (values.includes("viewed") !== isViewed.value) {
    viewed.value = isViewed.value ? null : props.id;
  }
  const previewHidden = values.includes("hidden");
  if (previewHidden !== !!props.data.previewHidden) {
    updateNodeData<DatasetNodeData>(props.id, { previewHidden });
  }
}

const downloading = ref(false);

async function downloadData() {
  downloading.value = true;
  try {
    const { data } = await previewsDownloadNodeData({
      body: previewRequest.value,
      throwOnError: true,
    });
    download(data, `${kind.value?.label}-${props.id}.npz`);
  } finally {
    downloading.value = false;
  }
}

const plainButton = cn(
  toggleVariants({ variant: "outline" }),
  "rounded-none border-l-0 px-2 first:rounded-l-lg first:border-l last:rounded-r-lg",
);

function remove() {
  if (isViewed.value) viewed.value = null;
  removeNodes(props.id);
}

function setParam(name: string, value: ParamValue) {
  updateNodeData<DatasetNodeData>(props.id, { params: { ...props.data.params, [name]: value } });
}
</script>

<template>
  <div
    v-if="kind"
    class="relative w-64 rounded-lg border bg-background text-sm shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
    :style="{ '--hue': groupHues[kind.group] }"
  >
    <DatasetNodePreview
      v-if="hasPreview && !data.previewHidden"
      v-model:plot="plot"
      switchable
      :label="kind.label"
      :request="previewRequest"
      class="absolute -inset-x-px bottom-full mb-2"
    />
    <Teleport v-if="hasPreview && isViewed" :to="`#${VIEWED_PREVIEW_ID}`">
      <DatasetNodePreview
        v-model:plot="plot"
        detailed
        :label="kind.label"
        :request="previewRequest"
        class="w-[min(100cqw,100cqh_-_2.25rem)]"
      />
    </Teleport>
    <ToggleGroup
      type="multiple"
      variant="outline"
      orientation="horizontal"
      aria-label="Node controls"
      :model-value="pressed"
      class="nodrag absolute top-full left-1/2 mt-2 -translate-x-1/2 bg-background shadow-sm"
      @update:model-value="setPressed"
      @click.stop
    >
      <template v-if="hasPreview">
        <ToggleGroupItem value="viewed" aria-label="View preview">
          <Eye v-if="isViewed" />
          <EyeOff v-else />
        </ToggleGroupItem>
        <ToggleGroupItem value="hidden" aria-label="Hide preview">
          <ImageOff v-if="data.previewHidden" />
          <ImageIcon v-else />
        </ToggleGroupItem>
        <button
          type="button"
          aria-label="Download data"
          :disabled="downloading"
          :class="plainButton"
          @click="downloadData"
        >
          <Download />
        </button>
      </template>
      <button type="button" aria-label="Delete node" :class="plainButton" @click="remove">
        <Trash2 />
      </button>
    </ToggleGroup>
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
          class="size-3.5!"
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
        <Handle :id="port.id" type="source" :position="Position.Right" class="size-3.5!" />
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
    class="relative w-64 rounded-lg border border-dashed bg-background text-sm text-muted-foreground shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div data-slot="node-title" class="px-3 py-2 font-medium">Unknown: {{ data.kind }}</div>
    <div
      class="nodrag absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-lg bg-background shadow-sm"
    >
      <button type="button" aria-label="Delete node" :class="plainButton" @click.stop="remove">
        <Trash2 />
      </button>
    </div>
  </div>
</template>
