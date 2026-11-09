<script setup lang="ts">
import { Plus, Trash } from "@lucide/vue";

import type { DomainAxis } from "@/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NAME_MAX_LENGTH } from "@/lib/dataset-nodes/graph";

const props = defineProps<{ label: string; axes: DomainAxis[]; max: number }>();
const emit = defineEmits<{ update: [axes: DomainAxis[]] }>();

const SUGGESTED_NAMES = ["x", "y", "z", "t"];

function change(index: number, axis: DomainAxis) {
  emit(
    "update",
    props.axes.map((current, i) => (i === index ? axis : current)),
  );
}

function rename(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  const axis = props.axes[index]!;
  const name = input.value.trim();
  const taken = props.axes.some((other, i) => i !== index && other.name === name);
  if (name && !taken) change(index, { ...axis, name });
  else input.value = axis.name;
}

function setBound(index: number, bound: 0 | 1, event: Event) {
  const input = event.target as HTMLInputElement;
  const axis = props.axes[index]!;
  const extent: [number, number] = [...axis.extent];
  extent[bound] = input.valueAsNumber;
  if (Number.isFinite(extent[bound]) && extent[0] < extent[1]) change(index, { ...axis, extent });
  else input.value = String(axis.extent[bound]);
}

function remove(index: number) {
  emit(
    "update",
    props.axes.filter((_, i) => i !== index),
  );
}

function add() {
  const names = new Set(props.axes.map((axis) => axis.name));
  let name = SUGGESTED_NAMES.find((suggested) => !names.has(suggested));
  for (let count = props.axes.length + 1; !name; count++) {
    if (!names.has(`axis ${count}`)) name = `axis ${count}`;
  }
  emit("update", [...props.axes, { name, extent: [0, 1] }]);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-muted-foreground">{{ label }}</span>
    <ul :aria-label="label" class="flex flex-col gap-2">
      <li v-for="(axis, index) in axes" :key="axis.name" class="flex items-center gap-1.5">
        <Input
          :default-value="axis.name"
          :aria-label="`Name of axis ${axis.name}`"
          :maxlength="NAME_MAX_LENGTH"
          class="h-8 min-w-0 flex-1 px-1.5"
          @change="rename(index, $event)"
        />
        <Input
          type="number"
          step="any"
          :default-value="axis.extent[0]"
          :aria-label="`Start of ${axis.name}`"
          class="h-8 w-14 px-1.5"
          @change="setBound(index, 0, $event)"
        />
        <Input
          type="number"
          step="any"
          :default-value="axis.extent[1]"
          :aria-label="`End of ${axis.name}`"
          class="h-8 w-14 px-1.5"
          @change="setBound(index, 1, $event)"
        />
        <Button
          variant="outline"
          size="icon-sm"
          :aria-label="`Remove ${axis.name}`"
          :disabled="axes.length === 1"
          @click="remove(index)"
        >
          <Trash />
        </Button>
      </li>
    </ul>
    <Button
      variant="outline"
      size="sm"
      class="self-start"
      :disabled="axes.length >= max"
      @click="add"
    >
      <Plus data-icon="inline-start" />
      Add axis
    </Button>
  </div>
</template>
