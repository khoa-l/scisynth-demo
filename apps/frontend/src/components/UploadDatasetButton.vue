<script setup lang="ts">
import { Upload } from "@lucide/vue";
import { ref, useId, watch } from "vue";

import type { DatasetFileInput } from "@/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDialogAction } from "@/lib/dialog-action";

const props = defineProps<{ upload: (file: DatasetFileInput) => Promise<unknown> }>();

const NOT_A_DATASET = "This file isn't a scisynth dataset.";

const { open, pending, error, run } = useDialogAction();
const fileId = useId();
const nameId = useId();
const contents = ref<DatasetFileInput | null>(null);
const name = ref("");

watch(open, (isOpen) => {
  if (isOpen) {
    contents.value = null;
    name.value = "";
  }
});

async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  contents.value = null;
  error.value = null;
  if (!file) return;
  try {
    contents.value = JSON.parse(await file.text());
  } catch {
    error.value = NOT_A_DATASET;
    return;
  }
  const saved = contents.value?.name;
  name.value = typeof saved === "string" ? saved : file.name.replace(/(\.scisynth)?\.json$/, "");
}

function submit() {
  const file = contents.value;
  if (!file) return;
  void run(() => props.upload({ ...file, name: name.value.trim() }), NOT_A_DATASET);
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="lg" class="mt-4 h-10 px-4">
        <Upload data-icon="inline-start" />
        Upload Dataset
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-sm">
      <form novalidate class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Upload dataset</DialogTitle>
          <DialogDescription
            >Choose a .scisynth.json file downloaded from a dataset.</DialogDescription
          >
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel :for="fileId">File</FieldLabel>
            <Input
              :id="fileId"
              type="file"
              accept=".json"
              class="overflow-hidden py-0 pl-0 file:mr-2.5 file:h-7.5 file:cursor-pointer file:items-center file:border-r file:border-input file:px-2.5 file:transition-colors file:hover:bg-muted dark:file:hover:bg-muted/50"
              @change="choose"
            />
          </Field>
          <Field v-if="contents">
            <FieldLabel :for="nameId">Name</FieldLabel>
            <Input :id="nameId" v-model="name" :maxlength="200" autocomplete="off" />
          </Field>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        </FieldGroup>
        <DialogFooter>
          <DialogClose as-child>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" :disabled="pending || !contents || !name.trim()">Upload</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
