<script setup lang="ts">
import { ArrowLeft, ClipboardList, Database, LayoutDashboard } from "@lucide/vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { authLogoutMutation } from "@/client/@tanstack/vue-query.gen";
import { Button } from "@/components/ui/button";
import { meQueryOptions } from "@/lib/auth";

const route = useRoute();

const projectTabs = [
  { name: "project", section: "overview", label: "Overview", icon: LayoutDashboard },
  { name: "project-datasets", section: "datasets", label: "Datasets", icon: Database },
  { name: "project-survey", section: "survey", label: "Survey", icon: ClipboardList },
] as const;

const projectId = computed(() => {
  const value = route.params.projectId;
  return typeof value === "string" ? value : null;
});
const router = useRouter();
const queryClient = useQueryClient();
const { data: user } = useQuery(meQueryOptions);

const { mutate: logout, isPending: isLoggingOut } = useMutation({
  ...authLogoutMutation(),
  onSuccess: async () => {
    queryClient.clear();
    queryClient.setQueryData(meQueryOptions.queryKey, null);
    await router.push({ name: "login" });
  },
});
</script>

<template>
  <div class="flex h-svh overflow-hidden bg-sidebar">
    <aside class="flex w-56 shrink-0 flex-col border-r bg-sidebar p-4 text-sidebar-foreground">
      <nav v-if="projectId !== null" class="flex flex-col gap-1">
        <Button variant="ghost" as-child class="w-full justify-start">
          <RouterLink :to="{ name: 'home' }">
            <ArrowLeft data-icon="inline-start" />
            Dashboard
          </RouterLink>
        </Button>
        <div role="group" aria-label="Project sections" class="mt-3 flex flex-col gap-1">
          <Button
            v-for="tab in projectTabs"
            :key="tab.name"
            variant="ghost"
            size="lg"
            as-child
            class="h-10 w-full justify-start px-4"
            :class="{ 'bg-background': route.meta.projectSection === tab.section }"
          >
            <RouterLink :to="{ name: tab.name, params: { projectId } }">
              <component :is="tab.icon" data-icon="inline-start" />
              {{ tab.label }}
            </RouterLink>
          </Button>
        </div>
      </nav>
      <div class="mt-auto flex flex-col gap-2">
        <p v-if="user" class="truncate px-1 text-sm text-muted-foreground" :title="user.email">
          {{ user.email }}
        </p>
        <Button variant="outline" class="w-full" :disabled="isLoggingOut" @click="logout({})">
          Log out
        </Button>
      </div>
    </aside>
    <main
      class="relative z-10 min-w-0 flex-1 overflow-auto rounded-tl-xl bg-background p-6 shadow-lg"
    >
      <RouterView />
    </main>
  </div>
</template>
