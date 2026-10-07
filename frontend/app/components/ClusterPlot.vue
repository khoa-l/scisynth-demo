<script setup lang="ts">
const props = defineProps<{
  table: DataRows;
  x: string;
  y: string;
  color?: string; // the column the points are colored by, in groups of the ranges between `breaks`
  oneColor?: boolean; // every point in one color, but the points with no value in `color` still left out
  breaks: number[]; // in order
  names?: string[]; // what each range is called, by place
  showNoValue?: boolean; // plot the points with no value to color by
}>();

// the group of the points with no value to color by: after every range
const NO_VALUE = Infinity;

// A trace per group (so the legend names the ranges), or one trace of every point
function traces() {
  const { columns, rows } = props.table;
  const [xi, yi] = [columns.indexOf(props.x), columns.indexOf(props.y)];
  const ci = props.color ? columns.indexOf(props.color) : -1;
  const grouped = ci >= 0 && !props.oneColor;
  const groups = new Map<number, { x: number[]; y: number[] }>();
  for (const row of rows) {
    const [x, y] = [row[xi], row[yi]];
    if (x == null || y == null) continue; // an invalid sample has nothing to plot
    const value = ci < 0 ? undefined : row[ci];
    if (ci >= 0 && value == null && !props.showNoValue) continue;
    const group = grouped ? (value == null ? NO_VALUE : groupOf(value, props.breaks)) : 0;
    const points = groups.get(group) ?? { x: [], y: [] };
    points.x.push(x);
    points.y.push(y);
    groups.set(group, points);
  }
  const name = (group: number) =>
    group === NO_VALUE
      ? "no value"
      : props.names?.[group] || rangeLabel(group, props.breaks, props.color!);
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([group, points]) => ({
      ...points,
      type: "scatter",
      mode: "markers",
      name: grouped ? name(group) : "points",
      marker: {
        size: 7,
        color: !grouped ? ONE_COLOR : group === NO_VALUE ? NO_VALUE_COLOR : groupColor(group),
      },
    }));
}

const element = ref<HTMLElement>();
usePlotly(element, () => ({
  data: traces(),
  layout: {
    xaxis: { title: { text: props.x } },
    yaxis: { title: { text: props.y } },
    showlegend: !!props.color && !props.oneColor,
    height: 360,
    plot_bgcolor: "rgba(0,0,0,0)",
  },
  config: { displayModeBar: false }, // drag to zoom, double-click to reset
}));
</script>

<template>
  <div ref="element" class="w-full" />
</template>
