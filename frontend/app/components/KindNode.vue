<script setup lang="ts">
import { Handle, Position, type NodeProps } from "@vue-flow/core";

defineProps<NodeProps>();
</script>

<template>
  <Handle type="target" :position="Position.Top" />
  <KindCard :type="data?.type" :label="label as string">
    <DomainAxes v-if="data?.type === 'domain'" :id="id" :axes="data.axes ?? []" />
  </KindCard>
  <Handle type="source" :position="Position.Bottom" />
</template>
