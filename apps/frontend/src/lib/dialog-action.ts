import { ref, watch } from "vue";

import { errorMessage } from "@/lib/auth";

export function useDialogAction() {
  const open = ref(false);
  const pending = ref(false);
  const error = ref<string | null>(null);

  watch(open, (isOpen) => {
    if (isOpen) error.value = null;
  });

  async function run(action: () => Promise<unknown>) {
    pending.value = true;
    error.value = null;
    try {
      await action();
      open.value = false;
    } catch (caught) {
      error.value = errorMessage(caught);
    } finally {
      pending.value = false;
    }
  }

  return { open, pending, error, run };
}
