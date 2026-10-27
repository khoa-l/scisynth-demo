<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";

const props = defineProps<{ id: string; type: string; params?: Record<string, ParamValue> }>();

const { updateNodeData, edges, findNode } = useVueFlow(FLOW_ID);

const kind = computed(() => kindOf(props.type));
const values = computed(() => paramsOf(kind.value, props.params));

// The node on a port
function sourceAt(portId: string) {
  const edge = edges.value.find((e) => e.target === props.id && e.targetHandle === portId);
  return edge ? findNode(edge.source) : undefined;
}

// A connected Domain's axes (null when none)
function axesAt(portId: string): AxisData[] | null {
  const source = sourceAt(portId);
  return source ? ((source.data?.axes ?? []) as AxisData[]) : null;
}

// What a port shows: a Domain's axis names, else the connected node's name; a port that takes
// several shows how many
function connectedTo(portId: string) {
  const count = edges.value.filter(
    (e) => e.target === props.id && e.targetHandle === portId,
  ).length;
  if (count > 1) return `${count} fields`;
  const source = sourceAt(portId);
  if (!source) return "";
  const names = axesAt(portId)
    ?.map((a) => a.name)
    .join(", ");
  return names || kindOf(source.data?.type).label;
}

// One row per field. A per-axis parameter follows the connected Domain: one row for none or one
// axis, else a collapsed summary ("64×16") that expands into a row per axis.
interface Row {
  spec: ParamSpec;
  key: string;
  label: string;
  aria: string;
  axis?: { index: number; count: number };
  summary?: boolean; // header of a per-axis parameter
  nested?: boolean; // a per-axis row of an open group
}

// Open per-axis parameters (not saved)
const expanded = ref(new Set<string>());

function toggle(spec: ParamSpec) {
  const open = new Set(expanded.value);
  if (!open.delete(spec.name)) open.add(spec.name);
  expanded.value = open;
}

const rows = computed<Row[]>(() =>
  (kind.value.params ?? [])
    .filter((spec) => !spec.when || values.value[spec.when.param] === spec.when.value)
    .flatMap((spec): Row[] => {
      const axes = spec.perAxisOf ? axesAt(spec.perAxisOf) : null;
      if (!axes?.length) return [{ spec, key: spec.name, label: spec.name, aria: spec.name }];
      const perAxis = axes.map((axis, index): Row => {
        const aria = `${spec.name} ${axis.name}`;
        return {
          spec,
          key: `${spec.name}:${index}`,
          // one axis keeps the parameter name; more are named by axis
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

// Consecutive nested rows share a band
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

// Rows a band shows before scrolling, plus half of the next as a hint (a row is 24px + 4px gap;
// the band adds 1px border and 4px padding on top, and 12px for the half row)
const MAX_SECTION_ROWS = 4;
const sectionStyle = {
  maxHeight: `${MAX_SECTION_ROWS * 28 + 17}px`,
  backgroundColor: "var(--node-sunk)",
  borderColor: catTint(45),
};

// The collapsed field's text, e.g. "64×16"
const summaryOf = (row: Row) =>
  Array.from({ length: row.axis?.count ?? 0 }, (_, i) => valueAt(row.spec, i)).join("×");

// Whether any axis's value is out of range
const anyInvalid = (row: Row) =>
  Array.from({ length: row.axis?.count ?? 0 }, (_, i) => outOfRange(row.spec, i)).some(Boolean);

// A row's value: a list is read by axis, a single number applies to every axis
function valueAt(spec: ParamSpec, index?: number): ParamValue {
  const value = values.value[spec.name];
  if (Array.isArray(value)) return value[index ?? 0] ?? spec.default;
  return value ?? spec.default;
}

// Greyed-out display field, the size of a small input
const DISPLAY_FIELD =
  "flex h-6 min-w-0 items-center gap-1 rounded-md bg-elevated px-2 text-xs text-muted ring ring-inset ring-default";

// The dropdown's "unset" entry (a select item cannot be empty), only for a choice that may be unset
const NONE = "__none__";

const items = (spec: ParamSpec) => [
  ...(spec.default === null ? [{ label: spec.placeholder ?? "none", value: NONE }] : []),
  ...(spec.options ?? []),
];

function save(row: Row, value: ParamValue) {
  const { spec, axis } = row;
  const saved = axis
    ? Array.from({ length: axis.count }, (_, i) => (i === axis.index ? value : valueAt(spec, i)))
    : value;
  updateNodeData(props.id, { params: { ...values.value, [spec.name]: saved } });
}

// An empty input emits null: unsets an optional value, otherwise the last valid number stays
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

// obskit rejects values outside the range
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
  <div class="nodrag nowheel mt-2 text-left">
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
      <!-- a read-only field of what is connected; its handle sits on the node's edge (11px: padding and border) -->
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
        <!-- an <output>, so it takes no focus and cannot be selected -->
        <output
          :class="[DISPLAY_FIELD, 'cursor-default select-none']"
          :aria-label="`${kind.label} ${port.label}`"
        >
          <span v-if="connectedTo(port.id)" class="truncate">{{ connectedTo(port.id) }}</span>
          <span v-else class="truncate text-dimmed">not connected</span>
        </output>
      </label>
      <!-- plain rows go straight into the grid; an open group's nested rows form one band -->
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
          <!-- w-0 + min-w-full: an axis name must not widen the label column -->
          <span
            class="text-muted"
            :class="row.nested && 'w-0 min-w-full truncate'"
            :title="row.nested ? row.label : undefined"
            >{{ row.label }}</span
          >
          <!-- toggles the rows below; styled like the greyed field, not an input -->
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
          <UInput
            v-else-if="row.spec.text"
            :model-value="(valueAt(row.spec) as string | null) ?? ''"
            :placeholder="row.spec.placeholder"
            size="xs"
            spellcheck="false"
            autocomplete="off"
            :aria-label="`${kind.label} ${row.aria}`"
            class="min-w-0 font-mono"
            @update:model-value="save(row, String($event))"
          />
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
