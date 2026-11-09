<script setup lang="ts">
import { Pencil, Trash } from "@lucide/vue";
import { computed } from "vue";

import ConfirmDialog from "@/components/ConfirmDialog.vue";
import NameDialog from "@/components/NameDialog.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useDialogAction } from "@/lib/dialog-action";

const props = defineProps<{
  noun: string;
  name: string;
  maxLength?: number;
  rename: (name: string) => Promise<unknown>;
  remove: () => Promise<unknown>;
}>();

const title = computed(() => props.noun.charAt(0).toUpperCase() + props.noun.slice(1));

const renameAction = useDialogAction();
const deleteAction = useDialogAction();
const { open: renameOpen, pending: isRenaming, error: renameError } = renameAction;
const { open: deleteOpen, pending: isDeleting, error: deleteError } = deleteAction;

function onRename(name: string) {
  if (name === props.name) {
    renameOpen.value = false;
    return;
  }
  void renameAction.run(() => props.rename(name));
}

function onDelete() {
  void deleteAction.run(props.remove);
}
</script>

<template>
  <ButtonGroup
    :aria-label="`${title} actions`"
    class="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-aria-expanded:opacity-100"
  >
    <slot />
    <NameDialog
      v-model:open="renameOpen"
      :title="`Rename ${noun}`"
      :description="`Enter a new name for this ${noun}.`"
      :initial-name="name"
      :max-length="maxLength"
      :pending="isRenaming"
      :error="renameError"
      @submit="onRename"
    >
      <Button variant="outline" size="icon-sm" :aria-label="`Rename ${noun}`">
        <Pencil />
      </Button>
    </NameDialog>
    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Delete ${noun}?`"
      :description="`“${name}” will be permanently deleted. This can't be undone.`"
      confirm-label="Delete"
      destructive
      :pending="isDeleting"
      :error="deleteError"
      @confirm="onDelete"
    >
      <Button variant="outline" size="icon-sm" :aria-label="`Delete ${noun}`">
        <Trash />
      </Button>
    </ConfirmDialog>
  </ButtonGroup>
</template>
