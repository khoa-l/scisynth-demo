<script setup lang="ts">
defineProps<{ editing: boolean }>();
const data = defineModel<TextData>({ required: true });
</script>

<template>
  <UTextarea
    v-if="editing"
    v-model="data.text"
    :rows="3"
    autoresize
    placeholder="Write the text here"
    class="w-full"
  />
  <p v-else class="whitespace-pre-wrap">{{ data.text }}</p>
</template>
