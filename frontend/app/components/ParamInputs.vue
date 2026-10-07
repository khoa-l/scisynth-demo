<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";

const props = defineProps<{ id: string; type: string; params?: Record<string, ParamValue> }>();

const { updateNodeData, edges, findNode } = useVueFlow(FLOW_ID);

const kind = computed(() => kindOf(props.type));
const values = computed(() => paramsOf(kind.value, props.params));

// The node connected to a port
function sourceAt(portId: string) {
  const edge = edges.value.find((e) => e.target === props.id && e.targetHandle === portId);
  return edge ? findNode(edge.source) : undefined;
}

// A connected Domain as its axes (null when nothing is connected)
function axesAt(portId: string): AxisData[] | null {
  const source = sourceAt(portId);
  return source ? ((source.data?.axes ?? []) as AxisData[]) : null;
}

// What a port shows in its read-only field: a Domain's axis names, otherwise the connected node's
// name (a sampler, a field), or nothing
function connectedTo(portId: string) {
  const source = sourceAt(portId);
  if (!source) return "";
  const names = axesAt(portId)
    ?.map((a) => a.name)
    .join(", ");
  return names || kindOf(source.data?.type).label;
}

// One row per field. A per-axis parameter (GaussianField's resolution) follows the connected
// Domain: a single row while nothing is connected, one row for a one-axis Domain, and for more
// axes a collapsed summary ("64×16") that expands into a row per axis (`expanded`).
interface Row {
  spec: ParamSpec;
  key: string;
  label: string; // what is shown
  aria: string; // what assistive technology reads
  axis?: { index: number; count: number };
  summary?: boolean; // the collapsed / expanded header of a per-axis parameter
  nested?: boolean; // one of the per-axis rows of an open group (drawn together in a band)
}

// Per-axis parameters whose rows are open (not saved: they start collapsed)
const expanded = ref(new Set<string>());

function toggle(spec: ParamSpec) {
  const open = new Set(expanded.value);
  if (!open.delete(spec.name)) open.add(spec.name);
  expanded.value = open;
}

const rows = computed<Row[]>(() =>
  (kind.value.params ?? []).flatMap((spec): Row[] => {
    const axes = spec.perAxisOf ? axesAt(spec.perAxisOf) : null;
    if (!axes?.length) return [{ spec, key: spec.name, label: spec.name, aria: spec.name }];
    const perAxis = axes.map((axis, index): Row => {
      const aria = `${spec.name} ${axis.name}`;
      return {
        spec,
        key: `${spec.name}:${index}`,
        // a one-axis Domain keeps the plain parameter name; with more, each row is named by its axis
        label: axes.length > 1 ? axis.name : spec.name,
        aria: axes.length > 1 ? aria : spec.name,
        axis: { index, count: axes.length },
        nested: axes.length > 1,
      };
    });
    if (axes.length === 1) return perAxis;
    const header: Row = {
      spec,
      key: spec.name,
      label: spec.name,
      aria: spec.name,
      axis: { index: 0, count: axes.length },
      summary: true,
    };
    return expanded.value.has(spec.name) ? [header, ...perAxis] : [header];
  }),
);

// Consecutive nested rows are drawn together in one band; everything else is laid out directly
// in the grid
interface Section {
  key: string;
  band: boolean;
  rows: Row[];
}

const sections = computed(() => {
  const out: Section[] = [];
  for (const row of rows.value) {
    const band = !!row.nested;
    const last = out.at(-1);
    if (last && last.band === band) last.rows.push(row);
    else out.push({ key: row.key, band, rows: [row] });
  }
  return out;
});

// A nested band shows this many rows before it scrolls, plus half of the next one as a hint that
// there is more. A row is 24px with a 4px gap; the band adds a 1px border and 4px of padding on
// top (1 + 4 + 12 for the half row).
const MAX_SECTION_ROWS = 4;
const sectionStyle = {
  maxHeight: `${MAX_SECTION_ROWS * 28 + 17}px`,
  // neutral and a shade darker than the card (a faint overlay, no color cast)
  backgroundColor: "var(--node-sunk)",
  borderColor: catTint(45),
};

// The collapsed field's text: every axis's value, e.g. "64×16"
const summaryOf = (row: Row) =>
  Array.from({ length: row.axis?.count ?? 0 }, (_, i) => valueAt(row.spec, i)).join("×");

// Whether any of a per-axis parameter's values is out of range
const anyInvalid = (row: Row) =>
  Array.from({ length: row.axis?.count ?? 0 }, (_, i) => outOfRange(row.spec, i)).some(Boolean);

// A row's value. A saved list is read by axis; a single number applies to every axis (as in
// obskit), and a list shown without a Domain falls back to its first entry.
function valueAt(spec: ParamSpec, index?: number): ParamValue {
  const value = values.value[spec.name];
  if (Array.isArray(value)) return value[index ?? 0] ?? spec.default;
  return value ?? spec.default;
}

// How the non-input displays look: the size of a small input (24px), greyed out
const DISPLAY_FIELD =
  "flex h-6 min-w-0 items-center gap-1 rounded-md bg-elevated px-2 text-xs text-muted ring ring-inset ring-default";

// The dropdown's entry for "unset" (an empty value is not allowed for a select item)
const NONE = "__none__";

const items = (spec: ParamSpec) => [
  { label: spec.placeholder ?? "none", value: NONE },
  ...(spec.options ?? []),
];

function save(row: Row, value: ParamValue) {
  const { spec, axis } = row;
  const saved = axis
    ? Array.from({ length: axis.count }, (_, i) => (i === axis.index ? value : valueAt(spec, i)))
    : value;
  updateNodeData(props.id, { params: { ...values.value, [spec.name]: saved } });
}

