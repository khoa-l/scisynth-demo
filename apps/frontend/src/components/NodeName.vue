<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from "vue";

import { NAME_MAX_LENGTH } from "@/lib/dataset-nodes/graph";

const props = defineProps<{ name?: string | null; fallback: string }>();
const emit = defineEmits<{ rename: [name: string | null] }>();

const editing = ref(false);
const input = useTemplateRef<HTMLInputElement>("input");

async function edit() {
  editing.value = true;
  await nextTick();
  input.value?.select();
}

function commit() {
  if (!editing.value) return;
  editing.value = false;
  const name = input.value?.value.trim() || null;
  if (name !== (props.name ?? null)) emit("rename", name);
}

defineExpose({ edit });
</script>

<template>
  <input
    v-if="editing"
    ref="input"
    :value="name ?? ''"
    :placeholder="fallback"
    :maxlength="NAME_MAX_LENGTH"
    aria-label="Name"
    class="nodrag -mx-1 w-full min-w-0 rounded-sm bg-background px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    @keydown.enter="commit"
    @keydown.esc="editing = false"
    @blur="commit"
  />
  <span v-else class="min-w-0 truncate" :title="name || fallback" @dblclick.stop="edit">
    {{ name || fallback }}
  </span>
</template>
