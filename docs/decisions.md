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
- **Backend:** FastAPI, with SQLite through the standard library `sqlite3` (no ORM). scikit-learn and
  umap-learn are dependencies, for the Projection node.
- **obskit** is a path dependency on `../../obskit`, editable (`uv add --editable`), so the
  backend sees obskit changes without a reinstall.
- **plotly.js (`plotly.js-dist-min`)** draws the preview plots in the browser. It is large, so it
  is imported only when a Preview needs it.
- **Checks:** `vp fmt`, `vp check` (lint and type-check), `nuxt typecheck`, and a build. UI
  behavior was verified in a real headless browser against the backend code.

## Code layout (frontend)

- `app/utils/node.ts` is the registry (every node kind and its rules); `app/utils/container.ts` is
  the pure layout of a container (`containerLayout`, `layoutFor`); `app/utils/style.ts` is the one
  category-tint helper (`catTint`).
- `FlowCanvas.vue` only loads the study, wires the pieces below and handles a drop from the
  sidebar. The behavior lives in composables that each use the same canvas store (`FLOW_ID`):
  `useConnectionRules` (which connections are allowed and what a new one replaces),
  `useContainers` (zones, the list's order and its connections, dragging in and out, layers of
  connections, deleting what is inside a container) and `useGraphSave` (autosave).
  `app/utils/sources.ts` turns a plain graph (the canvas's, via `useFlowGraph`, or a saved study's,
  via `graphOf`) into the request a Data, Plot or Preview node asks the backend for (`requestOf`),
  so the canvas and the tasks run a node the same way. Create them after
  the study is loaded, since some start working on the loaded nodes straight away.
- A container's layout is computed in one place and used by both the canvas (to place the nodes)
  and `ContainerBody.vue` (to draw the zones and size the node), so they cannot disagree.

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
  `nodes.type`, `nodes.data`, `nodes.parent`, `edges.source_handle`, `edges.target_handle`, and the
  `position` of studies and tasks.
- Deleting a study deletes its nodes, connections and tasks (foreign keys with cascade).
- **Tasks:** a study can have tasks (table `tasks`: id, study_id, name, position;
  `POST /api/studies/{id}/tasks` names the new one "Task n", `PATCH` and `DELETE /api/tasks/{id}`).
  `GET /api/studies` returns each study with its `tasks`. On the home page each task is its own card
  under its study, indented, with a rename pencil, an edit button and a delete button.
- **The tasks screen** (`/admin/studies/{id}/tasks`, from the clipboard button on a study card, or
  from a task's edit button with `?task=`): a sidebar with Back and the study's name, its tasks (a
  New task button, and the tasks as links, sortable, the current one outlined) and a Components
  section; the main area is the open task, one big list that the components are dragged into, with an
  Edit / Preview toggle. Its route sits beside the canvas (`/admin/studies/{id}`), not under it.
- **Task components** (`utils/taskComponents.ts`): Text (a text box), Table and Plot. The task's mode
  (Edit / Preview) is a tab toggle like the login's Admin / User, with icons. They are saved with
  the task (`tasks.components`, JSON: `{uid, type, data}` in order; `GET /api/tasks/{id}`, `PUT
  /api/tasks/{id}/components`; `useTaskComponents` loads a task's when it is first shown and saves
  300 ms after a change).
- **Sources:** every Data, Plot and Preview node of the study's workflow is available to a task, with
  no switch, named by kind and order ("Data 1", "Plot 2"; `useTaskSources`). A Table shows a Data
  node, a Plot component a Plot or a Preview node (`SourceBar.vue`: a picker, the sync state, and
  Refresh). Picking one copies its request (`SourceSnapshot`: node id, name and the `SourceRequest`,
  seeds included) into the component, so it keeps showing the same data when the workflow changes.
  The component only shows the copy; the state beside the picker compares the copy with the node as
  the workflow has it now: in sync, out of sync (Refresh copies it again), not ready, or gone. The
  preview and the participant never show that. A node with nothing connected (or still waiting for
  a latent or domain) is listed but not selectable.
- **Serving a copy:** `GET /api/tasks/{id}/components/{uid}/data` (a Table) and `/figure` (a Plot)
  take only the task and the component and run the request saved in it, never one from the browser,
  so what a component can show is only what was copied into it. The components flush a pending save
  first (`TaskContext.flush`), since the backend runs what it has saved.
- **Cluster** (the task component for the clustering task; the editor side is built so far): its
  source is an Observer (never a Data or Plot node). In the editor it loads the Observer's output
  (up to 5,000 rows, `GET /api/tasks/{id}/components/{uid}/points`; the `/data` rows stay at 50)
  and draws a scatter plot of it (`ClusterPlot.vue`, Plotly, dark-aware, no mode bar: drag to zoom,
  double-click to reset). Pickers choose the X and Y columns (the first two until chosen) and a
  Color by column (or None). Colored, the column's values are split into groups by number ranges:
  `breaks`, the values where one range ends and the next begins (n breaks, n + 1 groups; a value
  equal to a break starts the range above it; `utils/clusters.ts`). Choosing a column starts with
  three groups of about the same size (quantiles). The breaks are handles on a bar from the column's
  lowest value to its highest, colored by the ranges they make (`RangeBreaks.vue`, a Nuxt UI `USlider`
  with a handle per break: drag one to move it (it stays between its neighbors), arrow keys nudge it,
  double-click it or press Delete to remove it, Add break puts a new one in the middle of the widest
  range; hovering a handle shows its value. The bar's colors are a hard-edged gradient set through
  a CSS variable on the slider's track). One trace per group (legend: "value < 2", "2 ≤ value < 5",
  "value ≥ 5"); a sample with no value to color by is grey, "no value", last. A point with no x or y
  is not plotted. Every column is a number so far, so every column groups by ranges; a column of
  categories would color by its values instead (not built). The choices (`x`, `y`, `color`,
  `breaks`) are saved in the component. The component shows, top to
  bottom, the source picker, the plot, then the plot's settings (X, Y, Color by, ranges); there is no
  data grid. Each range
  is an item in a list under the slider, with a box to name it (`names`, by place; empty shows the
  range, as a placeholder and in the legend); adding or removing a range starts the names over,
  moving a break keeps them. Points with no value to color by are left out unless "Plot points with
  no value" is on (`showNoValue`). The preview shows the plot in one color (what the participant
  gets for now), with none of the settings; it leaves out the points with no value as the editor does. Not built:
  the participant's grouping and scoring; the `/points` endpoint returns every column, so the
  participant view needs its own endpoint that leaves the color column out.
