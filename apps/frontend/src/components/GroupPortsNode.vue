<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";

import { GROUP_INPUT } from "@/lib/dataset-nodes/groups";

defineProps<NodeProps>();
</script>

<template>
  <div
    class="relative w-36 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <span data-slot="node-title">{{ type === GROUP_INPUT ? "Group Input" : "Group Output" }}</span>
    <Handle
      v-if="type === GROUP_INPUT"
      type="source"
      :position="Position.Right"
      class="size-3.5!"
    />
    <Handle v-else type="target" :position="Position.Left" class="size-3.5!" />
  </div>
</template>
