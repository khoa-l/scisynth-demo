<script setup lang="ts">
import { Maximize2, Minimize2, Trash2, Ungroup } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { Handle, Position, useVueFlow, type Node, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed, inject, ref } from "vue";

import { toggleVariants } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import {
  memberPorts,
  setGroupCollapsed,
  ungroupNodes,
  withCollapsedEdges,
} from "@/lib/dataset-nodes/groups";
import { VIEWED_NODE } from "@/lib/dataset-nodes/viewed";

const props = defineProps<NodeProps<{ collapsed: boolean }>>();

const { data: catalog } = useQuery(nodeCatalogQuery);
const { edges, nodes, setEdges, setNodes } = useVueFlow();
const viewed = inject(VIEWED_NODE, ref(null));

const memberIds = computed(() =>
  nodes.value.filter((node) => node.parentNode === props.id).map((node) => node.id),
);
const members = computed(() =>
  catalog.value ? memberPorts(nodes.value, edges.value, catalog.value, props.id) : [],
);

const plainButton = cn(
  toggleVariants({ variant: "outline" }),
  "rounded-none border-l-0 px-2 first:rounded-l-lg first:border-l last:rounded-r-lg",
);

function setPressed(value: unknown) {
  const collapsed = Array.isArray(value) && value.includes("collapsed");
  update(setGroupCollapsed(nodes.value, props.id, collapsed));
}

function ungroup() {
  update(ungroupNodes(nodes.value, props.id));
}

function remove() {
  const removed = new Set([props.id, ...memberIds.value]);
  if (viewed.value && removed.has(viewed.value)) viewed.value = null;
  setNodes(nodes.value.filter((node) => !removed.has(node.id)));
  setEdges(edges.value.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)));
}

function update(next: Node[]) {
  setNodes(next);
  setEdges(withCollapsedEdges(next, edges.value));
}
</script>

<template>
  <div
    class="relative"
    :class="[
      data.collapsed
        ? 'w-64 rounded-lg border bg-background text-sm shadow-sm'
        : 'size-full rounded-xl border-2 border-dashed border-muted-foreground/40 bg-background/40',
      { 'ring-2 ring-ring/50': selected },
    ]"
  >
    <div
      v-if="!data.collapsed"
      data-slot="group-title"
      class="px-3 py-2 text-sm font-medium text-muted-foreground"
    >
      Group
    </div>
    <template v-else>
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
            :key="port.id"
            class="relative px-3 text-muted-foreground"
          >
            <Handle
              :id="port.id"
              type="target"
              :position="Position.Left"
              class="size-3.5!"
              :connectable="port.multiple ? true : 'single'"
            />
            {{ port.label }}
          </div>
          <div
            v-for="port in member.outputs"
            :key="port.id"
            class="relative px-3 text-right text-muted-foreground"
          >
            <Handle :id="port.id" type="source" :position="Position.Right" class="size-3.5!" />
            {{ port.label }}
          </div>
        </div>
      </div>
    </template>
    <ToggleGroup
      type="multiple"
      variant="outline"
      orientation="horizontal"
      aria-label="Group controls"
      :model-value="data.collapsed ? ['collapsed'] : []"
      class="nodrag absolute top-full left-1/2 mt-2 -translate-x-1/2 bg-background shadow-sm"
      @update:model-value="setPressed"
      @click.stop
    >
      <ToggleGroupItem value="collapsed" aria-label="Collapse group">
        <Maximize2 v-if="data.collapsed" />
        <Minimize2 v-else />
      </ToggleGroupItem>
      <button type="button" aria-label="Ungroup nodes" :class="plainButton" @click="ungroup">
        <Ungroup />
      </button>
      <button type="button" aria-label="Delete group" :class="plainButton" @click="remove">
        <Trash2 />
      </button>
    </ToggleGroup>
  </div>
</template>