- **Observer as a source:** `requestOf` builds an Observer's request (`observerRequest`): its
  sampler, its stages (the defects, in the order `chainOrder` gives from their links), the latent at
  its port (the field and its domain, the same `latentOf` a sampler uses) and the Observer's own
  seed. The backend (`ObserverRequest`, a `PlotRequest` plus `stages`; `POST /api/observer`, and the
  component's `/data`) runs `obskit.Observer(sampler, stages).run(latent, seed)` and returns the same
  rows as a Data node: the coordinates and `value` (empty where a stage dropped the sample). An
  Observer with no sampler or no latent is "not ready". Its `Observation.truth` (the noise-free
  sample) is not sent; it is the likely truth for scoring later.
- Table: the first rows of the Data node (the same 50 as the node), in a table at most 16rem tall,
  so a longer table scrolls with its header kept. (The typed-in table, with its rows and columns to
  add, delete and sort, is gone.)
- Plot: the figure of the Plot or Preview node, drawn with Plotly and dark-aware. Two switches in the
  editor (the preview shows the result): Interactive (zoom, pan, hover; off is a still picture,
  `staticPlot`) and Colors (as the source colors its points; off is every point in one color).
  Both start on. The backend's figures are drawn for a still picture (no zoom, pan or hover, and a
  mode bar with its tools removed), so Interactive gives them back what they need
  (`interactiveLayout`, `utils/plotly.ts`). A plot fills the task's width and keeps it when a
  setting changes: it is drawn into an element that is hidden by its height, never `display: none`
  (Plotly would measure no width and use its default size), and the element Plotly draws into has no
  Vue-bound `class` (Vue would overwrite the classes Plotly keeps on it, and its styles stop applying).
- Each placed component keeps its `data`, changed in place; `TaskBody` shows it as an editor in the
  list or as plain content in the preview. Preview hides the list's chrome and the Components
  section: the task is its components in a single column. The list to edit and the preview share
  one centered column. The edit column is wider by the padding around a component (3.75rem), so a
  component, and a plot in it, has the width and proportions it has in the preview.
- **Collapse:** a chevron on a study that has tasks hides or shows them, with "n tasks" beside the
  name while hidden. Adding a task shows them. Kept in memory only (a reload shows everything).

## Nodes

- **One registry:** `frontend/app/utils/node.ts` (`NODE_KINDS`) holds each kind's label, icon,
  category, width, parameters and connection rules. The palette, the node list, the drag card and
  the drop handling all read it. A new kind is one entry.
- Labels are obskit's class names. Only **implemented** obskit classes get a node: the ten
  defects, `Observer`, `Domain`, `GridSampler`, `PointSampler`, `GaussianField`, `AnalyticField`, `Multichannel`, and `Sum` and `Product` (as the one Math node).
  Stubs (`BlockGaps`, `RegionMask`, `UniformNoise`, `MultiplicativeNoise`) are left out.
- **Multichannel** (fields): a `fields` port that takes any number of GaussianFields or AnalyticFields (the first
  port with `multiple: true`; a new connection is added, not swapped in), and one `correlation`
  between every pair of channels (default 0). Each connected field is a channel, in connection
  order, with its own parameters and seed, as in scisynth, where a `Multichannel` takes realized
  fields. The fields must share one domain (the node says so otherwise). The request sends a
  `channels` list (`FieldSpec`: `field_params`, `field_seed`) and `correlation`; without `channels`
  the single `field_params` and `field_seed` are used as before. The mix assumes channels of equal
  variance (scisynth's note), so unequal amplitudes blend. A Multichannel goes wherever a field does
  (a sampler's input, an Observer's latent port). One shared correlation is the simplest thing that
  gives correlated channels; groups of channels (two clusters) need a matrix and are not built yet.
  At most 16 fields in all (`MAX_FIELDS`); a correlation scisynth refuses (1, or below
  -1 / (channels - 1)) comes back as its 422 message. Plot shows channel 0, as scisynth does.
- **Projection** (core): takes an Observer and shows its last step in two dimensions, through
  scisynth's `Projection`, fitted on the Observer's first step (the clean samples) and applied to the
  last, as in the example notebook. Choices: `method` (PCA or UMAP) and a `seed` (the estimator's
  `random_state`); UMAP also has `n_neighbors` and `min_dist`, shown only while UMAP is chosen (`when`
  on a `ParamSpec`) and sent only for UMAP. The embedding has two components, fixed; other
  scikit-learn methods and their parameters are not exposed (`PROJECTIONS` in `pipeline.py` lists what
  is). The output is a table like an Observer's, with the columns `c0` and `c1` first, then the
  channels (`value_1`...). A location the Observer dropped has no position, so its `c0` and `c1` are
  empty (`rows_json` turns every non-finite coordinate into null; NaN is not valid JSON). It is a task
  source (`projection` in `SOURCE_KINDS`, named "Projection 1"), which the Cluster component can take
  (it plots the first two columns, so the embedding by default), and a Plot's input, which draws
  the embedding only (one scatter of `c0` against `c1`, coloured by channel 0, from scisynth's
  `plot_observations`; the clean samples and the last step are not drawn, for now). `POST /api/projection` and
  `/api/projection/plot` serve the canvas; the task routes run a saved copy as for an Observer. One
  channel cannot be embedded in two dimensions: scikit-learn's message comes back as a 422. The first
  UMAP run after the backend starts takes about ten seconds (numba compiles); results are cached.
  Not done: a Table component of a Projection (the route accepts it, the picker does not offer it).
- **Math** (fields): one node for scisynth's `Sum` and `Product`, with an `operation` choice (Sum,
  default, or Product) and a `fields` port that takes any number of GaussianFields, AnalyticFields
  or other Maths, in connection order. They combine pointwise on one shared domain (the node says so
  otherwise), at least two of them. In the request a field is a tree: `FieldSpec` gained `operation`
  and `terms` (a list of `FieldSpec`), so a Math can be a sampler's latent, a term of another Math,
  or a Multichannel channel (a GaussianField plus an offset per channel, for the cluster data). A
  Multichannel is not a term (scisynth stacks channels of fields). A loop of Maths is caught on the
  frontend ("The fields loop back on themselves"). All the GaussianFields in one latent, over its
  channels and terms, count towards one limit of 16 (`MAX_FIELDS`), since each is a realized
  field in memory. A choice that is not optional (`default` not null) has no "none" entry in its
  dropdown (`ParamInputs`).
- **AnalyticField** (fields): a `domain` port and one text parameter, `func`, a lambda typed as in
  scisynth (`lambda x, y: 0.1 * x`, one argument per axis, in order; default as given). It is sent
  as `expression` (on `FieldSpec`, which `PlotRequest` extends, and so on each Multichannel channel)
  and the backend builds `AnalyticField(func, domain)`. **The text is never passed to `eval` as it
  is** (the API has no sign-in, and the text comes from the browser): `backend/expressions.py`
  parses it and accepts only a lambda of plain arguments whose body is arithmetic (`+ - * / // % **`,
  `& | ~`), comparisons, numbers, the arguments, `pi`, `e`, and these numpy functions, called by
  name or as `np.<name>`: sin cos tan arcsin arccos arctan arctan2 sinh cosh tanh exp log log10
  sqrt abs sign floor ceil hypot minimum maximum where clip. No other attribute, call, subscript,
  comprehension, string or `if` expression (use `where`). Numbers become floats (so `9 ** 9 ** 9`
  overflows at once), the text is at most 300 characters, and the compiled lambda has no builtins.
  This keeps typos and stray requests from running anything but math; it is not a sandbox against
  a hostile user. A wrong argument count, a non-lambda, a scalar result and a result that is not
  finite (JSON cannot carry it) are 422s with a message. A new kind of text parameter (`text` on a
  `ParamSpec`) is typed into a monospace input. It is a source for a sampler or a Multichannel
  channel like a GaussianField; added to a GaussianField (`a + b`) is not built yet.
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
- **Defect chains:** a defect's input accepts another defect, so defects connected one to the next
  form an ordered list of stages, the list an Observer will use. To stay a list: a defect has **one
  successor** (connecting it to another defect replaces the first; a connection to a Preview does
  not count, so a chain member can also feed one), an input has one predecessor (as always), and
  **loops are refused**, including a defect to itself and a defect to one that already leads to it.
  Outside a list, chains are not tied to an Observer: they can be anywhere on the canvas, and the
  order is the order of the connections. Inside an Observer's stages list the list sets the
  connections instead (see Containers).
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

