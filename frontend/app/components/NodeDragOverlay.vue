<script setup lang="ts">
import { DragOverlay, useDragDropMonitor } from "@dnd-kit/vue";

// The overlay starts at the grabbed item's top-left; shift it so the node is centered on the pointer
const offset = ref({ x: 0, y: 0 });

useDragDropMonitor({
  onDragStart(event) {
    const { source, position } = event.operation;
    const rect = source?.element?.getBoundingClientRect();
    if (!rect) return;
    offset.value = {
      x: position.initial.x - rect.left - nodeWidth(kindOf(String(source?.id))) / 2,
      y: position.initial.y - rect.top - NODE_SIZE.height / 2,
    };
  },
});
</script>

<template>
  <!-- Held item looks like the node it will become -->
  <DragOverlay v-slot="{ source }" :drop-animation="null">
    <KindCard
      :type="source?.id as string"
      :style="{ transform: `translate(${offset.x}px, ${offset.y}px)` }"
    />
  </DragOverlay>
</template>
