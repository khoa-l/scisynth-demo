<script setup lang="ts">
import { Workflow } from "@lucide/vue";
import { ConnectionLineType } from "@vue-flow/core";
import { useId } from "vue";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LINE_TYPES, type LineType } from "@/lib/dataset-nodes/line-type";

const lineType = defineModel<LineType>("lineType", { required: true });
const emit = defineEmits<{ autoLayout: [] }>();

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
  <div role="group" aria-label="Graph settings" class="flex flex-col gap-3 p-4">
    <div class="flex flex-col gap-1">
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
    <div class="flex flex-col items-start gap-1">
      <span class="text-sm text-muted-foreground">Layout</span>
      <Button variant="outline" @click="emit('autoLayout')">
        <Workflow data-icon="inline-start" />
        Auto-layout
      </Button>
    </div>
  </div>
</template>