## Data

- A **Data** node takes a sampler (a GridSampler or PointSampler, in or out of an Observer) and
  shows what it outputs as rows, like a table in a data explorer: the coordinates (one column per
  axis of the field's domain), then `value`. A sample that is not valid has no value ("—").
  It is a viewer like Plot: input on the side, no output, category `core`, plain until a sampler is
  connected and then 420 px wide.
- It runs the sampler the way a Plot does and shares the request (`requestOf`, `utils/sources.ts`): the field
  on the sampler's input (or the Observer's latent port) and its Domain. The same things are
  missing in the same words ("Connect a latent to the sampler", "Connect a domain to the GaussianField"),
  and only a GaussianField is supported so far. Its seed field is the sampler's and appears only
  for a sampler that draws at random (a PointSampler); the field's own seed is on the field.
- `POST /api/data` (the same request as `/api/plot`) returns `{columns, rowCount, rows}` with the
  **first 50 rows** (`DATA_ROWS`; for a grid, row i is the i-th point in grid order, computed
  without building the whole grid), cached like plots. A sampler's output of any size costs the
  same to show.
- **The list is virtualized** (Nuxt UI `UScrollArea` with `virtualize`, fixed 24 px rows): only the
  rows in view are in the page, five and a half at a time (the half hints that it scrolls). A
  header row stays above, the table scrolls sideways when there are many columns (80 px minimum),
  numbers are shown to 5 significant digits, and a caption says how many rows there are and that
  the first 50 are shown. The numbers are `DATA_PREVIEW`.
- **A size limit.** `/api/plot` and `/api/data` refuse a field or a grid of more than 20 million
  cells (`MAX_CELLS`) with a 422 and a message, before anything is allocated. A Domain with five
  axes and the field's default resolution of 128 is 34 billion cells; without the limit the backend
  kept trying to realize it, the machine ran out of memory, and every reload sent the same requests
  again (a white page that froze). The node shows the message instead.
- (An earlier version of this node held an uploaded CSV. That was a misreading and was removed,
  with its `datasets` table and endpoints; a `datasets` table in an older database is unused.)

## Containers (the Observer)

