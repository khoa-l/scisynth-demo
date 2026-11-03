<script setup lang="ts" generic="Item extends { id: string; name: string }">
import { LayoutGrid, List } from "@lucide/vue";
import { ref } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

import ItemActions from "@/components/ItemActions.vue";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { itemGradient, itemTextColor } from "@/lib/gradient";

const props = defineProps<{
  items: Item[] | undefined;
  isPending: boolean;
  isError: boolean;
  noun: string;
  plural: string;
  to?: (item: Item) => RouteLocationRaw;
  rename: (item: Item, name: string) => Promise<unknown>;
  remove: (item: Item) => Promise<unknown>;
}>();

defineSlots<{ actions?: (props: { item: Item }) => unknown }>();

type View = "list" | "grid";

const view = ref<View>("grid");

function setView(value: unknown) {
  if (value === "list" || value === "grid") {
    view.value = value;
  }
}

function itemLink(item: Item) {
  return props.to ? { is: RouterLink, to: props.to(item) } : { is: "div" };
}
</script>

<template>
  <div>
    <div class="mb-4 flex justify-end">
      <ToggleGroup
        type="single"
        variant="outline"
        orientation="horizontal"
        :model-value="view"
        @update:model-value="setView"
      >
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List view">
          <List />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <p v-if="isPending" class="text-sm text-muted-foreground">Loading {{ plural }}…</p>
    <p v-else-if="isError" class="text-sm text-destructive">Couldn't load {{ plural }}.</p>
    <p v-else-if="!items?.length" class="text-sm text-muted-foreground">No {{ plural }} yet.</p>
    <ul v-else-if="view === 'list'" class="divide-y overflow-hidden rounded-md border">
      <li
        v-for="item in items"
        :key="item.id"
        class="group relative flex items-center justify-between gap-4 px-4 py-2 text-sm transition-colors focus-within:bg-muted hover:bg-muted"
      >
        <component
          :is="itemLink(item).is"
          :to="itemLink(item).to"
          class="min-w-0 truncate outline-none after:absolute after:inset-0"
        >
          {{ item.name }}
        </component>
        <ItemActions
          :noun="noun"
          :name="item.name"
          :rename="(name) => rename(item, name)"
          :remove="() => remove(item)"
          class="relative z-10 shrink-0"
        >
          <slot name="actions" :item="item" />
        </ItemActions>
      </li>
    </ul>
    <ul
      v-else
      class="grid grid-cols-[repeat(auto-fill,minmax(max(8rem,calc((100%_-_4.5rem)/10)),1fr))] gap-2"
    >
      <li v-for="item in items" :key="item.id" class="group relative min-w-0">
        <component
          :is="itemLink(item).is"
          :to="itemLink(item).to"
          class="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div
            class="relative aspect-square overflow-hidden rounded-md transition group-hover:brightness-95"
            :style="{ background: itemGradient(item.id) }"
          >
            <span
              aria-hidden="true"
              class="absolute bottom-4 left-3 text-3xl leading-none font-semibold whitespace-nowrap select-none"
              :style="{ color: itemTextColor(item.id) }"
            >
              {{ item.name }}
            </span>
          </div>
          <p class="mt-1.5 truncate text-center text-sm">{{ item.name }}</p>
        </component>
        <ItemActions
          :noun="noun"
          :name="item.name"
          :rename="(name) => rename(item, name)"
          :remove="() => remove(item)"
          class="absolute top-2 right-2"
        >
          <slot name="actions" :item="item" />
        </ItemActions>
      </li>
    </ul>
  </div>
</template>
