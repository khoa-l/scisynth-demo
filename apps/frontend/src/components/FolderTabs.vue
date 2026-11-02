<script setup lang="ts" generic="Tab extends { label: string }">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";

defineProps<{ tabs: Tab[]; label: string }>();

defineSlots<{ default?: (props: { tab: Tab }) => unknown }>();
</script>

<template>
  <TabsRoot :default-value="tabs[0]?.label" class="relative h-full">
    <TabsList :aria-label="label" class="pointer-events-none absolute bottom-full left-0 z-10 flex">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.label"
        :value="tab.label"
        class="pointer-events-auto relative -mb-px -ml-px rounded-t-lg border bg-muted px-4 py-1.5 text-sm text-muted-foreground outline-none first:ml-0 first:border-l-0 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:z-10 data-[state=active]:shadow-sm data-[state=active]:[clip-path:inset(-8px_-8px_0_-8px)] data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:text-foreground"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="tab in tabs"
      :key="tab.label"
      :value="tab.label"
      class="h-full overflow-y-auto border-t bg-background p-4 outline-none"
    >
      <slot :tab="tab" />
    </TabsContent>
  </TabsRoot>
</template>
