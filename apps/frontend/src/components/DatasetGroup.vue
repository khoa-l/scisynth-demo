<script setup lang="ts">
import { Ungroup } from "@lucide/vue";
import { useVueFlow, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";

import { toggleVariants } from "@/components/ui/toggle";
import { ungroupNodes } from "@/lib/dataset-nodes/graph";

const props = defineProps<NodeProps>();

const { nodes, setNodes } = useVueFlow();

function ungroup() {
  setNodes(ungroupNodes(nodes.value, props.id));
}
</script>

<template>
  <div
    class="relative size-full rounded-xl border-2 border-dashed border-muted-foreground/40 bg-background/40"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div data-slot="group-title" class="px-3 py-2 text-sm font-medium text-muted-foreground">
      Group
    </div>
    <div
      role="group"
      aria-label="Group controls"
      class="nodrag absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-lg bg-background shadow-sm"
    >
      <button
        type="button"
        aria-label="Ungroup nodes"
        :class="cn(toggleVariants({ variant: 'outline' }), 'px-2')"
        @click.stop="ungroup"
      >
        <Ungroup />
      </button>
    </div>
  </div>
</template>
