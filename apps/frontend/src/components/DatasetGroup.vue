<script setup lang="ts">
import { Maximize2, Minimize2, Ungroup } from "@lucide/vue";
import { useVueFlow, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed } from "vue";

import { toggleVariants } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { collapseGroup, ungroupNodes } from "@/lib/dataset-nodes/graph";

const props = defineProps<NodeProps<{ collapsed: boolean }>>();

const { nodes, setNodes } = useVueFlow();

const memberCount = computed(
  () => nodes.value.filter((node) => node.parentNode === props.id).length,
);

function setPressed(value: unknown) {
  const collapsed = Array.isArray(value) && value.includes("collapsed");
  setNodes(collapseGroup(nodes.value, props.id, collapsed));
}

function ungroup() {
  setNodes(ungroupNodes(nodes.value, props.id));
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
    <div v-if="data.collapsed" class="px-3 pb-2 text-sm text-muted-foreground">
      {{ memberCount }} {{ memberCount === 1 ? "node" : "nodes" }}
    </div>
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
