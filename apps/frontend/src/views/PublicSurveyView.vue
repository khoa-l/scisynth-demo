<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { publicGetPublishedOptions } from "@/client/@tanstack/vue-query.gen";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const props = defineProps<{ publicId: string }>();

const {
  data: survey,
  isPending,
  isError,
} = useQuery(
  computed(() => ({
    ...publicGetPublishedOptions({ path: { public_id: props.publicId } }),
    retry: false,
  })),
);
</script>

<template>
  <main class="flex min-h-svh items-center justify-center p-4">
    <p v-if="isPending" class="text-sm text-muted-foreground">Loading survey…</p>
    <p v-else-if="isError || !survey" class="text-sm text-muted-foreground">
      This survey isn't available.
    </p>
    <Card v-else class="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{{ survey.name }}</CardTitle>
        <CardDescription v-if="!Object.keys(survey.content).length">
          This survey has no questions yet.
        </CardDescription>
      </CardHeader>
    </Card>
  </main>
</template>
