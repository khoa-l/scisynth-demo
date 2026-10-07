<script setup lang="ts">
const props = defineProps<{ uid: number; editing: boolean }>();
const data = defineModel<TableData>({ required: true });

const { table, status, message } = useCopiedRows(
  props.uid,
  computed(() => data.value.source),
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <SourceBar v-if="editing" v-model="data.source" :kinds="['data']" />
    <RequestNote :status="status" :message="message" what="Data" />
    <p v-if="!data.source && editing" class="text-muted">Choose a Data node to show.</p>
    <DataGrid v-else-if="table && status === 'idle'" :table="table" />
  </div>
</template>
