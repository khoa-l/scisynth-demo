<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";

import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

defineEmits<{ retry: [] }>();
</script>

<template>
  <Alert variant="destructive">
    <CircleAlert />
    <AlertTitle>Couldn't save your changes.</AlertTitle>
    <AlertAction>
      <Button variant="outline" size="sm" @click="$emit('retry')">Try again</Button>
    </AlertAction>
  </Alert>
</template>
