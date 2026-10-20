// Group colors, in order
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

// the color of group `i`, repeating after the last
export const groupColor = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];

export const ONE_COLOR = GROUP_COLORS[0];
export const NO_VALUE_COLOR = "#9ca3af";

// `breaks` split a column's values into n + 1 groups; a value equal to a break starts the range above

// the group a value falls in (0 is the lowest)
export const groupOf = (value: number, breaks: number[]) => breaks.filter((b) => value >= b).length;

// how group `i` reads: "value < 2", "2 ≤ value < 5", "value ≥ 5"
export function rangeLabel(i: number, breaks: number[], column: string) {
  const lo = breaks[i - 1];
  const hi = breaks[i];
  if (lo === undefined && hi === undefined) return column;
  if (lo === undefined) return `${column} < ${formatCell(hi!)}`;
  if (hi === undefined) return `${column} ≥ ${formatCell(lo)}`;
  return `${formatCell(lo)} ≤ ${column} < ${formatCell(hi)}`;
}

// the column's values that exist
export function columnValues(table: DataRows, column: string) {
  const index = table.columns.indexOf(column);
  return table.rows
    .map((row) => row[index])
    .filter((v): v is number => v !== null && v !== undefined);
}

// breaks splitting the values into `groups` groups of about equal size
export function quantileBreaks(values: number[], groups: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks = Array.from(
    { length: groups - 1 },
    (_, k) => sorted[Math.floor(((k + 1) * sorted.length) / groups)],
  );
  return [...new Set(breaks.filter((b): b is number => b !== undefined))];
}
