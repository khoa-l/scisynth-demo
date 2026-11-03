<script setup lang="ts">
import { computed } from "vue";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { surveyBlocks, surveyColumnClass } from "@/lib/survey-blocks";

const props = defineProps<{ name: string; content: { [key: string]: unknown } }>();

const blocks = computed(() => surveyBlocks(props.content).filter((block) => block.text));
</script>

<template>
  <Card :class="surveyColumnClass">
    <CardHeader>
      <CardTitle>{{ name }}</CardTitle>
      <CardDescription v-if="!blocks.length">This survey has no questions yet.</CardDescription>
    </CardHeader>
    <CardContent v-if="blocks.length" class="flex flex-col gap-4">
      <p v-for="block in blocks" :key="block.id" class="text-sm wrap-anywhere whitespace-pre-line">
        {{ block.text }}
      </p>
    </CardContent>
  </Card>
</template>
