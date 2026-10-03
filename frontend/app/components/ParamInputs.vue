<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";

const props = defineProps<{ id: string; type: string; params?: Record<string, ParamValue> }>();

const { updateNodeData } = useVueFlow(FLOW_ID);

const kind = computed(() => kindOf(props.type));
const values = computed(() => paramsOf(kind.value, props.params));

// The dropdown's entry for "unset" (an empty value is not allowed for a select item)
const NONE = "__none__";

const items = (spec: ParamSpec) => [
  { label: spec.placeholder ?? "none", value: NONE },
  ...(spec.options ?? []),
];

function save(spec: ParamSpec, value: ParamValue) {
  updateNodeData(props.id, { params: { ...values.value, [spec.name]: value } });
}

// Number inputs emit null while empty: that unsets an optional value, and for the others the
// last valid number is kept. Whole-number inputs (a seed, levels) ignore decimals.
function setNumber(spec: ParamSpec, value: number | null | undefined) {
  if (value === null || value === undefined) {
    if (spec.default === null) save(spec, null);
    return;
  }
  const valid = spec.integer ? Number.isInteger(value) : Number.isFinite(value);
  if (typeof value === "number" && valid) save(spec, value);
}

function setChoice(spec: ParamSpec, value: string) {
  save(spec, value === NONE ? null : value);
}

// obskit rejects values outside the range, so flag them (the preview shows its error too)
function invalid(spec: ParamSpec) {
  const value = values.value[spec.name];
  if (typeof value !== "number") return false;
  const tooLow =
    spec.min !== undefined && (spec.minExclusive ? value <= spec.min : value < spec.min);
  return tooLow || (spec.max !== undefined && value > spec.max);
}
</script>

<template>
  <!-- nodrag/nowheel: let the inputs be used without dragging or zooming the canvas -->
  <div class="nodrag nowheel mt-2 flex flex-col gap-1 text-left">
    <label v-for="spec in kind.params" :key="spec.name" class="flex items-center gap-2">
      <span class="w-14 shrink-0 text-muted">{{ spec.name }}</span>
      <USelect
        v-if="spec.options"
        :model-value="(values[spec.name] as string | null) ?? NONE"
        :items="items(spec)"
        size="xs"
        :aria-label="`${kind.label} ${spec.name}`"
        class="min-w-0 flex-1"
        @update:model-value="setChoice(spec, $event as string)"
      />
      <!-- arrows left and right; min/max clamp what is typed, but the step does not snap it,
           and whole-number parameters cannot take a decimal point -->
      <UInputNumber
        v-else
        :model-value="(values[spec.name] as number | null) ?? undefined"
        :min="spec.min"
        :max="spec.max"
        :step="spec.step"
        :step-snapping="false"
        :format-options="{ maximumFractionDigits: spec.integer ? 0 : 10 }"
        :placeholder="spec.placeholder"
        size="xs"
        :aria-label="`${kind.label} ${spec.name}`"
        :color="invalid(spec) ? 'error' : undefined"
        :highlight="invalid(spec)"
        class="min-w-0 flex-1"
        @update:model-value="setNumber(spec, $event)"
      />
    </label>
  </div>
</template>
