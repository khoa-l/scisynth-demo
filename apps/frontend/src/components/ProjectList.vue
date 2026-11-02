<script setup lang="ts">
import { LayoutGrid, List } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { ref } from "vue";

import { projectsGetProjectsOptions } from "@/client/@tanstack/vue-query.gen";
import ProjectActions from "@/components/ProjectActions.vue";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { projectGradient, projectTextColor } from "@/lib/gradient";

type View = "list" | "grid";

const view = ref<View>("grid");

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
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List view">
          <List />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <p v-if="isPending" class="text-sm text-muted-foreground">Loading projects…</p>
    <p v-else-if="isError" class="text-sm text-destructive">Couldn't load projects.</p>
    <p v-else-if="!projects?.length" class="text-sm text-muted-foreground">No projects yet.</p>
    <ul v-else-if="view === 'list'" class="divide-y overflow-hidden rounded-md border">
      <li
        v-for="project in projects"
        :key="project.id"
        class="group flex items-center justify-between gap-4 px-4 py-2 text-sm transition-colors hover:bg-muted"
      >
        <span class="truncate">{{ project.name }}</span>
        <ProjectActions :project="project" class="shrink-0" />
      </li>
    </ul>
    <ul v-else class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
      <li v-for="project in projects" :key="project.id" class="group relative min-w-0">
        <div
          class="relative aspect-square overflow-hidden rounded-md transition group-hover:brightness-95"
          :style="{ background: projectGradient(project.id) }"
        >
          <span
            aria-hidden="true"
            class="absolute bottom-4 left-3 text-3xl leading-none font-semibold whitespace-nowrap select-none"
            :style="{ color: projectTextColor(project.id) }"
          >
            {{ project.name }}
          </span>
        </div>
        <ProjectActions :project="project" class="absolute top-2 right-2" />
        <p class="mt-1.5 truncate text-center text-sm">{{ project.name }}</p>
      </li>
    </ul>
  </div>
</template>
