# Decisions

Choices made where the brief was silent or ambiguous. Simplest option taken.

New decisions go under the matching topic; every change also gets a line in the change log at
the end (newest first). Decisions made before this file existed were written up from the code
and the conversation, so they carry no dates.

## Stack and tooling

- **Frontend:** Nuxt (with Nuxt UI) scaffolded through Vite+ (`vp create nuxt`, pnpm). It
  replaced a first Vue + PrimeVue build. Nuxt runs its own dev server, so start it with
  `vp run dev` / `pnpm dev`; `vp dev` starts a bare Vite server with no pages (404).
  `vite.config.ts` stays for `vp check` / `vp fmt` only (Nuxt warns it ignores that file).
- **`ssr: false`:** the app is a browser app, as the first build was; no server rendering.
- **Canvas and drag and drop:** VueFlow for the node canvas, `@dnd-kit/vue` (plus
  `@dnd-kit/dom`, needed for the clone feedback and drag overlay) for dragging items from the
  sidebar.
- **Backend:** FastAPI, with SQLite through the standard library `sqlite3` (no ORM).
- **obskit** is a path dependency on `../../obskit`, editable (`uv add --editable`), so the
  backend sees obskit changes without a reinstall.
- **plotly.js (`plotly.js-dist-min`)** draws the preview plots in the browser. It is large, so it
  is imported only when a Preview needs it.
- **Checks:** `vp fmt`, `vp check` (lint and type-check), `nuxt typecheck`, and a build. UI
  behavior was verified in a real headless browser against the backend code.

## Environment (macOS)

- **Dot-folders get a "hidden" file flag** inside `~/Desktop` (it syncs to iCloud Drive; the flag
  appears within seconds on any dot-named folder and its contents, `.venv` included). Python skips
  a `.pth` file that has the flag, so the editable `obskit` install silently stopped importing.
  Clearing the flag by hand never lasts.
- **Fix:** the real virtual environment is `backend/venv` (not hidden) and `backend/.venv` is a
  symlink to it, so `uv run` works unchanged. Both are in `.gitignore`. Moving the project out of
  `~/Desktop` would make the workaround unnecessary.

## Sign-in

- Two roles, user and admin, chosen with a toggle; no password. The role is kept in
  `localStorage` and is only checked in the browser (route middleware), not by the backend.
- `/app` is the user view (empty), `/admin` the study list, `/admin/studies/:id` a study.

## Studies and persistence

- Studies, nodes and connections live in SQLite (`backend/scisynth.db`, ignored by git;
  `SCISYNTH_DB` overrides the path). Nothing about studies is kept in `localStorage`.
- New studies are named `Study <id>`. Renaming saves when the field loses focus or on Enter.
- **One graph endpoint:** `PUT /api/studies/{id}/graph` replaces a study's nodes and connections
  (delete then insert in one transaction); `GET /api/studies/{id}` returns the study with both.
  The frontend sends it about 300 ms after any change and once more when leaving the page.
- A node is `{id, type, label, x, y, data}`. `data` is JSON and holds everything the type needs
  (a Domain's `axes`, a node's `params`). Node ids are generated in the browser, without
  `crypto.randomUUID()`, which needs a secure context.
- **Schema changes migrate on startup** (`ALTER TABLE ... ADD COLUMN` when a column is missing):
  `nodes.type`, `nodes.data`, `edges.source_handle`, `edges.target_handle`. The old node type
  `gaussianRandomField` is rewritten to `gaussianField` (obskit renamed the class).
- Deleting a study deletes its nodes and connections (foreign keys with cascade).

## Nodes

- **One registry:** `frontend/app/utils/node.ts` (`NODE_KINDS`) holds each kind's label, icon,
  category, width, parameters and connection rules. The palette, the node list, the drag card and
  the drop handling all read it. A new kind is one entry.
- Labels are obskit's class names. Only **implemented** obskit classes get a node: the ten
  defects, `Observer`, `Domain`, `GridSampler`, `PointSampler`, `GaussianField`, `AnalyticField`.
  Stubs (`BlockGaps`, `RegionMask`, `UniformNoise`, `MultiplicativeNoise`) are left out.
- **Categories and colors:** core (blue), fields (green), defects (orange). The samplers and the
  Preview are core. Each category sets a light background and a darker icon color; the node's
  outline and handles use the icon color. Fills stay light in dark mode, so their text is
  always dark.
