<script setup lang="ts">
import { Maximize2, Minimize2, Ungroup } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { Handle, Position, useVueFlow, type Node, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed } from "vue";

import { toggleVariants } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import {
  collapseGroup,
  groupPorts,
  ungroupNodes,
  withCollapsedEdges,
} from "@/lib/dataset-nodes/graph";

const props = defineProps<NodeProps<{ collapsed: boolean }>>();

const { data: catalog } = useQuery(nodeCatalogQuery);
const { edges, nodes, setEdges, setNodes } = useVueFlow();

const memberCount = computed(
  () => nodes.value.filter((node) => node.parentNode === props.id).length,
);
const members = computed(() =>
  catalog.value ? groupPorts(nodes.value, edges.value, catalog.value, props.id) : [],
);

function setPressed(value: unknown) {
  const collapsed = Array.isArray(value) && value.includes("collapsed");
  update(collapseGroup(nodes.value, props.id, collapsed));
}

function ungroup() {
  update(ungroupNodes(nodes.value, props.id));
}

function update(next: Node[]) {
  setNodes(next);
  setEdges(withCollapsedEdges(next, edges.value));
}
</script>

<template>
  <div
    class="relative rounded-xl border-2 border-dashed border-muted-foreground/40 bg-background/40"
    :class="[
      data.collapsed ? 'w-64 bg-background shadow-sm' : 'size-full',
      { 'ring-2 ring-ring/50': selected },
    ]"
  >
    <div data-slot="group-title" class="px-3 py-2 text-sm font-medium text-muted-foreground">
      Group
    </div>
    <template v-if="data.collapsed">
      <div class="px-3 pb-2 text-sm text-muted-foreground">
        {{ memberCount }} {{ memberCount === 1 ? "node" : "nodes" }}
      </div>
      <div
        v-for="member in members"
        :key="member.id"
        data-slot="group-member"
        class="flex flex-col gap-1 border-t py-2 text-sm"
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
      <button
        type="button"
        aria-label="Ungroup nodes"
        :class="
          cn(
            toggleVariants({ variant: 'outline' }),
            'rounded-none border-l-0 px-2 first:rounded-l-lg first:border-l last:rounded-r-lg',
          )
        "
        @click="ungroup"
      >
        <Ungroup />
      </button>
    </ToggleGroup>
  </div>
</template>
