<script setup lang="ts">
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";

const route = useRoute();
const { get } = useStudies();

const study = computed(() => get(Number(route.params.id)));
</script>

<template>
  <div class="h-screen flex">
    <aside class="w-64 shrink-0 border-r border-default flex flex-col">
      <div class="p-4">
        <UButton
          label="Back"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          to="/admin"
          class="-ml-2 mb-2"
        />
        <h1 v-if="study" class="text-lg">{{ study.name }}</h1>
        <p v-else>Study not found.</p>
      </div>
      <section class="flex-1 border-t border-default p-4" />
      <section class="flex-1 border-t border-default p-4" />
    </aside>
    <main class="relative flex-1">
      <VueFlow>
        <Background />
        <Controls />
        <MiniMap />
      </VueFlow>
    </main>
  </div>
</template>
