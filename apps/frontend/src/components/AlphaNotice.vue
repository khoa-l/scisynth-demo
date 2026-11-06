<script setup lang="ts">
import { FlaskConical } from "@lucide/vue";
</script>

<template>
  <div
    role="note"
    class="flex items-center gap-2.5 rounded-sm border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm"
  >
    <FlaskConical class="size-4.5 shrink-0" />
    <span>Very early alpha — expect bugs.</span>
    <a
      href="https://github.com/khoa-l/scisynth-demo/issues"
      target="_blank"
      rel="noopener noreferrer"
      class="font-medium whitespace-nowrap underline underline-offset-2 hover:text-amber-950"
    >
      Report an issue
    </a>
  </div>
</template>
