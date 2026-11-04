<script setup lang="ts">
import { Plus, Trash } from "@lucide/vue";
import { useId } from "vue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LABEL_COLORS, LABEL_TOOLS, type LabelBlock, type SurveyLabel } from "@/lib/survey-blocks";

const props = defineProps<{ block: LabelBlock }>();
const emit = defineEmits<{
  update: [changes: Pick<LabelBlock, "labels"> | Pick<LabelBlock, "tools">];
}>();

const uid = useId();

const toolNames = { point: "Point", lasso: "Lasso", brush: "Brush" };

function changeLabel(id: string, changes: Partial<SurveyLabel>) {
  emit("update", {
    labels: props.block.labels.map((label) => (label.id === id ? { ...label, ...changes } : label)),
  });
}

function rename(label: SurveyLabel, event: Event) {
  const input = event.target as HTMLInputElement;
  const name = input.value.trim();
  if (name) changeLabel(label.id, { name });
  else input.value = label.name;
}

function recolor(label: SurveyLabel, event: Event) {
  changeLabel(label.id, { color: (event.target as HTMLInputElement).value });
}

function remove(id: string) {
  emit("update", { labels: props.block.labels.filter((label) => label.id !== id) });
}

function add() {
  const count = props.block.labels.length;
  const label = {
    id: crypto.randomUUID(),
    name: `Label ${count + 1}`,
    color: LABEL_COLORS[count % LABEL_COLORS.length]!,
  };
  emit("update", { labels: [...props.block.labels, label] });
}

function setTools(value: unknown) {
  if (!Array.isArray(value)) return;
  const tools = LABEL_TOOLS.filter((tool) => value.includes(tool));
  if (tools.length) emit("update", { tools });
}
</script>

<template>
  <div class="flex flex-col gap-2 border-t pt-3">
    <span class="text-sm text-muted-foreground">Labels</span>
    <ul aria-label="Labels" class="flex flex-col gap-2">
      <li v-for="label in block.labels" :key="label.id" class="flex items-center gap-2">
        <input
          type="color"
          :value="label.color"
          :aria-label="`Color of ${label.name}`"
          class="size-8 shrink-0 cursor-pointer rounded-md border bg-background p-0.5"
          @change="recolor(label, $event)"
        />
        <Input
          :default-value="label.name"
          :aria-label="`Name of ${label.name}`"
          maxlength="100"
          @change="rename(label, $event)"
        />
        <Button
          variant="outline"
          size="icon-sm"
          :aria-label="`Remove ${label.name}`"
          :disabled="block.labels.length === 1"
          @click="remove(label.id)"
        >
          <Trash />
        </Button>
      </li>
    </ul>
    <div class="flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" :disabled="block.labels.length >= 20" @click="add">
        <Plus data-icon="inline-start" />
        Add label
      </Button>
      <div class="flex items-center gap-2">
        <span :id="`${uid}-tools`" class="text-sm text-muted-foreground">Tools</span>
        <ToggleGroup
          type="multiple"
          variant="outline"
          orientation="horizontal"
          :aria-labelledby="`${uid}-tools`"
          :model-value="block.tools"
          @update:model-value="setTools"
        >
          <ToggleGroupItem v-for="tool in LABEL_TOOLS" :key="tool" :value="tool">
            {{ toolNames[tool] }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  </div>
</template>
