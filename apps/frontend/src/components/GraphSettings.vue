<script setup lang="ts">
import { Settings2, Workflow } from "@lucide/vue";
import { ConnectionLineType } from "@vue-flow/core";
import { useId } from "vue";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LINE_TYPES, type LineType } from "@/lib/dataset-nodes/line-type";

const lineType = defineModel<LineType>("lineType", { required: true });
const shown = defineModel<boolean>("shown", { required: true });
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
  <Collapsible v-model:open="shown" class="relative">
    <CollapsibleTrigger as-child>
      <Button
        :variant="shown ? 'ghost' : 'outline'"
        size="icon"
        aria-label="Show graph settings"
        class="relative z-10"
        :class="{ 'shadow-sm': !shown }"
      >
        <Settings2 />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent
      class="absolute -top-1.25 -right-1.25 origin-top-right rounded-md border bg-background p-1 pt-10 shadow-sm duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
    >
      <div role="group" aria-label="Graph settings" class="flex flex-col gap-3 p-1">
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
    </CollapsibleContent>
  </Collapsible>
</template>
