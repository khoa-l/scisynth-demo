// plotly.js-dist-min ships no types; only what NodePlot uses
declare module "plotly.js-dist-min" {
  interface PlotlyFigure {
    data: unknown[];
    layout: Record<string, unknown>;
  }
  const Plotly: {
    react(
      el: HTMLElement,
      data: unknown[],
      layout: Record<string, unknown>,
      config?: Record<string, unknown>,
    ): Promise<void>;
    purge(el: HTMLElement): void;
  };
  export type { PlotlyFigure };
  export default Plotly;
}
