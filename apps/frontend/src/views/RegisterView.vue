<script setup lang="ts">
import AlphaNotice from "@/components/AlphaNotice.vue";
import AuthForm from "@/components/AuthForm.vue";
</script>

<template>
  <main class="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
    <AuthForm mode="register" />
    <AlphaNotice />
  </main>
</template>
