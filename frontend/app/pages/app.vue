<script setup lang="ts">
const { logout } = useSession();

function signOut() {
  logout();
  navigateTo("/login");
}
</script>

<template>
  <div>
    <header class="flex items-center justify-between px-6 py-3 border-b border-default">
      <h1 class="text-xl">SciSynth</h1>
      <UButton label="Sign out" color="neutral" variant="outline" @click="signOut" />
    </header>
    <main class="p-6">
      <p>User view</p>
    </main>
  </div>
</template>