// Number inputs emit null while empty: that unsets an optional value, and for the others the
// last valid number is kept. Whole-number inputs (a seed, levels) ignore decimals.
function setNumber(row: Row, value: number | null | undefined) {
  if (value === null || value === undefined) {
    if (row.spec.default === null) save(row, null);
    return;
  }
  const valid = row.spec.integer ? Number.isInteger(value) : Number.isFinite(value);
  if (typeof value === "number" && valid) save(row, value);
}

function setChoice(row: Row, value: string) {
  save(row, value === NONE ? null : value);
}

// obskit rejects values outside the range, so flag them (the preview shows its error too)
function outOfRange(spec: ParamSpec, index?: number) {
  const value = valueAt(spec, index);
  if (typeof value !== "number") return false;
  const tooLow =
    spec.min !== undefined && (spec.minExclusive ? value <= spec.min : value < spec.min);
  return tooLow || (spec.max !== undefined && value > spec.max);
}

const invalid = (row: Row) => outOfRange(row.spec, row.axis?.index);
</script>

<template>
  <!-- nodrag/nowheel: let the inputs be used without dragging or zooming the canvas -->
  <div class="nodrag nowheel mt-2 text-left">
    <!-- one grid, so the labels share a column as wide as the longest and every field lines up -->
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
      <!-- inputs that belong to a field: a read-only field showing what is connected, with the
           handle on the node's edge (11px = the card's padding and border), level with the row -->
      <label v-for="port in kind.ports" :key="port.id" class="contents">
        <span class="relative text-muted">
          <Handle
            :id="port.id"
            type="target"
            :position="Position.Left"
            :style="{ left: '-11px' }"
          />
          {{ port.label }}
        </span>
        <!-- an <output>, not an input: it only looks like a field, so it takes no focus, shows no
             text cursor and cannot be selected -->
        <output
          :class="[DISPLAY_FIELD, 'cursor-default select-none']"
          :aria-label="`${kind.label} ${port.label}`"
        >
          <span v-if="connectedTo(port.id)" class="truncate">{{ connectedTo(port.id) }}</span>
          <span v-else class="truncate text-dimmed">not connected</span>
        </output>
      </label>
      <!-- A section is either plain (its rows go straight into the grid) or an open group's nested
           rows, which form a section of their own: one band, out to the node's border, with a
           line above and below (its top and bottom borders) and a neutral fill. It is spaced from
           the items above and below like any other item, and its rows stay in the same two
           columns as everything else. The band is as tall as its rows up to MAX_SECTION_ROWS
           and scrolls beyond that, with a slim scrollbar in the node's side padding (see .node-scroll in
           main.css; it takes no width from the fields). The side padding, cancelled by the negative
           margin, keeps the focus rings from clipping. -->
      <div
        v-for="section in sections"
        :key="section.key"
        :class="
          section.band
            ? 'node-scroll col-span-2 -mx-2.5 grid grid-cols-subgrid items-center gap-y-1 overflow-y-auto border-y py-1 pl-2.5'
            : 'contents'
        "
        :style="section.band ? sectionStyle : undefined"
      >
        <label v-for="row in section.rows" :key="row.key" class="contents">
          <!-- an axis name must not resize the fields: w-0 + min-w-full keeps a nested label out of
               the label column's width (the fixed labels set it) and fills it, truncated -->
          <span
            class="text-muted"
            :class="row.nested && 'w-0 min-w-full truncate'"
            :title="row.nested ? row.label : undefined"
            >{{ row.label }}</span
          >
          <!-- the collapsed / expanded header of a per-axis parameter: a button (it opens and closes
             the rows below it) dressed like the greyed field, so it is not mistaken for an input -->
          <button
            v-if="row.summary"
            type="button"
            :class="[
              DISPLAY_FIELD,
              'w-full cursor-pointer text-left hover:bg-accented focus-visible:outline-2 focus-visible:outline-primary',
              anyInvalid(row) && 'ring-error!',
            ]"
            :aria-label="`${kind.label} ${row.aria}`"
            :aria-expanded="expanded.has(row.spec.name)"
            @click="toggle(row.spec)"
          >
            <span class="truncate">{{ summaryOf(row) }}</span>
            <UIcon
              :name="expanded.has(row.spec.name) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="ml-auto size-4 shrink-0"
              :style="{ color: 'var(--cat-fg)' }"
            />
          </button>
          <USelect
            v-else-if="row.spec.options"
            :model-value="(valueAt(row.spec) as string | null) ?? NONE"
            :items="items(row.spec)"
            size="xs"
            :aria-label="`${kind.label} ${row.aria}`"
            class="min-w-0"
            @update:model-value="setChoice(row, $event as string)"
          />
          <!-- arrows left and right; min/max clamp what is typed, but the step does not snap it,
             and whole-number parameters cannot take a decimal point -->
          <UInputNumber
            v-else
            :model-value="(valueAt(row.spec, row.axis?.index) as number | null) ?? undefined"
            :min="row.spec.min"
            :max="row.spec.max"
            :step="row.spec.step"
            :step-snapping="false"
            :format-options="{ maximumFractionDigits: row.spec.integer ? 0 : 10 }"
            :placeholder="row.spec.placeholder"
            size="xs"
            :aria-label="`${kind.label} ${row.aria}`"
            :color="invalid(row) ? 'error' : undefined"
            :highlight="invalid(row)"
            class="min-w-0"
            @update:model-value="setNumber(row, $event)"
          />
        </label>
      </div>
    </div>
  </div>
</template>
