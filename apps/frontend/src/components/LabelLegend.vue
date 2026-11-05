<script setup lang="ts">
import { Card, CardContent } from "@/components/ui/card";
import type { LabelBlock, LabeledPoints } from "@/lib/survey-blocks";

defineProps<{ block: LabelBlock; labeled?: LabeledPoints }>();
</script>

<template>
  <Card size="sm">
    <CardContent>
      <ul aria-label="Labels" class="flex flex-col gap-1.5">
        <li
          v-for="surveyLabel in block.labels"
          :key="surveyLabel.id"
          class="flex items-center gap-2"
        >
          <span class="size-3 shrink-0 rounded-sm" :style="{ background: surveyLabel.color }" />
          <span class="min-w-0 flex-1 truncate">{{ surveyLabel.name }}</span>
          <span class="text-muted-foreground tabular-nums">
            {{ labeled?.[surveyLabel.id]?.length ?? 0 }}
          </span>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
