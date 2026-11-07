<script setup lang="ts">
import { Maximize2, Minimize2, Ungroup } from "@lucide/vue";
import { Handle, Position, useVueFlow, type Node, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed } from "vue";

import { toggleVariants } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  GROUP_INPUT,
  GROUP_OUTPUT,
  collapseGroup,
  ungroupNodes,
  withCollapsedEdges,
} from "@/lib/dataset-nodes/graph";

const props = defineProps<NodeProps<{ collapsed: boolean }>>();

const { edges, nodes, setEdges, setNodes } = useVueFlow();

const memberCount = computed(
  () => nodes.value.filter((node) => node.parentNode === props.id).length,
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
      <Handle
        :id="GROUP_INPUT"
        type="target"
        :position="Position.Left"
        :connectable="false"
        class="size-3.5!"
      />
      <Handle
        :id="GROUP_OUTPUT"
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="size-3.5!"
      />
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
