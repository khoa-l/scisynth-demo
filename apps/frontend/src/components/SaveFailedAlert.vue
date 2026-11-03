<script setup lang="ts">
import { Button } from "@/components/ui/button";

defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    role="alert"
    class="flex items-center justify-between gap-2 rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
  >
    <span>Couldn't save your changes.</span>
    <Button variant="outline" size="sm" @click="$emit('retry')">Try again</Button>
  </div>
</template>
