<script setup lang="ts" generic="Tab extends { label: string }">
import { cn } from "cn";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";

defineProps<{ tabs: Tab[]; label: string; contentClass?: string }>();

defineSlots<{ default?: (props: { tab: Tab }) => unknown }>();
</script>

<template>
  <TabsRoot :default-value="tabs[0]?.label" class="relative z-5 h-full">
    <TabsList :aria-label="label" class="pointer-events-none absolute bottom-full left-0 flex">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.label"
        :value="tab.label"
        class="pointer-events-auto relative -mb-px -ml-px rounded-t-lg border bg-muted px-4 py-1.5 text-sm text-muted-foreground shadow-[0_0_3px_rgb(0_0_0/0.08)] outline-none first:ml-0 first:border-l-0 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:z-20 data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_4px_rgb(0_0_0/0.15)] data-[state=active]:[clip-path:inset(-8px_-8px_0_-8px)]"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="tab in tabs"
      :key="tab.label"
      :value="tab.label"
      :class="
        cn(
          'relative z-10 h-full overflow-y-auto border-t bg-background p-4 shadow-[0_-4px_4px_-4px_rgb(0_0_0/0.15)] outline-none',
          contentClass,
        )
      "
    >
      <slot :tab="tab" />
    </TabsContent>
  </TabsRoot>
</template>
