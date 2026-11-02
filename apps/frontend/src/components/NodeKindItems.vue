<script setup lang="ts">
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { NodeCategory, NodeKind } from "@/lib/node-kinds";

defineProps<{ category: NodeCategory }>();

const emit = defineEmits<{ select: [kind: NodeKind] }>();
</script>

<template>
  <template v-for="(group, index) in category.groups" :key="group.label ?? index">
    <DropdownMenuSeparator v-if="index > 0" />
    <DropdownMenuGroup>
      <DropdownMenuLabel v-if="group.label">{{ group.label }}</DropdownMenuLabel>
      <DropdownMenuItem v-for="kind in group.kinds" :key="kind.name" @select="emit('select', kind)">
        {{ kind.label }}
      </DropdownMenuItem>
    </DropdownMenuGroup>
  </template>
</template>
