<script setup lang="ts">
import { ConnectionLineType } from "@vue-flow/core";
import { useId } from "vue";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LINE_TYPES, type LineType } from "@/lib/dataset-nodes/line-type";

const lineType = defineModel<LineType>("lineType", { required: true });

const uid = useId();

const names: Record<LineType, string> = {
  [ConnectionLineType.Bezier]: "Curved",
  [ConnectionLineType.SmoothStep]: "Rounded",
  [ConnectionLineType.Step]: "Step",
  [ConnectionLineType.Straight]: "Straight",
};

function setLineType(value: unknown) {
  const found = LINE_TYPES.find((type) => type === value);
  if (found) lineType.value = found;
}
</script>

<template>
  <div
    role="group"
    aria-label="Graph settings"
    class="flex items-center gap-2 rounded-md border bg-background p-2 shadow-sm"
  >
    <span :id="`${uid}-lines`" class="text-sm text-muted-foreground">Lines</span>
    <ToggleGroup
      type="single"
      variant="outline"
      orientation="horizontal"
      :aria-labelledby="`${uid}-lines`"
      :model-value="lineType"
      @update:model-value="setLineType"
    >
      <ToggleGroupItem v-for="type in LINE_TYPES" :key="type" :value="type">
        {{ names[type] }}
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
</template>
