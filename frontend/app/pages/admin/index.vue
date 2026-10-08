<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";

const { studies, load, add, moveStudy } = useStudies();

await load();
</script>

<template>
  <div>
    <AppHeader />
    <main class="p-6">
      <div class="flex justify-end">
        <UButton label="New Study" icon="i-lucide-plus" @click="add" />
      </div>
      <DragDropProvider @drag-end="onSorted(moveStudy)">
        <ul class="mt-4 flex flex-col gap-2">
          <StudyRow
            v-for="(study, index) in studies"
            :key="study.id"
            :study="study"
            :index="index"
          />
        </ul>
      </DragDropProvider>
      <p v-if="studies.length === 0" class="mt-4">No studies yet.</p>
    </main>
  </div>
</template>
