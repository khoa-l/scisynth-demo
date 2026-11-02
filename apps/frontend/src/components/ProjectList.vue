<script setup lang="ts">
import { LayoutGrid, List } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { ref } from "vue";

import { projectsGetProjectsOptions } from "@/client/@tanstack/vue-query.gen";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type View = "list" | "grid";

const view = ref<View>("list");

const { data: projects, isPending, isError } = useQuery(projectsGetProjectsOptions());

function setView(value: unknown) {
  if (value === "list" || value === "grid") {
    view.value = value;
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex justify-end">
      <ToggleGroup
        type="single"
        variant="outline"
        :model-value="view"
        @update:model-value="setView"
      >
        <ToggleGroupItem value="list" aria-label="List view">
          <List />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <p v-if="isPending" class="text-sm text-muted-foreground">Loading projects…</p>
    <p v-else-if="isError" class="text-sm text-destructive">Couldn't load projects.</p>
    <p v-else-if="!projects?.length" class="text-sm text-muted-foreground">No projects yet.</p>
    <ul v-else-if="view === 'list'" class="divide-y rounded-md border">
      <li v-for="project in projects" :key="project.id" class="px-4 py-3 text-sm">
        {{ project.name }}
      </li>
    </ul>
    <ul v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <li
        v-for="project in projects"
        :key="project.id"
        class="aspect-square rounded-md border p-4 text-sm"
      >
        {{ project.name }}
      </li>
    </ul>
  </div>
</template>
