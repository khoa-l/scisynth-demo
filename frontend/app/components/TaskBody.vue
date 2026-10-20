<script setup lang="ts">
// A placed component: its editor in the list, or just its content in the preview
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
