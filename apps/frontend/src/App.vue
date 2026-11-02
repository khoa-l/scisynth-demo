<script setup lang="ts">
import { setLucideProps } from "@lucide/vue";
import { RouterView } from "vue-router";

setLucideProps({ strokeWidth: 1.5 });
</script>

<template>
  <RouterView />
</template>