- Every node is one custom VueFlow node type (`kind`); the kind is in `data.type`.
- **Nodes with a body** (Domain, nodes with parameters or ports, a connected Preview) have a
  colored header over a white body. Nodes without one are fully colored.
- Plain nodes are 180 x 40. A kind can set its own `width`. A node dropped on the canvas is
  centered on the pointer.
- Nodes saved under a type the registry no longer knows still render (plain box, core colors).

## Domain

- Each axis is one row: `name`, `unit`, extent `min` and `max`, and a delete button. It mirrors
  obskit's `Axis(name, extent, unit)`.
- New axes take the first unused name of obskit's defaults (`x`, `y`, `z`, then `x3`, `x4`, ...)
  and the extent 0 to 1.
- A bad axis is highlighted but never blocked: an empty or duplicate name, or min not below max
  (the checks obskit makes).
- `Domain`'s `value_unit` and `value_kind` are not offered yet.

## Parameters

- **Names and defaults are obskit's** (`sigma`, `length_scale`, ...), so a node and its class
  always agree. They are declared per kind (`params`, a list of `ParamSpec`) and saved in
  `data.params`. Saved values for names a kind does not declare are ignored.
- Only plain numbers (and one choice, Drift's `axis`) are offered. obskit also accepts
  distributions and functions for most parameters; these inputs do not cover that.
- **Optional parameters** (obskit default `None`: `Quantize.vmin/vmax`, `Clip.lo/hi`,
  `Drift.axis`) start empty. Clearing one unsets it (`null`), and unset values are left out of
  the request, so obskit uses its own default.
- **Ranges clamp.** Typing above a maximum snaps to it, and a minus sign cannot be typed where the
  minimum is 0. A minimum that is exclusive (`PoissonNoise.scale`, `Saturate.ceiling`,
  `GaussianField.length_scale`) allows 0 so obskit's own error appears.
- Whole-number parameters (`levels`, `resolution`, `seed`) cannot take a decimal point.
- Number inputs have the arrows on the left and right (`UInputNumber`). Typed values are **not**
  snapped to the step; they apply on Enter or when the field loses focus, arrows apply at once.
- `Drift.axis` offers `x`, `y` and "sample order" (unset), because the preview signal is a 2-D
  grid with those axes. It should come from the connected Domain once that is wired.
- `CoordinateShift.shift` is one number applied to every axis. obskit also allows one per axis,
  but that depends on the Domain's dimension.
- **Per-axis parameters** (`GaussianField.resolution`, `perAxisOf` in the registry) follow the
  connected Domain. With no Domain there is one field, saved as one number, which obskit repeats
  for every axis. With a one-axis Domain there is one field, still labelled just `resolution` (saved as a list of one). With two
  or more axes the parameter **collapses to a summary button** (`64×16`, values joined
  with `×`, a chevron on the right, styled as a greyed field) that opens into one row per axis (labelled with the axis name,
  indented); clicking it or pressing Enter or Space toggles. The values are saved as a list in axis
  order. This keeps the node as short as with two axes, however many there are. Open or closed is
  not saved: every node starts collapsed.
- **Marking a collapsible group:** the summary button's chevron is in the node's color (down when
  closed, up when open), and an open group's nested rows form **a section of their own**: a thin
  line above and another below (the node's color at 45% opacity, 1 px), each running out to the
  node's border, across the card's padding. The space on both sides of each line is the grid's
  4 px row gap, the same as between any two items (4 px to the parent field or the next item,
  4 px to the nested rows). The band between the lines is filled neutral grey, a shade darker than
  the white card (a 4% black overlay, which renders as `#f5f5f5` on white, with no color cast), out
  to the same edges as the lines. Nested rows are not indented, so labels and fields stay in the same two
  columns as everything else. Replaced earlier tries, in order: a chevron beside the label plus a
  guide line (two chevrons, and nested rows pushed out of line); a single closing line under the
  group; a box around the nested rows (first too close to the parent, then no longer wanted).
- **Long axis names never resize anything.** Axis names appear in the nested rows' labels and in
  the `domain` display. Nested labels use `w-0 min-w-full` plus `truncate`, which keeps them out
  of the label column's width (only the fixed parameter labels set it) and cuts them with an
  ellipsis (the full name is the tooltip); the `domain` display and the summary truncate too. The
  label column, every field and the node stay the same size whatever the names are. Truncated
  names that share a long prefix look alike on the node; hover for the full name.
- **Scrolling:** an open group's section shows up to 4 rows (129 px) and scrolls beyond that; the
  Domain's axis list shows up to 4 rows (142 px) and scrolls beyond that, with "Add axis" fixed
  above it. In both, half of the next row peeks out as a cue that there is more. The mouse wheel
  (and trackpad, touch, keyboard focus) scrolls them; the node has `nowheel`, so the canvas does not
  zoom.
- **The scrollbar is visible, slim and fixed in width** (`.node-scroll` in `main.css`): 6 px, a
  rounded thumb in the node's color, always drawn rather than the OS overlay that only shows while
  scrolling. It sits in the 10 px of side padding the area borrows from the node (negative margin),
  so the node did not need to be widened. The area's right padding is 10 px minus the scrollbar,
  and `scrollbar-gutter: stable` reserves the width even when nothing overflows, so the fields end
  exactly where every other field ends, scrolling or not (verified with classic scrollbars forced
  on). Firefox has no `::-webkit-scrollbar`, so it gets `scrollbar-width: thin` with a 8 px
  allowance there; not tested. History: the scrollbar was first left to the browser (a classic
  11 px one shrank the nested fields and broke the alignment), then hidden (which left nothing to
  show the area scrolls), then made this fixed 6 px one.
- The section is one scroll container whose top and bottom borders are the two lines and whose
  background is the fill, out to the node's border by a negative margin cancelled by padding (the
  padding also keeps focus rings from clipping). It replaced separate line and fill elements,
  which would have scrolled away or been clipped.
- `GaussianField.order` (obskit added it after the node was first written) is the interpolation
  spline order between grid points: a whole number from 0 to 5, default 1. obskit's docs name 0
  (nearest), 1 (linear) and 3 (cubic), and `InterpolatedField` accepts 0 to 5, so the input does
  too. It is a plain number input, not a dropdown of names; names could be added if the bare
  numbers prove unclear. Nodes saved before it existed show the default.
- Adding, deleting or renaming Domain axes changes the rows right away; a new axis starts at the
  default and the others keep their values. Nothing is rewritten until a field is edited:
  connecting a Domain to a single number shows that number for every axis, and the first edit
  saves the full list. Without a Domain again, the field shows the list's first entry.
- **Rules, not free wiring.** A connection is allowed only if the input accepts the source: an
  input lists the categories or node types it takes. Today only two inputs exist: the Preview's
  header input accepts defects, and GaussianField's `domain` port accepts a Domain. Everything
  else cannot be connected until its rules are decided.
- An input holds one connection; connecting another replaces it.
- **Handles are in the header by default**, centered on the header row (20 px), inputs on the
  left and outputs on the right. A kind can drop its input (`input: false`, e.g. Domain) or its
  output (`output: false`, Preview).
- **Ports:** an input that belongs to a field of the node (GaussianField's `domain`) has its handle
  on the node's left edge, level with that field's row, instead of in the header. The field sits
  in the same grid as the parameters (same column, height and edges) and shows the connected
  Domain's axis names, or "not connected" in a lighter tone.
- **Displays are not inputs.** A read-only `<input>` still takes focus, shows a text cursor and
  selects text while doing nothing, which felt awkward. So the `domain` field is an `<output>`
  element and the per-axis summary is a `<button>`, both dressed as a greyed small field
  (`DISPLAY_FIELD` in `ParamInputs.vue`): no focus, cursor or selection on the first; pointer
  cursor, hover and keyboard focus on the second, because it opens and closes the rows.
- Handles are 10 px (VueFlow's 6 px was hard to hit).
- Connections are saved with the input they end on (`sourceHandle` / `targetHandle`; `null` means
  the header's), so a node with a port and a header input stays unambiguous.
- Deleting a node removes its connections (VueFlow does this; the next save drops them).

## Preview

- A Preview takes one defect. The backend draws it with obskit's `Stage.preview` on the stage's own
  demo signal (each stage picks one), so no sampler or latent is needed. The figure is returned as
  JSON (`GET /api/preview/{type}`), rendered static (`interactive=False`, no mode bar).
- **Parameters** of the connected defect go in the query string; the Preview's **seed** goes with
  them (a whole number from 0, default 0, so previews are repeatable). The seed belongs to the
  Preview, not the defect: in obskit it belongs to a run, not to a stage.
- A parameter a defect does not declare, or a non-finite number, is a 422. obskit's own error
  (`ValueError`) is passed through as a 422 and shown in the node.
- Figures are cached by (defect, parameters, seed), up to 256.
- **Size:** obskit leaves the figure size unset, so the frontend sets it: 760 x 380 (2:1) with 3 px
  dots (Plotly's default of 6 px made the 48 x 48 grid blur). The numbers are `PREVIEW_PLOT`.
- The node is a normal plain node until a defect is connected, and only then grows to fit the plot.
- The plot waits about 250 ms after a parameter changes, and draws at once when the connection
  changes.
- The preview does not use the study's own pipeline yet: the signal is fixed.

## Canvas and drag and drop

- The sidebar's top section lists the nodes on the canvas (delete removes one, as does selecting it
  and pressing Backspace); the bottom section is the palette.
- Dragging leaves the original in place (clone feedback) and shows a card that looks like the
  node it will become, centered on the pointer; there is no drop animation.
- Opening a study fits the view to its nodes once (10% padding, at most 150% zoom, minimum zoom
  0.1). An empty study opens at the default view, and adding nodes does not move the view.

## Look

- Theming goes through Nuxt UI (`app.config.ts` for the colors, CSS variables for the rest).
  Primary color blue; border radius `0.125rem`; font Inclusive Sans, self-hosted at weight 400.
- **Nothing is bold** unless asked: one global rule sets `font-weight: 400`. Add exceptions in
  `main.css` when bold is wanted.
- Light mode only for node fills and text (they do not adapt to dark mode).

## Change log

- **2026-10-03** A one-axis Domain keeps the plain `resolution` label; axis names truncate (label,
  `domain` display, summary) and never change the label column, the fields or the node size.
- **2026-10-03** Max height and scrolling for an open group's section (4 rows) and the Domain's axis
  list (4 rows), half of the next row showing as a hint. The scrollbar is a visible slim 6 px one in
  the node's side padding (`.node-scroll`), with its width reserved so the fields stay in line; it
  was briefly hidden, but that left no sign that the area scrolls.
- **2026-10-03** Collapsible groups: the section between the two lines is filled neutral grey
  (a 4% black overlay, `#f5f5f5` on the white card), out to the node's border like the lines.
- **2026-10-03** Collapsible groups: the box is replaced by a line above and below the nested rows,
  each running out to the node's border, with 4 px on both sides of each line (the item gap), so the
  rows read as their own section.
- **2026-10-03** Collapsible groups: the nested rows of an open group are now in a box (replacing
  the closing line). The box is spaced from the items above and below like any other item (4 px)
  and pads its rows 6 px; labels and fields stay in line with the rest.
- **2026-10-03** Collapsible groups: removed the chevron beside the label and the left guide
  line (two chevrons, and the nested rows were pushed out of line). The chevron on the field is now
  green, nested rows are in line with the others, and a line under the last nested row closes the
  group.
- **2026-10-03** Collapsible groups (`resolution`) are marked with a disclosure chevron beside the
  label and, when open, a guide line beside their rows, so a collapsed one is recognizable as a group.
- **2026-10-03** GaussianField gained the `order` parameter (spline order 0 to 5, default 1) to
  match obskit; it sits after `resolution`. Checked that all ten defect previews still work against
  the current obskit.
- **2026-10-03** The `domain` display and the `resolution` summary are no longer read-only inputs
  (they could be focused and selected but did nothing). They are now an `<output>` and a
  `<button>` dressed as greyed fields; behavior of the summary (click, Enter, Space) is unchanged.
- **2026-10-03** `resolution` collapses to a summary (`64×32`) that expands into per-axis rows, so
  a GaussianField with many axes stays short (the node was getting crowded). The summary uses `×`
  with no spaces so four axes still fit in the field.
- **2026-10-03** GaussianField: the `domain` field is now a read-only input in the parameters'
  grid (it was loose text), and `resolution` has one field per axis of the connected Domain
  (see Per-axis parameters).
- **2026-10-03** GaussianField: parameters (`length_scale`, `amplitude`, `mean`, `resolution`) and
  a `domain` port that accepts a Domain, with its handle next to the field. Connections now record
  which input they end on (`edges.source_handle`, `edges.target_handle`, migrated on startup).
  Parameter labels share one column per node. This file started.
- Before 2026-10-03 (in order): Nuxt UI and Nuxt replaced PrimeVue; SQLite persistence; node kinds
  and categories; Domain axes; connections, Preview and its plots; RandomDropout parameter and the
  Preview's seed; parameters for the other defects; number inputs with arrows left and right;
  closer zoom on open; the `venv` workaround.
