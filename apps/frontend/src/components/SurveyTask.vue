<script setup lang="ts">
import { computed, ref, watch } from "vue";

import SurveyScale from "@/components/SurveyScale.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { surveyBlocks, surveyColumnClass, type ContentBlock } from "@/lib/survey-blocks";

const props = defineProps<{
  name: string;
  content: { [key: string]: unknown };
  submitting?: boolean;
}>();

defineEmits<{ submit: [answers: Record<string, number>] }>();

const answers = ref<Record<string, number>>({});

function setAnswer(id: string, point: number | undefined) {
  if (point === undefined) delete answers.value[id];
  else answers.value[id] = point;
}

const blocks = computed(() => surveyBlocks(props.content));

const pages = computed(() => {
  const pages: ContentBlock[][][] = [[[]]];
  for (const block of blocks.value) {
    if (block.type === "end") break;
    if (block.type === "page") pages.push([[]]);
    else if (block.type === "separator") pages.at(-1)!.push([]);
    else if (block.text) pages.at(-1)!.at(-1)!.push(block);
  }
  return pages.map((cards) => cards.filter((card) => card.length)).filter((cards) => cards.length);
});

const ends = computed(() => blocks.value.some((block) => block.type === "end"));

const page = ref(0);
watch(
  () => pages.value.length,
  (count) => {
    page.value = Math.min(page.value, Math.max(count - 1, 0));
  },
);

const cards = computed(() => pages.value[page.value] ?? [[]]);
const isEmpty = computed(() => !pages.value.length);
const isLastPage = computed(() => page.value >= pages.value.length - 1);
const hasFooter = computed(
  () => !isEmpty.value && (page.value > 0 || !isLastPage.value || ends.value),
);
</script>

<template>
  <div class="flex flex-col gap-4" :class="surveyColumnClass">
    <Card v-for="(card, index) in cards" :key="`${page}-${index}`">
      <CardHeader v-if="index === 0">
        <CardTitle>{{ name }}</CardTitle>
        <CardDescription v-if="isEmpty">This survey has no questions yet.</CardDescription>
      </CardHeader>
      <CardContent v-if="card.length" class="flex flex-col gap-4">
        <template v-for="block in card" :key="block.id">
          <div v-if="block.type === 'scale'" class="flex flex-col gap-2">
            <p :id="`question-${block.id}`" class="text-sm font-medium wrap-anywhere">
              {{ block.text }}
            </p>
            <SurveyScale
              :model-value="answers[block.id]"
              :aria-labelledby="`question-${block.id}`"
              @update:model-value="setAnswer(block.id, $event)"
            />
          </div>
          <p v-else class="text-sm wrap-anywhere whitespace-pre-line">{{ block.text }}</p>
        </template>
      </CardContent>
      <CardFooter v-if="index === cards.length - 1 && hasFooter" class="gap-2">
        <Button v-if="page > 0" variant="outline" @click="page--">Back</Button>
        <Button v-if="!isLastPage" class="ml-auto" @click="page++">Next</Button>
        <Button
          v-else-if="ends"
          class="ml-auto"
          :disabled="submitting"
          @click="$emit('submit', answers)"
        >
          {{ submitting ? "Submitting…" : "Submit" }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>
