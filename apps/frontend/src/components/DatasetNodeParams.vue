<script setup lang="ts">
import { ChevronDown, ChevronUp } from "@lucide/vue";
import { nextTick, useId } from "vue";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import type {
  IntegerParam,
  NumberParam,
  ParamDef,
  ParamValue,
  ParamValues,
} from "@/lib/dataset-nodes/types";

const props = defineProps<{ params: Record<string, ParamDef>; values: ParamValues }>();
const emit = defineEmits<{ update: [name: string, value: ParamValue] }>();

const uid = useId();
const formatOptions = { useGrouping: false, maximumFractionDigits: 20 };

function commitNumber(name: string, def: NumberParam | IntegerParam, value: number | undefined) {
  if (value !== undefined) emit("update", name, value);
  else if (def.optional) emit("update", name, null);
}

function restoreIfBlank(name: string, def: NumberParam | IntegerParam, event: FocusEvent) {
  const input = event.target as HTMLInputElement;
  if (def.optional || input.value.trim() !== "") return;
  void nextTick(() => {
    input.value = String(props.values[name]);
  });
}
</script>

<template>
  <div class="nodrag grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-2 gap-y-2">
    <template v-for="(def, name) in params" :key="name">
      <Label :for="`${uid}-${name}`" class="text-muted-foreground">{{ def.label }}</Label>
      <NativeSelect
        v-if="def.type === 'enum'"
        :id="`${uid}-${name}`"
        :model-value="values[name]"
        class="w-full"
        @update:model-value="emit('update', name, $event as string)"
      >
        <NativeSelectOption v-for="option in def.options" :key="option.value" :value="option.value">
          {{ option.label }}
        </NativeSelectOption>
      </NativeSelect>
      <NumberField
        v-else
        :id="`${uid}-${name}`"
        :model-value="values[name] as number | null"
        :min="def.min"
        :max="def.max"
        :step="def.type === 'integer' ? 1 : (def.step ?? 1)"
        :step-snapping="def.type === 'integer'"
        :format-options="formatOptions"
        class="nowheel"
        @update:model-value="commitNumber(name, def, $event)"
      >
        <NumberFieldContent>
          <NumberFieldInput
            :placeholder="def.optional ? 'Auto' : undefined"
            class="pl-1.5 text-left"
            @blur="restoreIfBlank(name, def, $event)"
          />
          <div
            class="absolute inset-y-px right-px flex w-5 flex-col overflow-hidden rounded-r-[calc(var(--radius-lg)-1px)] border-l border-input"
          >
            <NumberFieldIncrement
              class="static flex flex-1 translate-y-0 items-center justify-center border-b border-input p-0 hover:bg-muted"
            >
              <ChevronUp class="size-3" />
            </NumberFieldIncrement>
            <NumberFieldDecrement
              class="static flex flex-1 translate-y-0 items-center justify-center p-0 hover:bg-muted"
            >
              <ChevronDown class="size-3" />
            </NumberFieldDecrement>
          </div>
        </NumberFieldContent>
      </NumberField>
    </template>
  </div>
</template>
