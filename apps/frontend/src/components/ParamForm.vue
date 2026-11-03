<script setup lang="ts">
import { useId } from "vue";

import { Input } from "@/components/ui/input";
import { parseParam } from "@/lib/nodes/params";
import type {
  IntegerParam,
  NumberParam,
  ParamDef,
  ParamValue,
  ParamValues,
} from "@/lib/nodes/types";

const props = defineProps<{ params: Record<string, ParamDef>; values: ParamValues }>();
const emit = defineEmits<{ update: [name: string, value: ParamValue] }>();

const uid = useId();

function commitNumber(name: string, def: NumberParam | IntegerParam, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = parseParam(def, input.value);
  if (value === undefined) input.value = String(props.values[name] ?? "");
  else emit("update", name, value);
}
</script>

<template>
  <div class="nodrag grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-2 gap-y-2">
    <template v-for="(def, name) in params" :key="name">
      <label :for="`${uid}-${name}`" class="text-sm text-muted-foreground">
        {{ def.label }}
      </label>
      <select
        v-if="def.type === 'enum'"
        :id="`${uid}-${name}`"
        :value="values[name]"
        class="h-8 rounded-lg border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        @change="emit('update', name, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in def.options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <Input
        v-else
        :id="`${uid}-${name}`"
        type="number"
        :min="def.min"
        :max="def.max"
        :step="def.type === 'integer' ? 1 : (def.step ?? 'any')"
        :placeholder="def.optional ? 'Auto' : undefined"
        :model-value="values[name] ?? ''"
        class="px-1.5"
        @change="commitNumber(name, def, $event)"
      />
    </template>
  </div>
</template>
