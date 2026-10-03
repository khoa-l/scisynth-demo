<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";

const props = defineProps<{ id: string; axes: AxisData[] }>();

const { updateNodeData } = useVueFlow(FLOW_ID);

function add() {
  updateNodeData(props.id, { axes: [...props.axes, newAxis(props.axes)] });
}

function remove(index: number) {
  updateNodeData(props.id, { axes: props.axes.filter((_, i) => i !== index) });
}

// Number inputs emit null while empty; keep the last valid number instead
function setExtent(axis: AxisData, index: 0 | 1, value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) axis.extent[index] = value;
}

// Mirrors obskit's checks: extent needs lo < hi, axis names must be unique
const invalidExtent = (axis: AxisData) => !(axis.extent[0] < axis.extent[1]);
const invalidName = (axis: AxisData) =>
  axis.name.trim() === "" || props.axes.filter((a) => a.name === axis.name).length > 1;
</script>

<template>
  <!-- nodrag/nowheel: let the inputs be used without dragging or zooming the canvas -->
  <div class="nodrag nowheel mt-2 flex flex-col gap-2 text-left">
    <UButton label="Add axis" icon="i-lucide-plus" size="xs" variant="soft" block @click="add" />
    <div v-for="(axis, i) in axes" :key="i" class="flex gap-1">
      <UInput
        v-model="axis.name"
        size="xs"
        placeholder="name"
        :aria-label="`Axis ${i + 1} name`"
        :color="invalidName(axis) ? 'error' : undefined"
        :highlight="invalidName(axis)"
        class="min-w-0 flex-1"
      />
      <UInput
        v-model="axis.unit"
        size="xs"
        placeholder="unit"
        :aria-label="`Axis ${i + 1} unit`"
        class="w-16"
      />
      <UInputNumber
        :model-value="axis.extent[0]"
        :step="0.1"
        :step-snapping="false"
        :format-options="{ maximumFractionDigits: 10 }"
        size="xs"
        placeholder="min"
        :aria-label="`Axis ${i + 1} extent minimum`"
        :color="invalidExtent(axis) ? 'error' : undefined"
        :highlight="invalidExtent(axis)"
        class="w-28"
        @update:model-value="setExtent(axis, 0, $event)"
      />
      <UInputNumber
        :model-value="axis.extent[1]"
        :step="0.1"
        :step-snapping="false"
        :format-options="{ maximumFractionDigits: 10 }"
        size="xs"
        placeholder="max"
        :aria-label="`Axis ${i + 1} extent maximum`"
        :color="invalidExtent(axis) ? 'error' : undefined"
        :highlight="invalidExtent(axis)"
        class="w-28"
        @update:model-value="setExtent(axis, 1, $event)"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="xs"
        :aria-label="`Delete axis ${i + 1}`"
        @click="remove(i)"
      />
    </div>
  </div>
</template>
