// Colors for the groups of a scatter plot, in order
const GROUP_COLORS = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#ec4899",
];

// the color of group `i`, which repeats after the last
export const groupColor = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];

export const ONE_COLOR = GROUP_COLORS[0];
export const NO_VALUE_COLOR = "#9ca3af";

// Number ranges split a column's values into groups: `breaks` are where one range ends and the next
// begins, so n breaks make n + 1 groups, and a value that is a break starts the range above it.

// the group (0 is the lowest range) a value falls in
export const groupOf = (value: number, breaks: number[]) => breaks.filter((b) => value >= b).length;

// how group `i` reads (the breaks in order): "value < 2", "2 ≤ value < 5", "value ≥ 5"
export function rangeLabel(i: number, breaks: number[], column: string) {
  const lo = breaks[i - 1];
  const hi = breaks[i];
  if (lo === undefined && hi === undefined) return column;
  if (lo === undefined) return `${column} < ${formatCell(hi!)}`;
  if (hi === undefined) return `${column} ≥ ${formatCell(lo)}`;
  return `${formatCell(lo)} ≤ ${column} < ${formatCell(hi)}`;
}

// the values of a column that have one
export function columnValues(table: DataRows, column: string) {
  const index = table.columns.indexOf(column);
  return table.rows
    .map((row) => row[index])
    .filter((v): v is number => v !== null && v !== undefined);
}

// breaks that split the values into `groups` groups of about the same size
export function quantileBreaks(values: number[], groups: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks = Array.from(
    { length: groups - 1 },
    (_, k) => sorted[Math.floor(((k + 1) * sorted.length) / groups)],
  );
  return [...new Set(breaks.filter((b): b is number => b !== undefined))];
}
