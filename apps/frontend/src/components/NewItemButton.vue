<script setup lang="ts">
import { Plus } from "@lucide/vue";

import NameDialog from "@/components/NameDialog.vue";
import { Button } from "@/components/ui/button";
import { useDialogAction } from "@/lib/dialog-action";

const props = defineProps<{
  label: string;
  title: string;
  description: string;
  initialName: string;
  create: (name: string) => Promise<unknown>;
}>();

const { open, pending, error, run } = useDialogAction();
</script>

<template>
  <NameDialog
    v-model:open="open"
    :title="title"
    :description="description"
    submit-label="Create"
    :initial-name="initialName"
    :pending="pending"
    :error="error"
    @submit="(name) => run(() => props.create(name))"
  >
    <Button variant="outline" size="lg" class="mt-4 h-10 px-4">
      <Plus data-icon="inline-start" />
      {{ label }}
    </Button>
  </NameDialog>
</template>
