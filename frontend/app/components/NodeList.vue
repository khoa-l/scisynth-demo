<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";

// Shares the canvas's flow store, so the list always mirrors the nodes on it
const { nodes, removeNodes } = useVueFlow(FLOW_ID);
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="node in nodes"
      :key="node.id"
      class="flex items-center justify-between gap-2 rounded-md border border-default py-1 pl-3 pr-1"
      :class="`cat-${kindOf(node.data?.type).category}`"
      :style="{ backgroundColor: 'var(--cat-bg)' }"
    >
      <span class="flex min-w-0 items-center gap-2">
        <UIcon
          :name="kindOf(node.data?.type).icon"
          class="size-4 shrink-0"
          :style="{ color: 'var(--cat-fg)' }"
        />
        <span class="truncate">{{ node.label }}</span>
      </span>
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        :aria-label="`Delete ${node.label}`"
        class="shrink-0"
        @click="removeNodes(node.id)"
      />
    </li>
  </ul>
</template>
