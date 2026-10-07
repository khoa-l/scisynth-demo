<script setup lang="ts">
defineProps<{ title?: string; missing: string }>();
</script>

<template>
  <!-- the top of a study's sidebar: back to the list, and what this page is of -->
  <div class="p-4">
    <UButton
      label="Back"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      to="/admin"
      class="-ml-2 mb-2"
    />
    <h1 v-if="title" class="text-lg">{{ title }}</h1>
    <p v-else>{{ missing }}</p>
  </div>
</template>
