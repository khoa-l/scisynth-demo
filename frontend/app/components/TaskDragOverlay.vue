<script setup lang="ts">
import { DragOverlay } from "@dnd-kit/vue";
</script>

<template>
  <!-- no drop animation: the card is gone where it is dropped, it does not fly back -->
  <DragOverlay v-slot="{ source }" :drop-animation="null">
    <div
      v-if="componentTypeOf(source?.id)"
      class="flex items-center gap-2 rounded-md border border-accented bg-elevated px-3 py-2 shadow-md"
    >
      <UIcon :name="taskComponentOf(componentTypeOf(source?.id)!).icon" class="size-4 text-muted" />
      {{ taskComponentOf(componentTypeOf(source?.id)!).label }}
    </div>
  </DragOverlay>
</template>
