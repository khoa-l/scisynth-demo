<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";

const { logout } = useSession();
const { studies, load, add, moveStudy } = useStudies();

await load();

// Dropping a study in a new place (its tasks have a list of their own, in StudyRow)
function onDragEnd(event: Parameters<typeof sortedMove>[0]) {
  const move = sortedMove(event);
  if (move) void moveStudy(move.from, move.to);
}

function signOut() {
  logout();
  navigateTo("/login");
}
</script>

<template>
  <div>
    <header class="flex items-center justify-between px-6 py-3 border-b border-default">
      <h1 class="text-xl">SciSynth</h1>
      <UButton label="Sign out" color="neutral" variant="outline" @click="signOut" />
    </header>
    <main class="p-6">
      <div class="flex justify-end">
        <UButton label="New Study" icon="i-lucide-plus" @click="add" />
      </div>
      <DragDropProvider @drag-end="onDragEnd">
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
