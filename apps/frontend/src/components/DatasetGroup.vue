<script setup lang="ts">
import { Eye, Trash2, Ungroup } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed, inject, ref } from "vue";

import { toggleVariants } from "@/components/ui/toggle";
import { nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import { memberPorts, ungroupNodes, withGroupEdges } from "@/lib/dataset-nodes/groups";
import { VIEWED_GROUP, VIEWED_NODE } from "@/lib/dataset-nodes/viewed";

const props = defineProps<NodeProps>();

const { data: catalog } = useQuery(nodeCatalogQuery);
const { edges, nodes, setEdges, setNodes } = useVueFlow();
const viewed = inject(VIEWED_NODE, ref(null));
const viewedGroup = inject(VIEWED_GROUP, ref(null));

const memberIds = computed(() =>
  nodes.value.filter((node) => node.parentNode === props.id).map((node) => node.id),
);
const members = computed(() =>
  catalog.value ? memberPorts(nodes.value, catalog.value, props.id) : [],
);

const plainButton = cn(
  toggleVariants({ variant: "outline" }),
  "rounded-none border-l-0 px-2 first:rounded-l-lg first:border-l last:rounded-r-lg",
);

function ungroup() {
  const ungrouped = ungroupNodes(nodes.value, props.id);
  setNodes(ungrouped);
  setEdges(withGroupEdges(ungrouped, edges.value));
}

function remove() {
  const removed = new Set([props.id, ...memberIds.value]);
  if (viewed.value && removed.has(viewed.value)) viewed.value = null;
  setNodes(nodes.value.filter((node) => !removed.has(node.id)));
  setEdges(edges.value.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)));
}
</script>

<template>
  <div
    class="relative w-64 rounded-lg border bg-background text-sm shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div
      data-slot="group-title"
      class="flex justify-between rounded-t-[calc(var(--radius-lg)-1px)] border-b bg-muted px-3 py-2 font-medium"
    >
      Group
      <span class="font-normal text-muted-foreground">
        {{ memberIds.length }} {{ memberIds.length === 1 ? "node" : "nodes" }}
      </span>
    </div>
    <div class="divide-y">
      <div
        v-for="member in members"
        :key="member.id"
        data-slot="group-member"
        class="flex flex-col gap-1 py-2"
      >
        <div class="px-3 text-xs font-medium">{{ member.label }}</div>
        <div
          v-for="port in member.inputs"
          :key="port.handle"
          class="relative px-3 text-muted-foreground"
        >
          <Handle
            :id="port.handle"
            type="target"
            :position="Position.Left"
            class="size-3.5!"
            :connectable="port.multiple ? true : 'single'"
          />
          {{ port.label }}
        </div>
        <div
          v-for="port in member.outputs"
          :key="port.handle"
          class="relative px-3 text-right text-muted-foreground"
        >
          <Handle :id="port.handle" type="source" :position="Position.Right" class="size-3.5!" />
          {{ port.label }}
        </div>
      </div>
    </div>
    <div
      role="group"
      aria-label="Group controls"
      class="nodrag absolute top-full left-1/2 mt-2 flex -translate-x-1/2 rounded-lg bg-background shadow-sm"
      @click.stop
    >
      <button type="button" aria-label="View group" :class="plainButton" @click="viewedGroup = id">
        <Eye />
      </button>
      <button type="button" aria-label="Ungroup nodes" :class="plainButton" @click="ungroup">
        <Ungroup />
      </button>
      <button type="button" aria-label="Delete group" :class="plainButton" @click="remove">
        <Trash2 />
      </button>
    </div>
  </div>
</template>
