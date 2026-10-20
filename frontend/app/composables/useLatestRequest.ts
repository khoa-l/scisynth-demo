import type { Ref } from "vue";

// What a fetching node shows: nothing yet, a request in flight, a reason it cannot ask yet, or a refusal.
export type RequestStatus = "idle" | "loading" | "waiting" | "error";

// Keeps what a node shows in line with its inputs. `key` changes whenever the result would;
// `load(signal)` fetches and shows it, returns a reason to wait or nothing, and throws if the
// backend refuses.
//
// One request runs at a time. A change cancels the one in flight and refreshes after a short pause
// (typing changes the key on every keystroke). Returning to the key already on screen puts its
// outcome back, so the node is never stuck on "loading".
export function useLatestRequest(
  key: Ref<string>,
  load: (signal: AbortSignal) => Promise<{ waiting: string } | void>,
  delay = 250,
) {
  const status = ref<RequestStatus>("idle");
  const message = ref("");

  let applied: string | undefined; // the key on screen
  let settled = { status: "idle" as RequestStatus, message: "" }; // and its outcome
  let running = false;
  let again = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let gone = false;

  async function refresh() {
    if (running) {
      again = true; // the running loop takes it up
      return;
    }
    running = true;
    try {
      do {
        again = false;
        const current = key.value;
        controller?.abort();
        if (gone) continue;
        if (current === applied) {
          status.value = settled.status;
          message.value = settled.message;
          continue;
        }
        const { signal } = (controller = new AbortController());
        status.value = "loading";
        try {
          const outcome = await load(signal);
          if (signal.aborted || key.value !== current) continue; // out of date
          message.value = outcome?.waiting ?? "";
          status.value = outcome ? "waiting" : "idle";
        } catch (error) {
          if (signal.aborted || key.value !== current) continue;
          // the backend says why obskit refused
          message.value = (error as { data?: { detail?: string } }).data?.detail ?? "";
          status.value = "error";
        }
        applied = current;
        settled = { status: status.value, message: message.value };
      } while (again && !gone);
    } finally {
      running = false;
    }
  }

  // changes show after a pause; `now` shows them at once
  watch(key, () => {
    controller?.abort();
    clearTimeout(timer);
    timer = setTimeout(refresh, delay);
  });
  onBeforeUnmount(() => {
    gone = true;
    clearTimeout(timer);
    controller?.abort();
  });

  return { status, message, refresh };
}
