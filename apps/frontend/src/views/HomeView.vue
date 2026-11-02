<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";

import { authLogoutMutation } from "@/client/@tanstack/vue-query.gen";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { meQueryOptions } from "@/lib/auth";

const router = useRouter();
const queryClient = useQueryClient();
const { data: user } = useQuery(meQueryOptions);

const { mutate: logout, isPending } = useMutation({
  ...authLogoutMutation(),
  onSuccess: async () => {
    queryClient.clear();
    queryClient.setQueryData(meQueryOptions.queryKey, null);
    await router.push({ name: "login" });
  },
});
</script>

<template>
  <main class="flex min-h-svh items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
        <CardDescription>Signed in as {{ user?.email }}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" :disabled="isPending" @click="logout({})">Log out</Button>
      </CardFooter>
    </Card>
  </main>
</template>
