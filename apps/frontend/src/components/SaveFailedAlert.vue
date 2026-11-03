<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";

import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

defineEmits<{ retry: [] }>();
</script>

<template>
  <Alert variant="destructive" class="w-max py-3 shadow-sm has-data-[slot=alert-action]:pr-24">
    <CircleAlert />
    <AlertTitle>Couldn't save your changes.</AlertTitle>
    <AlertAction class="top-1/2 -translate-y-1/2">
      <Button variant="outline" size="sm" @click="$emit('retry')">Try again</Button>
    </AlertAction>
  </Alert>
</template>
