import type { Ref } from "vue";

// What a node that fetches something (a plot, rows) shows while it does: nothing yet, a request in
// flight, a reason it cannot ask yet, or a refusal.
export type RequestStatus = "idle" | "loading" | "waiting" | "error";

// Keeps what a node shows in line with what it should show *now*, however the inputs change while
// a request is on its way. `key` is a string that changes whenever the result would; `load(signal)`
// asks for it and shows it, and returns a reason to wait (nothing to ask for yet) or nothing; it
// throws if the backend refuses.
//
// Only one request runs at a time. A change cancels what is in flight (its result would be out of
// date) and schedules a refresh after a short pause (typing in a field changes the key on every
// keystroke). The refresh shows the outcome for the key it finds, and when that is the key already
// on screen (a change and then back) it puts that outcome back: the node can never be left on
// "loading" with nothing coming.
export function useLatestRequest(
  key: Ref<string>,
  load: (signal: AbortSignal) => Promise<{ waiting: string } | void>,
  delay = 250,
) {
  const status = ref<RequestStatus>("idle");
  const message = ref("");

  let applied: string | undefined; // the key whose outcome is on screen
  let settled = { status: "idle" as RequestStatus, message: "" }; // and that outcome
  let running = false;
  let again = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let gone = false;

  async function refresh() {
    if (running) {
      again = true; // the running loop takes it up when its request is done
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
          if (signal.aborted || key.value !== current) continue; // out of date: a refresh follows
          message.value = outcome?.waiting ?? "";
          status.value = outcome ? "waiting" : "idle";
        } catch (error) {
          if (signal.aborted || key.value !== current) continue;
          // the backend says why obskit refused the values (e.g. "p must be in [0, 1]")
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

  // changes are shown after a pause; `now` (connecting something) shows them at once
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