- The Observer is a **container** with **zones**, not a free parent: nodes dropped into it are laid
  out by it, in lists, instead of being placed anywhere inside a box. Its parts, top to bottom:
  the colored header; a **white section** (68 px: `containerTopHeight`, 28 px a row plus padding)
  with its inputs; a **sampler zone**; and a **stages list**. It is 280 px wide and as tall as its
  zones need, so it grows as items are added. A zone is a rounded translucent box (an 8% tint of
  the node's color, 35% border, a small caption on its edge: "sampler", "stages") inside a
  translucent body (4% tint); the card itself is transparent, so the canvas (grid, connections,
  other nodes) shows through. A zone shows a hint while empty ("Drop a sampler here", "Drop
  defects here") and lights up (dashed border, 18% tint) while a node it takes is dragged over it.
- **Inputs (white section):** a `latent` port (accepts any node in the fields category) and the
  `seed` (a whole number from 0, default 0, in `data.params`), in a compact 176 px column like the
  Preview's seed. They follow obskit's `Observer(sampler, stages).run(latent, seed)`. **There is no
  sampler input node any more**: the sampler is placed in its zone. The Observer has no header
  input; its output stays in the header.
- **The sampler zone takes one sampler** (GridSampler or PointSampler, by node type): a second
  one dropped there is refused and stays on the canvas, as is a defect. It sits above everything
  else, as the first thing the run does.
- **The stages list takes defects, and its order sets their connections** (not the other way
  round). Each item is connected to the next by a vertical link: the bottom handle (`next`) of
  one to the top handle (`prev`) of the next, drawn as a straight line. The links are made by the
  list and saved like any connection (ids like `chain:<a>><b>`, so unchanged neighbors keep theirs),
  and the order is read back from them on load. So:
  - **Putting an item in** (from the palette, or dragging a defect in from the canvas) inserts it
    **at the height it is dropped at**, **breaks the item's other defect-to-defect connections**
    (to anything, inside the list or not) and connects it to its new neighbors; the link that
    joined those neighbors is replaced. Its connection to a Preview is left alone.
  - **Taking an item out** (dragging it off, or deleting it) joins its neighbors to each other, and
    it loses its links to them.
  - **The list is sortable:** dragging an item up or down reorders it live as it passes its
    neighbors (by the dragged item's center against theirs), the connections are rewired as it
    goes, and it snaps into its slot on release. A drag that passes no neighbor snaps back.
  - **Items in the list lose the side input** and keep the side output (right), which feeds a
    Preview as before; the top and bottom handles are drawn only while a link is on them, and
    cannot be dragged from. A list item's side output cannot connect to another defect; only
    the list makes defect-to-defect links there.
  **A node that joins or leaves a list is measured again** (`updateNodeInternals` in `KindNode.vue`):
  VueFlow reads where a node's handles are only when the node is resized, so after the list swaps
  its side input for the top and bottom handles (or back), connections kept going to the handles it
  used to have. A defect taken out of a list ended its incoming connection at its top instead of
  its left side.
  **Handle order matters:** a connection saved without a handle name (every Preview connection)
  attaches to the first handle of its kind in the node's markup. The side output is therefore
  declared before the list's `prev` / `next` handles in `KindNode.vue`; with the bottom `next`
  handle first, Preview connections from list items were drawn from the bottom. Naming the side
  output instead would have needed a migration of saved connections.
  The list remembers the order it was last given (`knownOrder`) because the links go when an item
  does (deleting a node removes its links): the order that is left is the remembered one without
  the item, not whatever the surviving links say (rebuilding it from them put the item before
  the removed one at the end).
- **The nodes inside are still real canvas nodes** (children, with `parentNode` set), so they keep
  every control, their connections and a connection to a Preview. They move with the Observer.
  Their places are set by one pure function (`containerLayout`, `app/utils/container.ts`), which
  also gives the zone heights and the node's total height, so what is drawn and where the nodes are
  cannot disagree: a zone is the larger of its minimum (56 px for the sampler, 160 px for the list;
  the list is 262 px wide against 180 px for the items) and its items (8 px padding, 16 px
  between items, so the vertical link between neighbors is visible, items centered). It runs again whenever a child is added or removed, a child's
  measured height changes, or a connection changes the order.
- **Dragging in and out:** a defect from the palette dropped on a zone that takes it is created
  inside; one dragged from the canvas onto it moves in when released. The pointer decides for a
  palette drop and the dragged node's center for an existing node. Dropped on its own zone it snaps
  to its slot (and reorders, in the stages list, as above); dropped anywhere else, including the
  Observer's white section and margins, it is taken out and stays where it was let go, and the list
  closes up.
- **Deleting an Observer deletes what is inside it** (the sampler and the list), however it is
  deleted (sidebar list or select and Backspace): a watcher removes any node whose parent is gone.
- **Connections of a node inside a container are drawn above the container** (they would be
  hidden behind it otherwise). VueFlow draws every connection under every node by default (each
  connection has its own layer, `zIndex`, 0). A connection with an endpoint inside a container takes
  the layer of that node (the container is at 0 and its children at 1; a node on the same layer is
  drawn over a connection, so the children still cover it). It follows the node's layer because
  VueFlow lifts a selected node by 1000 (the container too, with its children above it); a fixed
  layer of 1 was hidden again once the Observer was selected. The layer is derived, not saved.
- Saved as `nodes.parent` (null for top-level nodes), migrated on startup. Containers are written
  before their children. **Older data is converted on load:** an Observer saved as a 640 x 400
  box with freely placed children has them stacked into its list, in the order their side links
  gave (unconnected ones last); those links are replaced by the list's vertical ones and any link
  from a list item to a defect outside is broken, and the converted study is saved at once. Connections
  saved against the Observer's old `sampler` input are dropped too.
  A saved sampler that was only connected to it stays an ordinary canvas node.
- **The sampler heads the Observer's chain.** A sampler in the sampler zone is linked to the first
  stage by the same vertical link as the stages (its bottom handle `next` to the stage's `prev`), so
  the chain is sampler, stage 1, stage 2, ... It has no side input (the latent is the Observer's) but
  keeps its side output, for a Plot. It has no top handle. `applyOrder` builds the chain from the
  sampler (`headOf`) plus the list; a connection into a placed sampler is dropped. In `KindNode.vue`
  `contained` (any node with a parent) replaces the old `listed` / `placed` pair, and the list-link
  rule in `useConnectionRules` now allows a sampler as the source.
  Outside it a sampler takes a latent (a field) on its input and its output feeds a defect (the
  head of a chain); a Preview still takes only defects. A defect put in the list loses any
  connection coming from a sampler outside it.
- **Not decided yet:** how the Observer reads its sampler and stages (the structure is built,
  nothing consumes it yet), whether a chain must lie inside one Observer (it is not enforced), and
  whether a defect chain made outside a list should still exist now that a list builds them.

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

## Plot

- A Plot takes one sampler (a GridSampler or PointSampler, in or out of an Observer) and draws
  `sampler.plot(latent, seed)`. It needs a **latent**: the field on the sampler's input, or for a
  sampler in an Observer the field on the Observer's latent port. Until there is one the node says
  what is missing ("Connect a latent to the sampler", "Connect a domain to the GaussianField").
- **Only a GaussianField and an AnalyticField can be plotted so far**: scisynth needs a realized
  latent, and the nodes can only describe those two (a GaussianField by its parameters, an
  AnalyticField by its lambda), each with its Domain's axes.
- **Seeds:** the field's seed belongs to the GaussianField (a `seed` parameter, default 0) and
  realizes it. The Plot's own seed is the sampler's and is shown only when the connected sampler
  draws at random (`seeded` in the registry: PointSampler yes, GridSampler no). Before, one Plot
  seed did both, so it changed the field.
- `POST /api/plot` takes the sampler type and parameters, the domain's axes, the field's parameters,
  the field's seed and the sampler's seed; the figure is static like the Preview's, cached by the
  whole request (64). obskit's own errors (a 1-D or 3-D observation, a shape that does not fit the domain) are a 422, shown in
  the node.
- The node is as wide as the Preview once connected, and shares its component (`NodePlot.vue`,
  once `PreviewPlot.vue`), plot size and seed field (`SEED` in `utils/node.ts`).
- **Trace:** a node that takes an Observer and outputs its trace (`Observer.trace`: every step's
  output kept). A Plot accepts it and draws `observer.plot(kind="trace")`, obskit's 3-D view of the
  steps, through `POST /api/trace/plot` (cached like the Observer's plot). The Trace has no
  parameters and no figure of its own: the Plot sends the Observer's request (run with the
  Observer's seed) with type `trace`, and says "Connect an Observer to the Trace" until there is one.
  It is not a source for a task; a Plot of it can be copied into one (`_run` routes the type).

## Speed

- Measured on the backend (no network): a Data request takes 2 to 60 ms cold and under 1 ms cached,
  because it only builds the first 50 rows; a 64 x 64 plot takes about 50 ms cold and sends 170 kB
  (a 256 x 256 grid, 2.6 MB). So what is felt is mostly in the browser.
- **plotly.js is preloaded** in the background (`preloadPlotly`, on idle) when a study page opens,
  so the first plot does not wait for its 5 MB download. It is still not loaded with the app, nor
  on the pages that never plot.
- **One request at a time, latest wins** (`useLatestRequest`, used by `NodePlot` and `DataTable`).
  A change to what the node asks for cancels the request in flight (`AbortController`) and, after
  the 250 ms pause, a refresh shows the outcome for the key it finds. **A bug this replaced:** a
  result that arrived after the inputs had changed was dropped, and when the inputs then went back
  to what had been requested, the refresh saw "already shown" and did nothing, leaving the node on
  "Loading Plot" / "Loading Data" for good (seen when changing a seed). The refresh now puts back
  the outcome that is on screen when the key is the one already shown, and a refresh that arrives
  while a request is running is remembered and run after it. Tested with a slow backend and
  changes spaced from 40 to 900 ms.
- Not done (suggested): a shorter pause after a parameter change (now 250 ms), and thinning very
  large plots (a 65k-point plot sends 2.6 MB).

## Canvas and drag and drop

- The sidebar's top section lists the nodes on the canvas (delete removes one, as does selecting it
  and pressing Backspace); the bottom section is the palette.
- Dragging leaves the original in place (clone feedback) and shows a card that looks like the
  node it will become, centered on the pointer; there is no drop animation.
- Opening a study fits the view to its nodes once (10% padding, at most 150% zoom, minimum zoom
  0.1). An empty study opens at the default view, and adding nodes does not move the view.

## Selection

- A selected node is drawn with a two-ring outline (a gap in the page background, then the page's
  strongest text color), which stands out on every category color in both color modes. The same
  ring marks its row in the sidebar list (`.selected` in `main.css`).
- Selection is shared both ways through the flow store. Picking a row (a button, so the keyboard
  works) selects that node alone and glides the canvas to it at the zoom it already has, easing in
  and out (cubic) over 400 to 900 ms depending on the distance; selecting
  a node on the canvas scrolls its row into view (`block: "nearest"`, so a visible row does not
  move). The canvas does not pan when the node itself is clicked.

## Sidebars

- Both sidebars (the study page and the task page) are tinted (`bg-elevated`) with a stronger right
  border, so they read as a panel next to the canvas or the blank area. Each section is a
  `SidebarSection`: a labelled bar (small uppercase, muted, on a darker tint) over a scrolling list
  on the page's own background, set off from the one above by a stronger line, so the cards in it
  stand out. Study page sections: "On the canvas" and "Add a node"; task page: "Tasks".

## Look

- Theming goes through Nuxt UI (`app.config.ts` for the colors, CSS variables for the rest).
  Primary color blue; border radius `0.125rem`; font Inclusive Sans, self-hosted at weight 400.
- **Nothing is bold** unless asked: one global rule sets `font-weight: 400`. Add exceptions in
  `main.css` when bold is wanted.
- **Dark mode** covers the nodes and the sidebar items alike: a category is an opaque dim tint of its
  color (22% over the page background, opaque so connections do not show through) with a lighter
  icon and outline and the normal text color (`.dark .cat-*` in `main.css`). A node's body and the
  shaded band in it are `--node-surface` and `--node-sunk`. Plots dim their plot area and grid in
  dark mode and redraw when the mode changes. Not done yet: the minimap and the zoom controls are
  still light. (Earlier, node fills were light in both modes; that is no longer so.)

## Change log

- **2026-10-05** Cleanup. Backend: the unused `GET /api/tasks/{id}` and the one-off
  `gaussianRandomField` rename are gone, a study and a task share one `Rename` body, the plot and data
  endpoints share their request handling, and the size check is one small function. Frontend: the
  "drag a clone" plugins (`CLONE_PLUGINS`), the sidebar's Back and title (`SidebarHeader`), the
  inline rename of a study or task (`useRename`) and the sidebar component's drag id
  (`componentTypeOf`) were each written twice and now exist once. One behaviour change: a study can
  no longer be renamed to an empty name (the old name comes back), as for a task.
- **2026-10-05** Fixed a removed component staying on screen in a task's list after the list had been
  sorted (it went only when another was removed, and the last one never did). The list sorts by
  moving its elements, and Vue removes a `<template v-for>` item by walking from its first node to
  its last, which misses an element that was moved. The rows are now one element each, with no
  fragment around them (a placeholder is a row too). Do not wrap the items of a sortable list in a
  `<template v-for>`.
- **2026-10-05** Task list: a component dragged in from the sidebar shows where it will land (a
  dashed placeholder among the items, at the pointer's index), and the list's own items sort like any
  other list (they move, with the usual drop animation, and no overlay). The list has a drag and drop
  area of its own for sorting; the page's area handles the sidebar's components, which are the only
  thing held in an overlay (`TaskDragOverlay`).
- **2026-10-05** Task components (and the items of a task's list) no longer animate back when
  dropped: they are held as a `DragOverlay` without a drop animation (`TaskDragOverlay`), like the
  node components.
- **2026-10-05** The tasks screen: a study's Task button now opens one screen with all its tasks
  (`/admin/studies/{id}/tasks`; the canvas moved to `/admin/studies/{id}`), and New task is on that
  screen. A task's edit button opens that task there (`?task=`). The sidebar has the tasks (sortable)
  and a Components section of placeholders (Text block, Question, Image, Rating scale); the main
  area is one big list per task that they are dragged into, placed where dropped, and sorted by
  their grip. What is in a task's list is kept in memory only (placeholders), not saved. The old
  `/admin/tasks/{id}` page and its `GET /api/tasks/{id}` endpoint are gone.
- **2026-10-05** The tasks in a task page's sidebar can be sorted by dragging (a grip on each, its own
  drag and drop area, `TaskLink`). The order is saved (`PUT /api/studies/{id}/tasks/order`, the same
  as on the home page) and the home page shows it, also after a reload.
- **2026-10-05** Fixed Plot and Data failing after an axis was added or deleted: a per-axis list (the
  field's resolution) kept its old length and obskit rejected it ("Expected 4 positive sizes, got
  5"). `samplerRequest` now fits such a list to the Domain's axes (extra values dropped, missing ones
  repeat the last).
- **2026-10-05** Fixed a white, frozen page on reload: a Domain with 5 axes feeding a field at
  resolution 128 asked the backend for 34 billion cells. Plot and Data requests over 20 million cells
  now get a 422 with a message (`MAX_CELLS`).
- **2026-10-05** Speed: plotly.js is preloaded when a study page opens, and an in-flight plot or data
  request is cancelled when a newer one starts.
- **2026-10-05** Fixed Plot, Preview and Data staying on "Loading ..." after their inputs changed
  and changed back (a seed edit); the request handling is now one shared composable
  (`useLatestRequest`).
- **2026-10-05** Added the Data node: it takes a sampler and lists its output as rows (a virtualized
  list of the first 50; `POST /api/data`). Plot and Data share `useSamplerRequest`. A first version
  that held an uploaded CSV was a misreading and was removed.
- **2026-10-05** Sidebars and their sections are easier to tell apart: tinted sidebar, labelled section
  bars, stronger dividers (`SidebarSection`).
- **2026-10-05** Each task has an edit button that opens its page: a sidebar with the study's tasks
  and a blank main area.
- **2026-10-05** Open tasks stay open while their study is dragged (the study's drop target is just its
  card), replacing the fold-away during a drag.
- **2026-10-05** Tasks are auto-numbered, can be renamed, and tasks and studies can be sorted by
  dragging (and the order is saved); a study's tasks can be collapsed.
- **2026-10-05** A Task is its own card just under its study, indented, not a row inside the study's card.
- **2026-10-05** The clipboard button on a study adds a Task under it (new `tasks` table and endpoints);
  tasks are listed under the study and can be deleted.
- **2026-10-05** The Study card is a filled, raised card (elevated background, stronger border, a
  small shadow) instead of an outline. A new icon button on it (clipboard) is meant to turn the
  study's data workflow into a user study task; it does nothing yet.
- **2026-10-05** The neutral color is `zinc` instead of `slate`, so the dark background and the grays
  are no longer blue-tinted (`app.config.ts`). Say if it should be more or less neutral: `neutral`
  is pure gray, `stone` is warm.
- **2026-10-05** Dark-mode axes on every panel of a figure: only the first axis pair (the "before"
  panel) was recolored, so a Preview's "after" panel kept white grid lines and a pale plot area.
- **2026-10-05** Dark mode for the nodes themselves (see Look), plots included.
- **2026-10-05** Dark mode for the sidebar items (palette and node list): a dim tint of the category
  color, a lighter icon and normal text (`.side-item`). Nodes on the canvas stay light.
- **2026-10-05** Smoother pan to a picked row: eased in and out, and a longer trip takes longer.
- **2026-10-05** Clearer selection ring, and selection shared between the sidebar list and the canvas
  (centering on a picked row, scrolling to a picked node's row).
- **2026-10-05** The palette lists Observer, Preview and Plot together at the top, then Domain and the
  samplers. The Observer is back to the core (blue) color: a separate `observer` category (pink) that
  had been added to the working tree was removed.
- **2026-10-05** Domain, GridSampler and PointSampler have their own category, `sampling`, in violet
  (Nuxt UI's `secondary`, set in `app.config.ts`); Observer, Preview and Plot stay in `core` (blue).
- **2026-10-05** The GaussianField has its own seed; the Plot's seed is the sampler's and appears only
  for a random sampler (PointSampler).
- **2026-10-05** Added the Plot node: a sampler's plot on its latent (`POST /api/plot`), GaussianField
  only for now. `PreviewPlot` renamed `NodePlot` and shared; the seed field is one constant.
- **2026-10-04** Sampler parameters: GridSampler `shape` (one number for every axis, default 64) and
  PointSampler `n` (default 100). A per-axis `shape` is not offered: the sampler does not see the
  field's domain.
- **2026-10-04** A sampler outside an Observer takes a field on its input and can feed a defect.
- **2026-10-04** The sampler in the Observer is the first link of its chain (sampler to stage 1),
  with its side output back and no side input. Observer code reviewed: `listed` and `placed` merged
  into `contained`, nothing else found to be dead.
- **2026-10-03** Fixed defects that have been in a list connecting side to top once they are out:
  VueFlow had kept the old handle positions. The node is now measured again when it joins or leaves
  a list (`updateNodeInternals`).
- **2026-10-03** Code clean-up, no behavior change. `FlowCanvas.vue` (500 lines doing four jobs) is
  split into `useConnectionRules`, `useContainers` and `useGraphSave` (110 lines left). One shared
  layout helper replaces three copies of "a container's children as layout items" (and the
  estimated-height fallback), a zone box now carries its zone (label, hint), `catTint` replaces two
  hand-written `color-mix` strings, the "put into the list" steps are one function, the list's
  remembered order is forgotten when its container is deleted, `ParamInputs` checks a value's range
  in one place, and the backend's four "add a column if missing" blocks are one `ensure_column`.
- **2026-10-03** Fixed a list item's side output: its Preview connection was drawn from the bottom
  handle because an unnamed connection takes the first handle of its kind and `next` came before
  the side output. The side output is declared first now (no data change, saved connections are
  fixed too).
- **2026-10-03** The Observer's stages list now sets the connections: putting an item in inserts it
  where it was dropped, breaks its other defect connections and links it to its neighbors; the
  list is sortable by dragging (live, with the links rewired); neighbors are joined by vertical
  links, and list items lose the side input but keep the side output for a Preview. Taking an item
  out or deleting it joins its neighbors. Gap between items 8 to 16 px. (Replaces "the order comes
  from the connections".)
- **2026-10-03** The Observer is rebuilt around zones instead of a free parent box. A white section
  holds `latent` and `seed` (the sampler input node is gone); under it a sampler zone takes one
  sampler, and a stages list takes defects, grows with them and lists them in the order they are
  connected in. Items keep all their controls, snap back into place when dragged inside the list, and
  leave it when dragged out. The body stays translucent and is wider than the items. Older
  Observers are converted on load. (Replaces the 640 x 400 container with free placement and
  clamping, and the sampler port.)
- **2026-10-03** Observer inputs reordered to latent, sampler, seed, and kept compact (176 px, like
  the Preview's seed) rather than filling the node.
- **2026-10-03** Defects connect to one another to build a chain (an ordered list of stages): one
  successor each, no loops. The Observer's body is translucent, and a white section above it holds
  its inputs: a sampler port, a latent port and a seed. Port fields now show the connected node's
  name (a Domain still shows its axis names).
- **2026-10-03** Connections of nodes inside an Observer are drawn above it (under the nodes
  inside), also while it is selected, instead of disappearing behind its body.
- **2026-10-03** The Observer is now a large container node (640 x 400) that holds defect nodes:
  dropped on its body from the palette, or dragged in and out; they move with it, are saved with a
  `parent`, and are deleted with it. Defects inside can still be connected (e.g. to a Preview).
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
- **2026-10-06** Tables: delete rows and columns, sort rows (columns were sortable briefly, then
  removed), plainer editor. Plot: Interactive and
  Colors switches (an earlier show/hide switch was a misreading). Edit / Preview is a tab toggle.
- **2026-10-06** The edit list is as wide as the preview (one shared `max-w-2xl` column).
- **2026-10-07** A Plot node takes an Observer (as well as a sampler), using obskit's `Observer.plot`:
  one panel per step, led by the latent (drawn on a 64-per-axis grid, `show_latent`), titled with the
  step names (`latent`, `sampler`, `gaussian_noise`...), at most four panels a row with one shared
  color bar. `POST /api/observer/plot` takes the same body as `/api/observer` (the Observer's own
  seed is the run's); the Plot node's own seed is hidden since an Observer has one. The frontend asks
  for it when a Plot's source is an Observer (`endpointOf`). A figure of more than one row of panels
  sets its own height and margin (obskit does, past four panels), so the node and the task's Plot
  component keep those instead of the fixed sizes. As before, only a 2-D observation can be drawn
  (obskit's scatter), so more axes is a 422. A task's Plot component can copy such a Plot (the
  copy's `type` is `observer`); note it then shows the latent panel, which a participant must not
  see: decide before the participant view whether the task's copy leaves it out (`show_latent`).
- **2026-10-07** Fix: the node header's link icon was absolutely positioned, which made the header a positioned element and painted it over the node's handles (the half of an input or output inside the card was covered, so it could not be grabbed). The header is now a three-column grid (title in the middle, link at the end) with nothing positioned.
- **2026-10-07** Frontend cleanup after the latest changes: the source bar's sync state is one `status` (`gone`, `waiting`, `stale`, `synced`) instead of three flags; `ClusterSettings` computes the color column's values and range once; `DATA_PREVIEW.rows` (unused since the Cluster table went) is gone.
- **2026-10-07** Backend split into modules (one 670-line `main.py` held everything). `main.py` is
  only the app (`main:app` still starts it), the lifespan and the health check. `db.py`: the
  schema, `db()`, `init_db()` (tables and added columns), `require_study`, `task_components`,
  `set_order`. `schemas.py`: what the API accepts. `pipeline.py`: obskit behind the API (defects,
  samplers, `PlotRequest`/`ObserverRequest`, the cached builders, `rows_json`). `routes/`: one
  `APIRouter` per area: `studies` (studies, canvas, usage), `tasks`, `observe` (preview, plot, data,
  observer) and `components` (what a task's saved copies show). Same endpoints, no behavior change.
  `set_order` takes the ids, not the request model, so `db.py` does not depend on `schemas.py`.
- **2026-10-07** obskit update. Its `Observation.values` and `truth` now end in a channel axis, `(*spatial, d)` (a grid is `(8, 8, 1)`, points `(n, 1)`); `mask` stays spatial. `_rows_json` works from `spatial_shape`, so a grid's rows were wrong (the grid Data table gave a 422) and a count of `values.size` would be too large with several channels. It now gives one row per location, with the column `value` for one channel (so the frontend is unchanged) and `value_1`, `value_2`... for several, a dropped location empty in all of them. The size limit moved into obskit: the backend passes `max_cells=MAX_CELLS` to `GaussianField` (and to `GridSampler`), overriding what a request sends, and the 422 carries obskit's message; the demo's own `_cells`/`_check_size` are gone. Not used yet: `Multichannel`, per-channel defect parameters, named stages.
- **2026-10-07** Links between canvas and tasks. A node that a task uses as a source shows a small
  checklist icon in its header that opens that task (the first one, if several; the title says how
  many). `GET /api/studies/{id}/usage` gives node id -> task ids from the saved components, read
  when the canvas page opens (it provides it as `NODE_TASKS`). Back the other way, the source bar
  of a component has a workflow icon that opens the canvas at `?node=<id>`: the node is selected and
  the view fitted to it. Hidden when the node is gone from the workflow.
- **2026-10-07** The canvas controls and minimap use the page colors (`--ui-*`) in both color modes: the minimap's background, nodes and mask (`--minimap-node`, `--minimap-mask`, passed as props), and the control buttons. The rules are prefixed `.vue-flow` because the libraries' stylesheets load after ours.
- **2026-10-07** The Data node's table is styled like `DataGrid` (rows `bg-default`, header `bg-accented`), in light and dark mode.
- **2026-10-07** `DataGrid` has its own background (rows `bg-default`, header `bg-accented`) so it stands apart from the component card in the editor and the page in the preview.
- **2026-10-07** Cluster cleanup: the settings are their own component (`ClusterSettings`), `groupColor(i)` replaces the repeated palette lookup, and the plot keys the no-value group as `Infinity` so groups sort plainly. Components change `data` in place (an emitted copy is not picked up by the list).
- **2026-10-07** Cluster: the preview also leaves out points with no value to color by.
- **2026-10-07** Cluster: a named category per range, points with no value left out by default, preview plots one color.
- **2026-10-07** Cluster: order is source, plot, settings; the data grid is removed.
- **2026-10-07** The edit column is widened by the list and item padding, so components are as wide as in the preview.
- **2026-10-06** Cleanup of the task code: `usePlotly` (themed Plotly drawing, shared by the task Plot
  and the Cluster plot; the Plot no longer refetches when a switch changes), `RequestNote`,
  `UFormField` and `UBadge` in place of hand-made markup, the Cluster ranges on a `USlider`
  (clicking the bar no longer adds a break: Add break does), `ONE_COLOR` shared.
- **2026-10-06** Cluster ranges are a slider bar with break handles (click to add, drag, double-click
  to remove) in place of number inputs.
- **2026-10-06** Cluster scatter plot: choose the X, Y and Color by columns, and group a numeric
  color column by number ranges (editable breaks); `GET .../points` returns up to 5,000 rows.
- **2026-10-06** Cluster component (source only): an Observer is a task source; the backend runs it
  (`ObserverRequest`, `/api/observer`) and the component shows its columns and rows. `DataGrid` and
  `useCopiedRows` are shared with the Table.
- **2026-10-06** Task plots: they fill the component from the first draw and keep that size when a
  setting changes, and Interactive works (it did nothing, since the figures are drawn still).
- **2026-10-06** Tasks use the workflow's data: components are saved with the task; Table and Plot
  show a copy of a Data / Plot / Preview node, with sync state and Refresh; the backend serves a copy
  by task and component. `useSamplerRequest` became `requestOf` (a pure function of the graph) with
  `useFlowGraph`; the typed-in table was removed. `GET /api/tasks/{id}` is back (it returns the
  components).
- **2026-10-06** Task components: Text, Table and Plot replace the four placeholders, and the tasks
  screen has an Edit / Preview toggle (the preview is the task without the list).
- Before 2026-10-03 (in order): Nuxt UI and Nuxt replaced PrimeVue; SQLite persistence; node kinds
  and categories; Domain axes; connections, Preview and its plots; RandomDropout parameter and the
  Preview's seed; parameters for the other defects; number inputs with arrows left and right;
  closer zoom on open; the `venv` workaround.

- **2026-10-07** obskit review (commit "add stage list"). Observers now hold their stages in a
  `StageList`, `Observer.trace` returns a `Trace`, and `observer[i]` / name slicing are gone
  (`with_stages` replaces them). The demo uses none of that, only `Observer(sampler, stages)`,
  `run` and `plot`, so nothing needed to change; the backend tests pass against it. Tidied
  `pipeline.py` (return types on the two builders, one awkward `except`). New and not used yet:
  `Trace.plot` draws the steps without the latent panel, which would be the participant-safe copy
  of a Plot of an Observer (no `show_latent` flag needed).
- **2026-10-07** obskit review (commit "add ids to points diff", plus its uncommitted point-set work).
  New stages `PositionJitter(sigma)`, `RandomInsertion(n)` and `Downsample(factor)` are nodes
  (category defects, so they chain and preview like the others). The first two need a points
  observation (PointSampler) and `Downsample` a grid (GridSampler); the wrong sampler is obskit's
  `ValueError`, which comes back as a 422 with its message. `DEFECTS` and `DEFECT_PARAMS` in
  `pipeline.py` were two tables to keep in step; they are one, `DEFECTS[type] = (class, params)`.
  Not adopted: `Observation.spatial_coords` for `rows_json` (it broadcasts a grid's coordinates to
  every cell, up to `MAX_CELLS`, where `rows_json` computes only the rows it sends). Still unused:
  `Trace` diffs and links, `Observer.plot(kind="trace")` (the 3-D view).
- **2026-10-07** Duplication cleanup.
  - `NodePlot` draws through `usePlotly` like `TaskPlot` (it fetches the figure into a ref; the
    dark-mode axes and the purge are `usePlotly`'s). `usePlotly` also redraws when its element
    changes, since `NodePlot`'s element comes and goes with the connection.
  - One table: `DataGrid` (Nuxt UI `UTable`, sticky header, virtualized rows, `height` caps it) serves
    both the Data node and the Table component; `DataTable` is only the node's fetching around it.
    `DATA_PREVIEW.rowHeight` is 28 now (`UTable` rows with `py-1`), so the half row of hint is
    approximate; look at it in the browser.
  - `RequestNote` also shows what is missing (the `waiting` message), so the nodes no longer write
    their own loading, waiting and error lines.
  - Sortable lists: `useSortableRow` (the row's element, grip and dragging state), `onSorted` and
    `moveItem` (`utils/dnd.ts`) replace four copies of the setup and five of the drag-end code.
    `EditableName` is the rename-in-place field of a study and a task (the task's field is `sm` in
    both now). `AppHeader` is the header of the admin and user pages.
  - `routes/components.py` runs a copied request through one `_run`, instead of two switches.
- **2026-10-07** obskit review again (commits "cleanup and fix bugs", "cleanup docs, docstrings..."). The
  public names the backend uses are unchanged (`observe` was removed; the demo never used it).
  `rows_json` takes the row count from `Observation.size`. Checked against the new obskit: every
  defect's preview, Data / Plot / Observer / Observer plot for grid and point samplers in 2 and 3
  axes, the right and wrong sampler for each point-set stage, the size limit and an unknown defect
  all answer as expected; obskit's own 333 tests pass.
- **2026-10-08** Trace node (Observer in, Plot out): `trace_plot_json`, `POST /api/trace/plot`, the
  `trace` kind, and a Plot of a Trace in `requestOf` / `endpointOf` and in the copied-component
  routes. The trace figure has surfaces, which have no dots, so `NodePlot` sizes dots only on traces
  that have markers.
- **2026-10-08** A Plot of a Trace drew nothing: Plotly's `staticPlot` leaves a 3-D scene blank (only
  the legend showed; checked in headless Chrome, with and without the figure hidden while it was
  drawn). `NodePlot` draws a figure with a `scene` non-static (still without the mode bar); a Trace
  with no stage is a 422 from obskit ("a trace needs a sampler and at least one stage"), shown in the node.
- **2026-10-08** A Plot of a Trace is interactive: its plot area is `nodrag nowheel nopan`, so dragging turns the
  3-D view and scrolling zooms it, instead of moving the node or the canvas. Other plots stay still pictures.
- **2026-10-08** Comments shortened across the backend and frontend: one or two lines each, no restating what the
  code says. No behavior changed.
- **2026-10-13** The library `obskit` was renamed `scisynth` (now `../scisynth`). The backend imports `scisynth`
  and `pyproject.toml` depends on it at `../../scisynth` (editable); `uv sync` replaced the old install. The
  backend would not start because `obskit` was gone from disk and the venv's `.pth` pointed at it.
- **2026-10-20** Added `README.md` with the backend (`uv run uvicorn main:app --reload --port 8000`) and frontend
  (`pnpm dev`) start commands. The frontend proxies `/api` to port 8000, so the backend starts first.
- **2026-10-20** Added the Multichannel node (see Nodes): a `fields` port that takes several GaussianFields
  (`multiple` on a port: `useConnectionRules` keeps every connection to it, `ParamInputs` shows "n fields")
  and a `correlation`. `latentOf` (`sources.ts`) is now `fieldOf` (one GaussianField and its axes) plus
  the Multichannel case; `PlotRequest` gained `channels: list[FieldSpec]` and `correlation`, and
  `sampler_and_latent` builds a scisynth `Multichannel` when `channels` is given. A first version took one
  field and a `channels` count (seeds `field_seed + i`); that was replaced, since the cluster data needs
  channels that differ. Checked through the API (3 and 6 channels with their own seeds and amplitudes, plot,
  Observer; a correlation of 1 and 17 channels are 422s) and with `nuxt typecheck`; not yet looked at on the
  canvas.
- **2026-10-20** AnalyticField node: type a lambda, evaluated as scisynth's `AnalyticField` does. `ParamSpec`
  gained `text` (a text parameter, in `ParamInputs`), the node got a `domain` port, `fieldOf`
  (`sources.ts`) sends `{ expression }`, `FieldSpec` gained `expression` (`PlotRequest` extends it) and the
  new `backend/expressions.py` checks and compiles the text (see Nodes). A Multichannel's `fields` port
  accepts AnalyticFields too. Checked through the API (five valid lambdas, a Multichannel with an
  analytic channel, a plot, and 18 refused ones: attribute access, `__import__`, `open`, a call of a
  call, a comprehension, a string, `**kwargs`, `9 ** 9 ** 9`, a division by zero, wrong argument
  count, over-long) and `nuxt typecheck`; not yet looked at on the canvas.
- **2026-10-20** Added the Math node (Sum or Product of the fields on its `fields` port; see Nodes).
  `fieldOf` (`sources.ts`) became recursive and shares `fieldsAt` with the Multichannel case;
  `FieldSpec` gained `operation` and `terms`; `sampler_and_latent` builds scisynth's `Sum` or
  `Product`; `MAX_CHANNELS` became `MAX_FIELDS` and counts every realized field. Fixed a mistake in the
  previous entry: the Multichannel's `fields` port still accepted only GaussianFields (a replacement had
  silently not applied, after the formatter reflowed the line), although this file said AnalyticFields
  too. It now takes AnalyticFields and Maths (`FIELD_TERMS`). Checked: through the API (sum and product
  equal the sum and product of their parts, nested, a Multichannel of two "GaussianField + step"
  channels, one term, no terms, 17 fields, a bad operation) and through the frontend's `requestOf`, run on
  graphs of the nodes (sum, nested, channels, an analytic channel, a loop, two domains, no domain), and that
  request sent to the backend; `nuxt typecheck`. Not yet looked at on the canvas.
- **2026-10-20** Added the Projection node (PCA or UMAP of an Observer; see Nodes). Backend: scikit-learn and
  umap-learn added; `ProjectionSpec`, `ProjectionRequest`, `build_projection`, `projection_json` and
  `projection_plot_json` in `pipeline.py`; `POST /api/projection` and `/api/projection/plot`; the task
  routes run a copied projection; `rows_json` writes null for a coordinate with no position. Frontend:
  `projection` kind (Plot accepts it), `when` on `ParamSpec` (and `ParamInputs` hides the rows), `projectionRequest`
  in `sources.ts`, `projection` a source kind, and the Cluster component's picker offers it. Checked: through
  the API on the cluster data (6 channels in two groups, Observer with noise and dropout; PCA and UMAP rows and
  plots; an unknown method, parameter and value and a one-channel Observer are 422s; the output is valid
  JSON), that both methods separate the two groups (their centres are about 1.7 spreads apart),
  the frontend's `requestOf` on graphs of the nodes sent to the backend, and the same requests saved
  as a task's Cluster, Plot and Table components and read back through the task routes; `nuxt typecheck`.
  Not yet looked at on the canvas or in the task view.
- **2026-10-20** The message for a field with no domain now names it ("Connect a domain to the AnalyticField", not "...to
  the field"). Found in a study where the Domain was connected to the GaussianField but not to the AnalyticField
  beside it in a Math: both fields need their own Domain, and the old message did not say which one lacked it. Checked
  by running that study's saved graph through `requestOf` (the message, and every plot and the Projection ready once
  the AnalyticField has the domain).
- **2026-10-20** The Plot of a Projection draws only the embedding: `projection_plot_json` passes scisynth's
  `plot_observations` the embedded last step alone, where it passed the clean samples, the last step and the
  embedding. Done here, not in scisynth. Checked through the API for PCA and UMAP: one scatter trace, all 576
  points, axes `c0` and `c1`, titled with the method, coloured by channel 0 with a colour bar. Not yet looked at
  on the canvas.
- **2026-10-27** Hosting on Railway as one container. The `Dockerfile` builds the frontend (`pnpm generate`, new
  script, static since `ssr` is off) and the backend serves it from `FRONTEND_DIR` through `SinglePage`, a
  `StaticFiles` that answers a missing path with no file extension with `index.html` (the study and task pages
  route in the browser); `/api` and missing files stay 404. Without `FRONTEND_DIR` (development) nothing is
  mounted. scisynth is now a git dependency (`khoa-l/scisynth`, `main`) instead of the editable `../../scisynth`
  path, which a remote build cannot see; the lock pins commit 55bb3fc. The database lives on a volume at `/data`.
  Checked: `pnpm generate`, and the built files served through the backend (pages, deep links, 404s). The image
  itself was not built (Docker was not running) and nothing is deployed yet.
