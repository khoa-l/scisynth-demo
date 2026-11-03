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
      class="flex-1 aria-pressed:bg-primary aria-pressed:text-primary-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
    >
      {{ point }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
