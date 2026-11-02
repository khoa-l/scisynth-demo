<script setup lang="ts">
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import { Background } from "@vue-flow/background";
import { VueFlow, type Edge, type Node } from "@vue-flow/core";
import { ref } from "vue";

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" aria-label="Node graph" class="bg-muted inset-shadow-sm">
    <Background variant="lines" color="#dcdcdc" />
  </VueFlow>
</template>
