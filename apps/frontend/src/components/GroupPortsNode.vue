<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import { computed } from "vue";

import { GROUP_INPUT } from "@/lib/dataset-nodes/groups";

const props = defineProps<NodeProps>();

const isInput = computed(() => props.type === GROUP_INPUT);
</script>

<template>
  <div
    class="relative w-48 rounded-lg border bg-background text-sm shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div
      data-slot="node-title"
      class="rounded-t-[calc(var(--radius-lg)-1px)] border-b bg-muted px-3 py-2 font-medium"
    >
      {{ isInput ? "Group Input" : "Group Output" }}
    </div>
    <div class="py-2">
      <div v-if="isInput" class="relative px-3 text-right text-muted-foreground">
        <Handle type="source" :position="Position.Right" class="size-3.5!" />
        Inputs
      </div>
      <div v-else class="relative px-3 text-muted-foreground">
        <Handle type="target" :position="Position.Left" class="size-3.5!" />
        Outputs
      </div>
    </div>
  </div>
</template>
