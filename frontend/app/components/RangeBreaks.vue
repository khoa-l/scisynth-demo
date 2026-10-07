<script setup lang="ts">
// A slider from `min` to `max` with a handle for each break, on a bar colored by the ranges they
// make. Drag a handle to move it (it stays between its neighbors); double-click it, or press Delete
// on it, to remove it.
const props = defineProps<{ min: number; max: number }>();
const breaks = defineModel<number[]>({ required: true }); // in order

const span = computed(() => props.max - props.min || 1); // a column of one value has no width

// the bar: a hard-edged stop where each range ends
const bar = computed(() => {
  const edges = [props.min, ...breaks.value, props.max].map(
    (v) => ((v - props.min) / span.value) * 100,
  );
  const stops = edges.slice(1).map((to, i) => {
    return `${groupColor(i)} ${edges[i]}% ${to}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
});

// a new break in the middle of the widest range
function add() {
  const edges = [props.min, ...breaks.value, props.max];
  const gaps = edges.slice(1).map((to, i) => to - edges[i]!);
  const widest = gaps.indexOf(Math.max(...gaps));
  const middle = (edges[widest]! + edges[widest + 1]!) / 2;
  breaks.value = [...breaks.value, middle].sort((a, b) => a - b);
}

// the slider gives back one number, not a list, when it has one handle; its steps leave stray digits
const setBreaks = (value: number | number[] | undefined) =>
  (breaks.value = [value ?? []].flat().map((v) => Number(v.toPrecision(5))));

// removes the break whose handle the event is on
const root = ref<HTMLElement>();
function remove(e: Event) {
  const handles = [...root.value!.querySelectorAll("[role=slider]")];
  const index = handles.indexOf(e.target as Element);
  if (index >= 0) breaks.value = breaks.value.filter((_, i) => i !== index);
}
</script>

<template>
  <div
    ref="root"
    class="flex items-center gap-3"
    @dblclick="remove"
    @keydown.delete="remove"
    @keydown.backspace="remove"
  >
    <span class="text-xs text-dimmed">{{ formatCell(min) }}</span>
    <USlider
      :model-value="breaks"
      :min="min"
      :max="max"
      :step="span / 1000"
      tooltip
      class="flex-1"
      :style="{ '--ranges': bar }"
      :ui="{ track: 'bg-(image:--ranges)', range: 'bg-transparent' }"
      @update:model-value="setBreaks"
    />
    <span class="text-xs text-dimmed">{{ formatCell(max) }}</span>
    <UButton label="Add break" icon="i-lucide-plus" size="xs" variant="soft" @click="add" />
  </div>
</template>
