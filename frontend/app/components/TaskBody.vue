<script setup lang="ts">
// What a placed component shows: its editor in the list, or just its content in the preview. The
// editors change the item's data in place.
defineProps<{ item: PlacedComponent; editing: boolean }>();
</script>

<template>
  <TaskText v-if="item.type === 'text'" :model-value="item.data as TextData" :editing="editing" />
  <TaskTable
    v-else-if="item.type === 'table'"
    :model-value="item.data as TableData"
    :uid="item.uid"
    :editing="editing"
  />
  <TaskCluster
    v-else-if="item.type === 'cluster'"
    :model-value="item.data as ClusterData"
    :uid="item.uid"
    :editing="editing"
  />
  <TaskPlot
    v-else-if="item.type === 'plot'"
    :model-value="item.data as PlotData"
    :uid="item.uid"
    :editing="editing"
  />
</template>
