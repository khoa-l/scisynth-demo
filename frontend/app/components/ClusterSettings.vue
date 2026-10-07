<script setup lang="ts">
const props = defineProps<{ table: DataRows }>();
const data = defineModel<ClusterData>({ required: true });

const breaks = computed(() => data.value.breaks ?? []);

// Coloring by a column: its values are split into groups by number ranges, three of about the same
// size to start with
const NONE = "none";
const colorChoices = computed(() => [
  { label: "None", value: NONE },
  ...props.table.columns.map((c) => ({ label: c, value: c })),
]);
// where the color column's values run from and to, for the slider of ranges
const colorValues = computed(() =>
  data.value.color ? columnValues(props.table, data.value.color) : [],
);
const colorRange = computed(() => ({
  min: Math.min(...colorValues.value),
  max: Math.max(...colorValues.value),
}));
function colorBy(column: string) {
  const d = data.value;
  d.color = column === NONE ? undefined : column;
  d.breaks = d.color ? quantileBreaks(colorValues.value, 3) : [];
  d.names = [];
}

// the names go by place, so adding or removing a range starts them over; moving a break keeps them
function setBreaks(next: number[]) {
  const d = data.value;
  if (next.length !== breaks.value.length) d.names = [];
  d.breaks = next;
}
function rename(group: number, name: string) {
  const names = [...(data.value.names ?? [])];
  names[group] = name;
  data.value.names = names;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <UFormField label="X" orientation="horizontal">
        <USelect v-model="data.x" :items="table.columns" size="sm" class="w-32" />
      </UFormField>
      <UFormField label="Y" orientation="horizontal">
        <USelect v-model="data.y" :items="table.columns" size="sm" class="w-32" />
      </UFormField>
      <UFormField label="Color by" orientation="horizontal">
        <USelect
          :model-value="data.color ?? NONE"
          :items="colorChoices"
          size="sm"
          class="w-32"
          @update:model-value="colorBy"
        />
      </UFormField>
    </div>
    <template v-if="data.color">
      <USwitch v-model="data.showNoValue" label="Plot points with no value" />
      <div class="flex flex-col gap-1">
        <span class="text-muted">
          Ranges of {{ data.color }}: add a break, drag one to move it, double-click it to remove it
        </span>
        <RangeBreaks
          :model-value="breaks"
          :min="colorRange.min"
          :max="colorRange.max"
          @update:model-value="setBreaks"
        />
      </div>
      <!-- a category for each range, to name -->
      <ul class="flex flex-col gap-2">
        <li v-for="(_, group) in breaks.length + 1" :key="group" class="flex items-center gap-2">
          <span class="size-3 shrink-0 rounded-full" :style="{ background: groupColor(group) }" />
          <UInput
            :model-value="data.names?.[group] ?? ''"
            :placeholder="rangeLabel(group, breaks, data.color)"
            :aria-label="`Name of range ${group + 1}`"
            size="sm"
            class="flex-1"
            @update:model-value="rename(group, String($event))"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
