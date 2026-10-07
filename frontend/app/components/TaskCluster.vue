<script setup lang="ts">
const props = defineProps<{ uid: number; editing: boolean }>();
const data = defineModel<ClusterData>({ required: true });

// every point there is room for, to plot them
const { table, status, message } = useCopiedRows(
  props.uid,
  computed(() => data.value.source),
  "points",
);

// the columns plotted: the first two until chosen, and again when the source has no such column
watch(table, (t) => {
  if (!t) return;
  const d = data.value;
  if (!d.x || !t.columns.includes(d.x)) d.x = t.columns[0];
  if (!d.y || !t.columns.includes(d.y)) d.y = t.columns[1] ?? t.columns[0];
  if (d.color && !t.columns.includes(d.color)) d.color = undefined;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <template v-if="editing">
      <SourceBar v-model="data.source" :kinds="['observer']" />
      <RequestNote :status="status" :message="message" what="Observer" />
      <p v-if="!data.source" class="text-muted">Choose an Observer to cluster.</p>
    </template>
    <template v-if="table && data.x && data.y && status === 'idle'">
      <!-- the preview is the participant's plot: one color, whatever the ranges are -->
      <ClusterPlot
        :table="table"
        :x="data.x"
        :y="data.y"
        :color="data.color"
        :one-color="!editing"
        :breaks="data.breaks ?? []"
        :names="data.names"
        :show-no-value="data.showNoValue"
      />
      <ClusterSettings v-if="editing" v-model="data" :table="table" />
    </template>
  </div>
</template>
