<script setup lang="ts">
const props = defineProps<{ table: DataRows }>();

const caption = computed(() => {
  const t = props.table;
  const rows = `${t.rowCount} ${t.rowCount === 1 ? "row" : "rows"}`;
  return t.rowCount > t.rows.length ? `${rows}, the first ${t.rows.length} shown` : rows;
});
</script>

<template>
  <!-- a table taller than this scrolls (the header stays), one wider than its space scrolls sideways -->
  <div class="max-h-64 overflow-auto rounded-md bg-default ring ring-inset ring-default">
    <table class="w-full border-collapse text-left">
      <thead class="sticky top-0 bg-accented text-highlighted">
        <tr>
          <th v-for="column in table.columns" :key="column" class="px-3 py-1 font-normal">
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in table.rows" :key="r" class="border-t border-default">
          <td v-for="(value, c) in row" :key="c" class="px-3 py-1">{{ formatCell(value) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p class="text-muted">{{ caption }}</p>
</template>
