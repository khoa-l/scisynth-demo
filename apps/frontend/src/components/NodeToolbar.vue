<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";

import NodeKindItems from "@/components/NodeKindItems.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { nodeCategories, type NodeKind } from "@/lib/node-kinds";

const emit = defineEmits<{ add: [kind: NodeKind] }>();
</script>

<template>
  <div
    role="toolbar"
    aria-label="Node editor tools"
    class="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1"
  >
    <DropdownMenu v-for="category in nodeCategories" :key="category.label">
      <DropdownMenuTrigger as-child>
        <Button variant="ghost">
          {{ category.label }}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-48">
        <NodeKindItems :category="category" @select="(kind) => emit('add', kind)" />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
