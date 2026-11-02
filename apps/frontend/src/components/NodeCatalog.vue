<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";

import { NODE_KIND_MIME, nodeCategories, type NodeKind } from "@/lib/node-kinds";

function startDrag(event: DragEvent, kind: NodeKind) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(NODE_KIND_MIME, kind.name);
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <TabsRoot :default-value="nodeCategories[0]?.label" class="relative h-full">
    <TabsList
      aria-label="Component categories"
      class="pointer-events-none absolute bottom-full left-0 z-10 flex"
    >
      <TabsTrigger
        v-for="category in nodeCategories"
        :key="category.label"
        :value="category.label"
        class="pointer-events-auto relative -mb-px -ml-px rounded-t-lg border bg-muted px-4 py-1.5 text-sm text-muted-foreground outline-none first:ml-0 first:border-l-0 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:z-10 data-[state=active]:shadow-sm data-[state=active]:[clip-path:inset(-8px_-8px_0_-8px)] data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:text-foreground"
      >
        {{ category.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="category in nodeCategories"
      :key="category.label"
      :value="category.label"
      class="h-full overflow-y-auto border-t bg-background p-4 outline-none"
    >
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="kind in category.kinds"
          :key="kind.name"
          draggable="true"
          class="cursor-grab rounded-md border bg-background px-2 py-1 text-sm select-none hover:bg-muted active:cursor-grabbing"
          @dragstart="startDrag($event, kind)"
        >
          {{ kind.label }}
        </li>
      </ul>
    </TabsContent>
  </TabsRoot>
</template>
