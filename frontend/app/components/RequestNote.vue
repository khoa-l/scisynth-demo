<script setup lang="ts">
// What a component says while its data is not there: the refusal, or that it is loading
defineProps<{ status: RequestStatus; message: string; what: string }>();
</script>

<template>
  <p v-if="status === 'error'" class="text-error">
    {{ what }} unavailable{{ message ? `: ${message}` : "" }}
  </p>
  <p v-else-if="status === 'loading'" class="text-muted">Loading {{ what.toLowerCase() }}…</p>
</template>
