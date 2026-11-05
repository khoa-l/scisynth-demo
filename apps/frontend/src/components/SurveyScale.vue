<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SCALE_POINTS } from "@/lib/survey-blocks";

defineProps<{ disabled?: boolean }>();

const answer = defineModel<number>();
</script>

<template>
  <ToggleGroup
    type="single"
    variant="outline"
    orientation="horizontal"
    v-model="answer"
    :disabled="disabled"
    class="w-full"
  >
    <ToggleGroupItem
      v-for="point in SCALE_POINTS"
      :key="point"
      :value="point"
      class="flex-1 data-[state=on]:bg-linear-135 data-[state=on]:from-[oklch(0.9_0.07_250)] data-[state=on]:to-[oklch(0.84_0.09_250)] data-[state=on]:text-neutral-900"
    >
      {{ point }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
