// plotly.js is large: load it in the background once idle when a study page opens, so the first
// plot need not wait.
export function preloadPlotly() {
  const load = () => void import("plotly.js-dist-min");
  if (typeof requestIdleCallback === "function") requestIdleCallback(load);
  else setTimeout(load, 1000);
}

// Plotly's default template draws a pale plot area with white grid lines; each panel's axis
// pair (xaxis, yaxis2, ...) needs dark ones.
export function darkAxes(layout: Record<string, any>) {
  const grid = "rgba(255,255,255,0.12)";
  const axes = Object.fromEntries(
    Object.keys(layout)
      .filter((key) => /^[xy]axis\d*$/.test(key))
      .map((key) => [key, { ...layout[key], gridcolor: grid, zerolinecolor: grid }]),
  );
  return { plot_bgcolor: "rgba(255,255,255,0.05)", ...axes };
}

// The backend's figures are still pictures; this makes one explorable.
export function interactiveLayout(layout: Record<string, any>) {
  const axes = Object.fromEntries(
    Object.keys(layout)
      .filter((key) => /^[xy]axis\d*$/.test(key))
      .map((key) => [key, { ...layout[key], fixedrange: false }]),
  );
  return { ...layout, ...axes, modebar: {}, dragmode: "zoom", hovermode: "closest" };
}
