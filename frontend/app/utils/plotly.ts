// plotly.js is large, so it is only loaded when a study page opens (not with the app), and then in
// the background once the browser is idle: the first plot does not have to wait for it. Importing
// it again later (NodePlot) reuses the loaded module.
export function preloadPlotly() {
  const load = () => void import("plotly.js-dist-min");
  if (typeof requestIdleCallback === "function") requestIdleCallback(load);
  else setTimeout(load, 1000);
}

// Plotly's default template draws a pale plot area with white grid lines. A figure with panels (a
// Preview's before and after) has an axis pair per panel (xaxis, yaxis, xaxis2, ...), and each
// needs it.
export function darkAxes(layout: Record<string, any>) {
  const grid = "rgba(255,255,255,0.12)";
  const axes = Object.fromEntries(
    Object.keys(layout)
      .filter((key) => /^[xy]axis\d*$/.test(key))
      .map((key) => [key, { ...layout[key], gridcolor: grid, zerolinecolor: grid }]),
  );
  return { plot_bgcolor: "rgba(255,255,255,0.05)", ...axes };
}

// The backend's figures are drawn for a still picture: no zoom, pan or hover, and a mode bar with its
// tools removed. This gives a figure back what it needs to be explored.
export function interactiveLayout(layout: Record<string, any>) {
  const axes = Object.fromEntries(
    Object.keys(layout)
      .filter((key) => /^[xy]axis\d*$/.test(key))
      .map((key) => [key, { ...layout[key], fixedrange: false }]),
  );
  return { ...layout, ...axes, modebar: {}, dragmode: "zoom", hovermode: "closest" };
}
