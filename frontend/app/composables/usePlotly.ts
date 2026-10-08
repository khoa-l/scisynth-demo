import type { Ref } from "vue";

export interface PlotSpec {
  data: unknown[];
  layout?: Record<string, any>;
  config?: Record<string, unknown>;
}

// Draws what `spec` describes (nothing while it returns nothing) into `element`, again whenever what
// it reads changes or the color mode does, and clears it when the component goes. The plot is
// themed: a transparent background, readable text, and dark grid lines in dark mode. plotly.js is
// large, so it is only loaded once there is something to draw.
export function usePlotly(element: Ref<HTMLElement | undefined>, spec: () => PlotSpec | undefined) {
  const colorMode = useColorMode();
  const dark = computed(() => colorMode.value === "dark");
  let drawnWith: string | undefined; // the config the plot was drawn with

  async function draw() {
    const el = element.value;
    const wanted = spec();
    if (!el || !wanted) return;
    const { default: Plotly } = await import("plotly.js-dist-min");
    const config = JSON.stringify(wanted.config ?? {});
    if (config !== drawnWith) {
      Plotly.purge(el); // a plot keeps the config (still or interactive) it was drawn with
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
  watch([spec, dark, element], draw, { flush: "post" }); // a new element needs drawing into too
  onBeforeUnmount(async () => {
    const el = element.value; // gone from the ref by the time plotly.js has loaded
    if (el) (await import("plotly.js-dist-min")).default.purge(el);
  });
}
