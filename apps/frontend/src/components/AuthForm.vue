<script setup lang="ts">
import { useForm, type AnyFieldApi } from "@tanstack/vue-form";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { z } from "zod";

import { authLogin, authRegister } from "@/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage, meQueryOptions } from "@/lib/auth";

const props = defineProps<{ mode: "login" | "register" }>();

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();

const isRegister = props.mode === "register";

const copy = isRegister
  ? {
      title: "Create an account",
      description: "Enter your email and choose a password.",
      submit: "Create account",
      prompt: "Already have an account?",
      link: { label: "Log in", to: { name: "login", query: route.query } },
    }
  : {
      title: "Log in",
      description: "Enter your email and password to sign in.",
      submit: "Log in",
      prompt: "Don't have an account?",
      link: { label: "Sign up", to: { name: "register", query: route.query } },
    };

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: isRegister
    ? z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters")
    : z.string().min(1, "Enter your password"),
});

type Credentials = z.infer<typeof schema>;

const { mutate, isPending, error } = useMutation({
  mutationFn: async (body: Credentials) => {
    const { data } = isRegister
      ? await authRegister({ body, throwOnError: true })
      : await authLogin({ body, throwOnError: true });
    return data;
  },
  onSuccess: async (user) => {
    queryClient.setQueryData(meQueryOptions.queryKey, user);
    const redirect = route.query.redirect;
    await router.push(typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/");
  },
});

const submitError = computed(() => (error.value ? errorMessage(error.value) : null));

const form = useForm({
  defaultValues: { email: "", password: "" },
  validators: { onSubmit: schema },
  onSubmit: ({ value }) => mutate(value),
});

function isInvalid(field: AnyFieldApi) {
  return field.state.meta.isTouched && !field.state.meta.isValid;
}
</script>

<template>
  <Card class="w-full max-w-sm">
    <CardHeader>
      <CardTitle>{{ copy.title }}</CardTitle>
      <CardDescription>{{ copy.description }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form id="auth-form" novalidate @submit.prevent="() => form.handleSubmit()">
        <FieldGroup>
          <form.Field name="email">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">Email</FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  type="email"
                  autocomplete="email"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  @blur="field.handleBlur"
                  @update:model-value="(value) => field.handleChange(String(value))"
                />
                <FieldError v-if="isInvalid(field)" :errors="field.state.meta.errors" />
              </Field>
            </template>
          </form.Field>
          <form.Field name="password">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">Password</FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  type="password"
                  :autocomplete="isRegister ? 'new-password' : 'current-password'"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  @blur="field.handleBlur"
                  @update:model-value="(value) => field.handleChange(String(value))"
                />
                <FieldError v-if="isInvalid(field)" :errors="field.state.meta.errors" />
              </Field>
            </template>
          </form.Field>
          <p v-if="submitError" role="alert" class="text-sm text-destructive">
            {{ submitError }}
          </p>
        </FieldGroup>
      </form>
    </CardContent>
    <CardFooter class="flex-col gap-4">
      <Button type="submit" form="auth-form" class="w-full" :disabled="isPending">
        {{ copy.submit }}
      </Button>
      <p class="text-sm text-muted-foreground">
        {{ copy.prompt }}
        <RouterLink :to="copy.link.to" class="text-foreground underline underline-offset-4">
          {{ copy.link.label }}
        </RouterLink>
      </p>
    </CardFooter>
  </Card>
</template>
