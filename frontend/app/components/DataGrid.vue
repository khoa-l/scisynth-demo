<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";

// The rows of a table as a grid: the header stays and only the rows in view are drawn. It is as tall
// as `height` (a CSS length) at most, and scrolls beyond that, sideways too.
const props = withDefaults(defineProps<{ table: DataRows; height?: string }>(), {
  height: "16rem",
});

// a row is a list: a column is read by its place (not its name, which may hold a dot)
const columns = computed<TableColumn<(number | null)[]>[]>(() =>
  props.table.columns.map((name, i) => ({
    id: name,
    header: name,
    accessorFn: (row) => row[i],
    cell: ({ getValue }) => formatCell(getValue() as number | null),
  })),
);

const caption = computed(() => {
  const { rowCount, rows } = props.table;
  const count = `${rowCount} ${rowCount === 1 ? "row" : "rows"}`;
  return rowCount > rows.length ? `${count}, the first ${rows.length} shown` : count;
});
</script>

<template>
  <UTable
    :data="table.rows"
    :columns="columns"
    sticky
    :virtualize="{ estimateSize: DATA_PREVIEW.rowHeight, overscan: 4 }"
    :style="{ maxHeight: height }"
    :ui="{ th: 'px-2 py-1 font-normal', td: 'px-2 py-1' }"
    class="rounded-md bg-default ring ring-inset ring-default"
  />
  <p class="text-muted">{{ caption }}</p>
</template>
