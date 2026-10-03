<script setup lang="ts">
const { login } = useSession();

const items = [
  { label: "User", value: "user" },
  { label: "Admin", value: "admin" },
];
const selected = ref<Role>("user");

function submit() {
  login(selected.value);
  navigateTo(selected.value === "admin" ? "/admin" : "/app");
}
</script>

<template>
  <main class="min-h-screen grid place-items-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl">SciSynth</h1>
        <p class="text-sm text-muted">Choose how you want to sign in</p>
      </template>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <UTabs v-model="selected" :items="items" :content="false" aria-label="Sign in as" />
        <UButton
          type="submit"
          block
          :label="`Sign in as ${selected === 'admin' ? 'Admin' : 'User'}`"
        />
      </form>
    </UCard>
  </main>
</template>
