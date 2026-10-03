<script setup lang="ts">
const { logout } = useSession();
const { studies, add, remove } = useStudies();

const editingId = ref<number | null>(null);

function finishEdit() {
  editingId.value = null;
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
      <ul class="mt-4 flex flex-col gap-2">
        <li
          v-for="study in studies"
          :key="study.id"
          class="flex items-center justify-between rounded-md border border-default py-1 pl-4 pr-2"
        >
          <span class="flex items-center gap-1">
            <UInput
              v-if="editingId === study.id"
              v-model="study.name"
              autofocus
              :aria-label="`Name of ${study.name}`"
              @keydown.enter="finishEdit"
              @keydown.esc="finishEdit"
              @blur="finishEdit"
            />
            <template v-else>
              <span>{{ study.name }}</span>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`Rename ${study.name}`"
                @click="editingId = study.id"
              />
            </template>
          </span>
          <span class="flex gap-1">
            <UButton
              icon="i-lucide-workflow"
              color="neutral"
              variant="ghost"
              :aria-label="`Open ${study.name}`"
              :to="`/admin/studies/${study.id}`"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              :aria-label="`Delete ${study.name}`"
              @click="remove(study.id)"
            />
          </span>
        </li>
      </ul>
      <p v-if="studies.length === 0" class="mt-4">No studies yet.</p>
    </main>
  </div>
</template>
