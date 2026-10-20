import type { Ref } from "vue";

export interface PlotSpec {
  data: unknown[];
  layout?: Record<string, any>;
  config?: Record<string, unknown>;
}

// Draws `spec` into `element` (nothing while it returns nothing), again when what it reads or the
// color mode changes, and clears it on unmount. Themed: transparent background, readable text, dark
// grid in dark mode. plotly.js loads only once there is something to draw.
export function usePlotly(element: Ref<HTMLElement | undefined>, spec: () => PlotSpec | undefined) {
  const colorMode = useColorMode();
  const dark = computed(() => colorMode.value === "dark");
  let drawnWith: string | undefined; // config of the current plot

  async function draw() {
    const el = element.value;
    const wanted = spec();
    if (!el || !wanted) return;
    const { default: Plotly } = await import("plotly.js-dist-min");
    const config = JSON.stringify(wanted.config ?? {});
    if (config !== drawnWith) {
      Plotly.purge(el); // a plot keeps the config it was drawn with
      drawnWith = config;
    }
    const layout = {
      margin: { l: 55, r: 10, t: 10, b: 45 },
      paper_bgcolor: "rgba(0,0,0,0)",
      font: { size: 11, color: dark.value ? "#e5e7eb" : "#222" },
      ...wanted.layout,
    };
    await Plotly.react(
      el,
      wanted.data,
      { ...layout, ...(dark.value ? darkAxes(layout) : {}) },
      { responsive: true, ...wanted.config },
    );
  }

  onMounted(draw);
  watch([spec, dark, element], draw, { flush: "post" }); // a new element needs drawing too
  onBeforeUnmount(async () => {
    const el = element.value; // gone from the ref once plotly.js has loaded
    if (el) (await import("plotly.js-dist-min")).default.purge(el);
  });
}
