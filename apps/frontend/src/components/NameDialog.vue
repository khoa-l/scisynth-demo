<script setup lang="ts">
import { useForm, type AnyFieldApi } from "@tanstack/vue-form";
import { useId, watch } from "vue";
import { z } from "zod";

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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    label?: string;
    submitLabel?: string;
    initialName?: string;
    maxLength?: number;
    pending?: boolean;
    error?: string | null;
  }>(),
  {
    description: undefined,
    label: "Name",
    submitLabel: "Save",
    initialName: "",
    maxLength: 200,
    pending: false,
    error: null,
  },
);

const emit = defineEmits<{ submit: [name: string] }>();

const open = defineModel<boolean>("open", { default: false });

const inputId = useId();

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(props.maxLength, `Use at most ${props.maxLength} characters`),
});

const form = useForm({
  defaultValues: { name: props.initialName },
  validators: { onSubmit: schema },
  onSubmit: ({ value }) => emit("submit", value.name.trim()),
});

watch(open, (isOpen) => {
  if (isOpen) {
    form.reset({ name: props.initialName });
  }
});

function isInvalid(field: AnyFieldApi) {
  return field.state.meta.isTouched && !field.state.meta.isValid;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="sm:max-w-sm">
      <form novalidate class="grid gap-4" @submit.prevent="() => form.handleSubmit()">
        <DialogHeader>
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription v-if="description">{{ description }}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <form.Field name="name">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="inputId">{{ label }}</FieldLabel>
                <Input
                  :id="inputId"
                  :name="field.name"
                  :maxlength="maxLength"
                  autocomplete="off"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  @blur="field.handleBlur"
                  @update:model-value="(value) => field.handleChange(String(value))"
                />
                <FieldError v-if="isInvalid(field)" :errors="field.state.meta.errors" />
              </Field>
            </template>
          </form.Field>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        </FieldGroup>
        <DialogFooter>
          <DialogClose as-child>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" :disabled="pending">{{ submitLabel }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
