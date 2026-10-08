<script setup lang="ts">
const { logout } = useSession();

function signOut() {
  logout();
  navigateTo("/login");
}
</script>

<template>
  <header class="flex items-center justify-between border-b border-default px-6 py-3">
    <h1 class="text-xl">SciSynth</h1>
    <UButton label="Sign out" color="neutral" variant="outline" @click="signOut" />
  </header>
</template>
