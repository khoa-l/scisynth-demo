<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed, useId } from "vue";

import SurveyNodePicker from "@/components/SurveyNodePicker.vue";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LABEL_TOOLS, labelToolNames, type ChartBlock, type LabelBlock } from "@/lib/survey-blocks";
import { liveNodePreview } from "@/lib/survey-charts";

const props = defineProps<{ projectId: string; block: ChartBlock | LabelBlock }>();
const emit = defineEmits<{
  update: [
    changes:
      | Pick<ChartBlock, "source">
      | Pick<ChartBlock, "appearance">
      | Pick<LabelBlock, "tools">,
  ];
}>();

const uid = useId();

const { data: preview } = useQuery(
  computed(() => ({
    ...liveNodePreview(
      props.projectId,
      props.block.source?.dataset_id ?? "",
      props.block.source?.node_id ?? "",
    ),
    enabled: !!props.block.source,
    retry: false,
  })),
);

const channelCount = computed(() => preview.value?.channels.length ?? 0);
const hasChannels = computed(() => !!props.block.source && channelCount.value > 1);

function choose(datasetId: string, nodeId: string) {
  emit("update", { source: { dataset_id: datasetId, node_id: nodeId, channels: [0] } });
}

function setChannels(value: unknown) {
  if (!props.block.source || !Array.isArray(value) || !value.length) return;
  const channels = value.filter(Number.isInteger).sort((a, b) => a - b);
  emit("update", { source: { ...props.block.source, channels } });
}

function setTools(value: unknown) {
  if (!Array.isArray(value)) return;
  const tools = LABEL_TOOLS.filter((tool) => value.includes(tool));
  if (tools.length) emit("update", { tools });
}

function setAppearance(value: unknown) {
  if (value === "shown" || value === "blank") emit("update", { appearance: value });
}
</script>

<template>
  <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-3">
    <Label :for="`${uid}-data`" class="text-muted-foreground">Data</Label>
    <div class="flex items-center gap-2">
      <SurveyNodePicker
        :id="`${uid}-data`"
        :project-id="projectId"
        :source="block.source"
        @choose="choose"
      />
      <ToggleGroup
        type="single"
        variant="outline"
        orientation="horizontal"
        aria-label="Show as"
        class="shrink-0"
        :model-value="block.appearance"
        @update:model-value="setAppearance"
      >
        <ToggleGroupItem value="shown">Data</ToggleGroupItem>
        <ToggleGroupItem value="blank">Blank</ToggleGroupItem>
      </ToggleGroup>
    </div>
    <template v-if="hasChannels || block.type === 'label'">
      <span v-if="hasChannels" :id="`${uid}-channels`" class="text-sm text-muted-foreground">
        Channels
      </span>
      <span v-else :id="`${uid}-tools`" class="text-sm text-muted-foreground">Tools</span>
      <div class="flex flex-wrap items-center gap-2">
        <ToggleGroup
          v-if="hasChannels"
          type="multiple"
          variant="outline"
          orientation="horizontal"
          :aria-labelledby="`${uid}-channels`"
          :model-value="block.source?.channels"
          @update:model-value="setChannels"
        >
          <ToggleGroupItem
            v-for="index in channelCount"
            :key="index"
            :value="index - 1"
            :aria-label="`Channel ${index}`"
          >
            {{ index }}
          </ToggleGroupItem>
        </ToggleGroup>
        <div
          v-if="block.type === 'label'"
          class="flex items-center gap-2"
          :class="{ 'ml-auto': hasChannels }"
        >
          <span v-if="hasChannels" :id="`${uid}-tools`" class="text-sm text-muted-foreground">
            Tools
          </span>
          <ToggleGroup
            type="multiple"
            variant="outline"
            orientation="horizontal"
            :aria-labelledby="`${uid}-tools`"
            :model-value="block.tools"
            @update:model-value="setTools"
          >
            <ToggleGroupItem v-for="tool in LABEL_TOOLS" :key="tool" :value="tool">
              {{ labelToolNames[tool] }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </template>
  </div>
</template>
