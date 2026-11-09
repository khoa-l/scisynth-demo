<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";

import { groupBackground } from "@/lib/dataset-nodes/group-colors";
import type { GroupViewData } from "@/lib/dataset-nodes/groups";

defineProps<NodeProps<GroupViewData>>();
</script>

<template>
  <div class="w-64 rounded-lg border bg-background text-sm shadow-sm">
    <div
      data-slot="node-title"
      class="rounded-t-[calc(var(--radius-lg)-1px)] border-b bg-muted px-3 py-2 font-medium"
      :style="{ background: data.group && groupBackground(data.group) }"
    >
      {{ data.label }}
    </div>
    <div class="flex flex-col gap-1 py-2">
      <div v-for="port in data.inputs" :key="port.id" class="relative px-3 text-muted-foreground">
        <Handle
          :id="port.id"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="size-3.5!"
        />
        {{ port.label }}
      </div>
      <div
        v-for="port in data.outputs"
        :key="port.id"
        class="relative px-3 text-right text-muted-foreground"
      >
        <Handle
          :id="port.id"
          type="source"
          :position="Position.Right"
          :connectable="false"
          class="size-3.5!"
        />
        {{ port.label }}
      </div>
    </div>
  </div>
</template>
