<script setup lang="ts">
import { setLucideProps } from "@lucide/vue";
import { RouterView, useRoute } from "vue-router";

import AlphaNotice from "@/components/AlphaNotice.vue";

setLucideProps({ strokeWidth: 1.5 });

const route = useRoute();
</script>

<template>
  <RouterView />
  <AlphaNotice
    v-if="route.name !== 'login' && route.name !== 'register'"
    class="fixed top-4 right-4 z-50"
  />
</template>
