# Operator Screen Layout Spec

Portable layout description of the **operator console** (line-mounted tablet). Use this to rebuild the same spatial design in another project. This document covers **layout, chrome, spacing, tokens, and stacking only** — not business rules, APIs, or form fields.

**Source of truth in this repo:** `packages/client/src/components/layout/operator/`, `packages/client/src/components/process/ProcessLayout.tsx`, `packages/client/src/components/process/CaptureWorkspace.tsx`, `packages/client/src/components/process/ProcessHub.tsx`.

**Not this layout:** Plant / Machine Head / Admin desks use a 200 px labelled sidebar (`DeskSideNav`). Do not copy that here.

---

## 1. Target surface

| Constraint | Value |
|---|---|
| Device | Landscape industrial tablet |
| Viewport | Full screen, no browser chrome |
| Orientation | Landscape only |
| Interaction | Finger / glove; large hit targets |
| Overflow | Outer shell never scrolls. Inner panes scroll. |
| Height model | `h-screen` + `overflow-hidden` (locked viewport) |

The operator UI is a **kiosk frame**: left icon rail + top status strip + fill canvas + optional right action rail. Content never sits under the rails.

---

## 2. Design tokens

Light industrial theme. Recreate these names even if hex values change.

| Token | Hex | Role |
|---|---|---|
| `--background` | `#FFFFFF` | Surfaces, cards, rails |
| `--foreground` | `#163328` | Body text |
| `--primary` / `--nav` | `#163328` | Deep industrial green — nav rail, capture header, primary buttons |
| `--primary-foreground` / `--nav-foreground` | `#FFFFFF` | Text on green |
| `--accent` | `#F1B824` | Steel gold — highlight CTA, Hold, End Shift |
| `--accent-foreground` | `#163328` | Text on gold |
| `--secondary` / `--muted` / `--card` | `#F4F6F5` | Canvas / page background behind cards |
| `--muted-foreground` | `#69807A` | Eyebrow labels, idle text |
| `--border` | `#E2E7E5` | Dividers (operator theme is slightly softer than global) |
| `--success` | `#22C55E` | Running |
| `--warning` | `#F59E0B` | Preparing / caution |
| `--info` | `#3B82F6` | Info / preparing |
| `--destructive` | `#EF4444` | Stopped, End, errors |
| `--status-idle` | `#69807A` | Idle |

**Type**

- UI / labels: IBM Plex Sans (or any humanist sans)
- Identifiers, clocks, weights: IBM Plex Mono, tabular nums
- Radius: `0.5rem` default; cards `0.5–0.75rem`; pills `9999px`
- Eyebrow labels: `10px`, bold, uppercase, letter-spacing `0.14–0.16em`, muted color

**Selection:** primary at 18% mix. No dark mode.

---

## 3. App chrome (locked frame)

Every operator page sits inside this frame. The frame does not change between Orders / Live / Capture.

```
┌────────┬────────────────────────────────────────────────┬──────────┐
│        │  STATUS RAIL  (h ≈ 52px, shrink-0)             │          │
│  NAV   ├────────────────────────────────────────────────┤  ACTION  │
│  RAIL  │  [optional offline banner]                     │  RAIL    │
│        ├────────────────────────────────────────────────┤  (only   │
│  64px  │                                                │   when   │
│  fixed │              MAIN CANVAS                       │   a job  │
│  left  │              flex-1  min-h-0                   │   is     │
│        │              overflow hidden                   │   active)│
│        │                                                │  104px   │
│        │                                                │  fixed   │
│        │                                                │  right   │
└────────┴────────────────────────────────────────────────┴──────────┘
```

### Regions

| Region | Position | Size | Scroll | Z |
|---|---|---|---|---|
| Nav rail | `fixed` left, full height | **64 px** (`w-16`) | Nav items only if they overflow | 40 |
| Status rail | Top of content column | **min 52 px** | Never | 30 |
| Offline banner | Below status rail | Auto | Never | — |
| Main canvas | Remaining | `flex-1 min-h-0` | Inner children only | — |
| Action rail | `fixed` right, from below status rail to bottom | **104 px** (`w-[6.5rem]`) | Buttons if needed | 100 |
| Modals / overlays | Viewport | — | Dialog body | 90–140 |

**Content offset:** main column has `margin-left: 64px`. When the action rail is visible, the main column also has `padding-right: 104px` so nothing sits under the buttons.

**Viewport rule:** root is `h-screen overflow-hidden`. Never `min-h-screen` + body scroll for this console.

---

## 4. Left nav rail

Icon + tiny label column. Not a labelled desk sidebar.

```
┌────────┐
│  LOGO  │  36×36, centered, ~8 px pad
│  ────  │
│  [■]   │  48×48 cell
│ Orders │  8 px uppercase label under 16 px icon
│  [■]   │
│Capture │
│  [■]   │
│History │
│  [+]   │  accent-bordered “new / manual” (optional)
│        │
│   …    │  flex spacer
│        │
│ Logout │  pinned bottom, same 48×48 cell
└────────┘
```

### Spec

- Width **64 px**, `fixed inset-y-0 left-0`
- Background: `--nav` (`#163328`)
- Right border: `#0f241c`
- Padding: `12 px` vertical, `4 px` gap between items
- Each dest: **48×48 px** (`w-12 h-12`), `flex-col`, icon 16 px, label **8 px uppercase** tracking-wide
- Idle: white at 70% opacity, transparent border
- Hover: white/10 fill
- Active: white/20 fill + white/30 1 px border
- Focus ring: white/50, 1 px
- Logo block: shrink-0, ~8 px bottom margin
- Item stack: `flex-1`, column, `overflow-y-auto overflow-x-hidden`
- Logout: shrink-0, same cell size, muted (not destructive)

Do **not** put text-only rows or 200 px width here. That is the desk shell.

---

## 5. Status rail (top strip)

Single horizontal bar. Identity left, actions right. Optional second row only when a stoppage is live.

```
┌──────────────────────────────────────────────────────────────────┐
│  LINE   │ Shift A │     (flex spacer)     │ ● Idle  🔋  Wi‑Fi   │
│  6HI    │         │                       │ Sync  16:42 IST     │
│         │         │                       │ [Readings] [Stop]   │
│         │         │                       │ [ End Shift ]       │
└──────────────────────────────────────────────────────────────────┘
│  (optional)  ■  Stoppage reason — since 14:02                    │
└──────────────────────────────────────────────────────────────────┘
```

### Spec

- Height **≥ 52 px**, `shrink-0`, white bg, 1 px bottom border, light shadow
- **Left cluster** (`min-width 140 px`, right divider, `px-16`):
  - Line / station code: mono, **18 px**, semibold, primary color
  - Vertical divider then shift name: 14 px, muted
- **Optional middle cluster** (hidden on small widths): “Active Order” eyebrow + truncated mono id + 10 px status
- **Flex spacer**
- **Right cluster** (`gap-12 px`, `px-16`):
  1. Status badge (Idle / Running / STOPPED) with pulse dot
  2. Device indicators (APK only): battery % + wifi/ping, right divider
  3. Sync badge
  4. Clock: date + `HH:MM:SS IST`, mono 12 px, hidden below `lg`
  5. Optional secondary button **40 px** height (e.g. Readings)
  6. Optional destructive outline button **40 px** (Manual Stop / Manage Stop)
  7. Primary gold CTA **40 px**: icon + **END SHIFT** (uppercase, bold)

### Stoppage sub-row

Only when stopped. Full width under the bar:

- Destructive-tinted bg + top border
- Icon 16 px + one truncated line of reason + start time
- Height ~36 px, `px-16 py-8`

---

## 6. Right action rail

Production controls. Visible **only while a job is active**. Hidden on queue-only / idle screens.

```
┌──────────┐
│ JOB-ID   │  header, centered, wrap/break
├──────────┤
│          │
│  START   │  exclusive: Start OR Resume OR End
│  STOPPAGE│
│  REMARK  │
│  HOLD    │
│          │
├──────────┤
│ 00:00:00 │  timer
│ RUNNING  │  status chip
└──────────┘
```

### Spec

- Width **104 px** (`6.5rem`)
- `fixed right-0`, `top: 52px` (below status rail), `bottom: 0`
- White, left border, light shadow, z-index **100**
- **Header:** `px-6 py-8`, bottom border, mono 14 px bold, `break-all`
- **Button stack:** `flex-1`, vertically centered, `gap-8`, `px-8 py-12`, overflow-y if needed
- Each button:
  - Full width of rail
  - **min-height 80 px** (`5rem`)
  - Column: 24 px icon + 11 px bold uppercase label
  - Radius 8 px, 1 px border
- **Footer:** top border, timer + machine-status chip
  - Idle/running timer: clock icon + mono 14 px
  - Stoppage timer: “STOPPAGE” 9 px uppercase destructive + mono **18 px** destructive
  - Status chip: 11 px uppercase, full width, rounded
    - Running → primary fill
    - Stopped → destructive fill
    - Else → muted/secondary

### Button variants (visual only)

| State | Fill | Use |
|---|---|---|
| Start / Resume | Primary green, white text | Exclusive with End |
| End | Destructive red, white text | Exclusive with Start |
| Manage Stop | Destructive 10% fill, red text | Only while stoppage open |
| Hold | Accent gold | Always present when a job exists |
| Default | White + border | Stoppage (idle), Remark |

**Mutual exclusion:** show exactly one of Start / Resume / End. Never all three.

When this rail is shown, the main canvas must reserve `padding-right: 104px`.

---

## 7. Shared content atoms

Reuse these on every inner screen. Do not invent a second card language.

### 7.1 Page header (`ZPageHeader`)

```
┃  Title of this screen
┃  Shift · 12.4 / 40 MT                    [freshness]
```

- Left: **4 px** vertical accent bar (`--accent`) + title 20 px bold + optional 14 px muted subtitle
- Right: optional actions, shrink-0
- Stacks to column below `lg`; row with space-between at `lg+`
- `shrink-0`

### 7.2 Operator card (`ZOperatorCard`)

- White, 1 px border, 8 px radius, light shadow
- Optional header row: `px-16 py-12`, bottom border, eyebrow title left, actions right
- Body: `p-16` (or no padding if the child owns it)
- `flex-col min-h-0 overflow-hidden`

### 7.3 Filter pills

- Horizontal wrap, `gap-8`
- Pill: **min-height 48 px**, `px-16`, fully rounded, 12 px bold
- Idle: white, muted text, border
- Active: primary fill, white text

### 7.4 Underline tabs (when a page has 2+ views)

- `px-16`, bottom border on the bar
- Tab: `px-16 py-8`, 14 px, 2 px bottom border
- Active: primary color + primary underline
- Inactive: muted, transparent underline

### 7.5 Pill tabs (alternate)

- Enclosed capsule: white, border, `p-6`, fully rounded
- Each tab: `px-20 py-10`, min-height **44 px**, fully rounded
- Active: primary fill

### 7.6 Badge

- 10 px uppercase, tracking 0.12em, `px-8 py-2`, 2 px radius (not a pill)
- Optional 6 px pulse dot **or** 10 px tone icon
- Tone fill at 10–15% + matching border

### 7.7 Metric / fact cell

Used in PPC glance, live cards, shift summary:

```
┌─────────────────┐
│ CUSTOMER        │  10 px uppercase muted eyebrow
│ Acme Steel      │  14 px semibold (mono if id/number)
└─────────────────┘
```

- Muted/20 fill, 50% border, 8 px radius
- Compact: `p-6`; default: `p-8`
- Shift-summary variant: secondary fill, min-height **64 px**, value mono **20 px** bold

### 7.8 Error strip

- `mx-16 mt-12`, 12 px radius
- Destructive 10% fill + 30% border
- Bold title + body + optional Dismiss (12 px uppercase) on the right

### 7.9 Eyebrow

Everywhere section titles use the same voice: **10 px / bold / uppercase / wide tracking / muted**. Do not mix sentence-case section headers into this console.

---

## 8. Screen A — Queue hub (Orders)

Master–detail desk inside the canvas. Default landing after login.

```
┌─────────────────────────────────────────────────────────────────┐
┃  Queue title                          Shift · 12 / 40 MT  [●]  ┃
├─────────────────────────────────────────────────────────────────┤
│  [ All ] [ Pending ] [ In Progress ] [ Hold ] [ Completed ]     │
│  🔍 Search………………………………………                    [↻]              │
├──────────────────────────────┬──────────────────────────────────┤
│ QUEUE · 18 orders            │ ORDER DETAILS                    │
│                              │ JOB-44021                        │
│ ┌──────────────────────────┐ │                                  │
│ │ customer · line          │ │ Process   Grade                  │
│ │ JOB-44021                │ │ Width     Thickness              │
│ │ Grade · 1250 mm · 2.1 MT │ │ …                                │
│ └──────────────────────────┘ │──────────────────────────────────│
│ ┌──────────────────────────┐ │ Status          PENDING          │
│ │ …                        │ │ [ Move to Production… ]          │
│ └──────────────────────────┘ │                                  │
│ (list scrolls)               │ (detail scrolls, CTA sticky)     │
└──────────────────────────────┴──────────────────────────────────┘
```

### Vertical stack (canvas)

1. Page header — shrink-0
2. Optional error strip
3. Optional underline tabs
4. **Toolbar** — `px-16 py-12`, wrap, bottom border:
   - Search: `flex-1`, min-width 14 rem; icon inset left 12 px; input **min-height 56 px** on the desk variant
   - Filter pills (horizontal scroll if needed)
   - Optional selection tally (right)
   - Icon refresh button
5. **Body** — `flex-1 min-h-0`, `p-16`, `gap-16`

### Body split (`lg+`)

| Pane | Width | Notes |
|---|---|---|
| List (left) | `flex-1 min-w-0` | White card, header row + virtualized/scroll list |
| Detail (right) | **400 px** fixed | White card, 16 px radius |

Below `lg`: stack. Detail **on top**, max-height `min(480px, 45vh)`. List below.

### Queue list card

- Header: `px-20 py-12`, bottom border, 10 px uppercase “Queue · N orders”
- Rows: `p-12`, `gap-8` between rows
- Virtualize when **> 12** rows; estimated row height **104 px**

### Queue row

- Full-width button, left-aligned
- **min-height 88 px** (`5.5rem`)
- `px-16 py-12`, 8 px radius, 1 px border
- Idle: white; hover: card tint + primary/30 border
- Selected: primary/5 fill, primary border, 1 px primary/25 ring
- Layout:
  - Left: 10 px muted eyebrow (customer · line) → mono **16 px** bold identity → optional 11 px batch
  - Right: status badge (and optional “Combined” badge)
  - Footer line: 12 px mono metrics (`grade · width · thick · weight`)

### Detail pane

- Empty state: centered muted sentence, same card chrome
- Header: `px-16 pt-16 pb-12`, 10 px “Order Details”, identity **24 px** mono bold
- Body: 2-column definition list, `gap-x-16 gap-y-10`, scrolls
- Sticky footer: top border, secondary/30 fill, `p-16`
  - Status pill right-aligned
  - Primary CTA full width, **min-height 48 px**: “Move to Production…”
  - Optional secondary full-width above it

---

## 9. Screen B — Live status

Status overview. Same chrome. Canvas padded `p-16 gap-16` on `--secondary`.

```
Live production status
Shift · 12.4 / 40 MT

┌ Shift Summary  (metric cells, 2 / 3 / 6 columns) ───────────────┐
└─────────────────────────────────────────────────────────────────┘

┌ Current Running Order ──────┐  ┌ Upcoming Queue ───────────────┐
│ (primary green header)      │  │ (muted card header)           │
│ 2-col fact cells            │  │ 2-col fact cells              │
│ Runtime  01:12:04           │  │ next 8 ids as a short list    │
│ [ Open Production Form ]    │  │                               │
└─────────────────────────────┘  └───────────────────────────────┘

┌ Stoppage history ───────────────────────────────────────────────┐
└─────────────────────────────────────────────────────────────────┘
```

### Spec

- Title block: eyebrow (line name) → 20 px title → 14 px mono subtitle
- Shift summary: card, 6-col metric grid at `lg`, 3-col `sm`, 2-col default; each cell min-height 64 px
- Two-up grid: 1 col default, **2 col at `xl`**, `gap-16`
- **Current order card**
  - Header: **primary fill**, white text, `px-20 py-12`, eyebrow left, status badge right
  - Empty: centered copy + primary button “Go to Orders”
  - Filled: 2-col fact cells (`min-h-64`), runtime line, full-width primary button **min-height 56 px**
- **Upcoming card**
  - Header: card/muted fill, not primary; count chip on the right
  - Same fact-cell body; extra ids as a 12 px mono list, max-height 128 px

---

## 10. Screen C — Capture / production workspace

Full remaining canvas. Replaces the hub; still inside the chrome. Action rail stays on the right.

```
┌──────────────────────────────────────────────────────┐
│ PRODUCTION CONSOLE   JOB-44021   LINE    [ ✕ ]       │  h = 64 px, primary
├──────────────────────────────────────────────────────┤
│ [ status banner — green running / red stoppage ]     │
│ [ Current Order — PPC glance grid ]                  │
│ ┌ form card ───────────────────────────────────────┐ │
│ │  process-specific fields                         │ │
│ └──────────────────────────────────────────────────┘ │
│ [ optional QC panel card ]                           │
└──────────────────────────────────────────────────────┘
```

### Workspace header (green bar)

- Height **64 px**, `px-16 py-12`, primary fill, white text, `shrink-0`
- Left cluster (truncate):
  - Title “Production Console” 16 px bold
  - Identity **18 px** mono bold
  - Line chip: 10 px uppercase, white/15 pill
  - Optional “COMPLETED · Read-only” success chip
- Right: **40×40** close (X), hover white/10, does **not** log out — returns to hub

### Workspace body

- Canvas: `--secondary`
- Default: `flex-1 overflow-y-auto`, inner `p-8 gap-8` column
- Dense / lock-to-viewport variant (when the form must stay on screen): banner+PPC `shrink-0`; form card `flex-1 min-h-0`

### Status banner

Full-width rounded bar, `shrink-0`:

| State | Fill | Left | Right |
|---|---|---|---|
| Running | `--success`, white text | “Production Active” + since time | Mono timer 24–30 px |
| Stoppage | `--destructive`, white text | “Stoppage Active” + reason | Mono timer (or omit if timer lives on the action rail) |

Compact: `px-16 py-8`. Default: `px-24 py-16`. Hidden when idle.

### Current-order glance (PPC card)

- Card fill (`--card`), 12 px radius, compact `p-8`
- Header row: 10 px uppercase “Current Order” + package icon + mono identity; right chip “● Active” (success tint)
- Grid: **2 col**, **3 col from `sm`**, compact gap 6 px
- Each cell = metric cell from §7.7

### Form card

- White/card, 12 px radius, border, shadow, `overflow-hidden`
- Completed: 70% opacity, read-only
- Fields are **out of scope** for this spec — swap the inner body per process / product. Keep the card chrome.

### QC panel (optional, below form)

Same card language. Not present on every line.

---

## 11. Overlay patterns

All overlays sit **above** the action rail except the capture workspace itself (which *is* the canvas).

| Overlay | Z | Geometry |
|---|---|---|
| Dim scrim | 90 | `inset-0`, primary at 40–50% |
| Full-bleed workspace (mill variant) | 95 | `inset-y-0 left-64px right-0` (does not cover nav rail) |
| Centered dialog | 50–140 | Centered, `p-16` viewport pad, width `max-w-lg`–`max-w-xl` |
| Defect / crew panel | 140 | Centered card, `max-w-xl`, 20 px radius, white, shadow-2xl |
| Toast / action error | 105 | `top-80px`, horizontally centered, `max-w-lg` |
| Combine / multi-select dock | 90 | Fixed **bottom center**, dark pill, `bottom-24` |

### Centered dialog anatomy

```
┌─────────────────────────────────────┐
│ Title                         Close │
│ subtitle                            │
│─────────────────────────────────────│
│  body (scroll if > 90vh)            │
│─────────────────────────────────────│
│              [Cancel]  [Confirm]    │  equal flex buttons
└─────────────────────────────────────┘
```

- White, 12–16 px radius
- Header: 10 px uppercase muted eyebrow + 18 px title
- Footer: two equal `flex-1` buttons
- Scrim click closes unless the flow is blocking (stoppage / end-job)

### Full-bleed workspace (alternate to in-canvas capture)

Used when capture is a modal over the hub instead of a route:

- Scrim behind
- Panel starts at `left: 64px` (nav stays visible)
- Same 64 px green “Production Console” header as §10
- Action rail docks on the **right edge of this panel**, not over the scrim

---

## 12. Login (pre-chrome)

Not the operator frame. Different but same tokens.

```
┌──────────────────────────────────────────────┐  nav-green strip, 12 px py
│  BRAND          Operator Console     16:42   │
└──────────────────────────────────────────────┘
                   ┌─────────────────────┐
                   │ Terminal unlock     │  max-width 24 rem
                   │ badge / PIN fields  │
                   │ [ Sign in ]         │
                   └─────────────────────┘
```

- Full viewport, secondary canvas
- Card centered, white, 8 px radius
- Header inside card: bottom border, 16 px title, 12 px muted subtitle

---

## 13. Overflow, scroll, and hit-target rules

Copy these exactly or the tablet will feel “wrong.”

1. **Outer shell never scrolls.** Only: queue list, detail body, capture form, live page column, nav overflow, action-rail overflow.
2. Every scroll parent needs `min-h-0` (flex children otherwise refuse to shrink).
3. Minimum tap target **44 px**. Prefer **48–56 px** on pills, search, CTAs. Action-rail buttons are **80 px**.
4. Primary capture CTA **56 px**. Detail “Move to Production” **48 px**. Status-rail buttons **40 px**.
5. Identifiers (job / coil / batch) always **mono + truncate** with `title` tooltip.
6. Numbers always **tabular-nums**.
7. No page-level horizontal scroll. Toolbars may scroll pills horizontally.
8. Landscape assumed. Below `lg` the hub stacks (detail above list). Below `sm` PPC grid is 2-col. Do not design a portrait operator chrome.

---

## 14. Z-index stack

| Layer | Z |
|---|---|
| Status rail | 30 |
| Nav rail | 40 |
| Combine dock / workspace scrim | 90 |
| Full-bleed workspace | 95 |
| Action rail | 100 |
| Start-conflict / action error toast | 105 |
| Defect / crew / blocking panels | 140 |

Keep action rail **under** blocking dialogs so operators cannot Start/End through a modal.

---

## 15. Color-by-state (layout cues)

| Machine / job state | Where it shows |
|---|---|
| Idle | Status-rail muted badge; action-rail muted chip |
| Running | Green badge + pulse; green status banner; primary chip on action rail |
| Stoppage | Red/destructive badge “STOPPED”; red banner; red timer; optional red sub-row on status rail |
| Preparing | Info-blue badge |
| Hold / reject | Accent or destructive badge |
| Completed | Muted badge; capture card at 70% opacity |

Do not use a fourth green. Primary `#163328` is **chrome**. Success `#22C55E` is **running**.

---

## 16. What to copy vs. what to replace

**Copy as-is (layout contract)**

- 64 / 52 / 104 px chrome sizes
- Locked `h-screen` frame
- Icon nav, not labelled sidebar
- Green 64 px workspace header
- 400 px detail pane + 88 px queue rows
- 80 px action buttons, exclusive Start/Resume/End
- Token set, eyebrow voice, metric cells
- Overlay z-stack

**Replace per product**

- Nav destinations (Orders / Capture / History are examples)
- Queue row identity fields
- Capture form body
- Status-rail extra buttons
- Filter names
- Shift-summary metrics

**Do not copy**

- 200 px desk sidebar
- Sticky desk header with breadcrumbs
- Dark-mode inversions
- Dense data-tables as the operator queue (rows are large tap cards)

---

## 17. Implementation checklist for another codebase

- [ ] Root: `h-screen overflow-hidden`, theme class on the root
- [ ] Fixed 64 px left nav, content `margin-left: 64px`
- [ ] Status rail 52 px, never wraps to a hamburger
- [ ] Main is `flex-1 min-h-0 overflow-hidden`
- [ ] Action rail 104 px, `top: 52px`, only when a job is active; content `padding-right: 104px`
- [ ] Hub: toolbar + list/detail split 1fr / 400 px
- [ ] Capture: 64 px green header + banner + glance grid + form card
- [ ] All section labels 10 px uppercase muted
- [ ] IDs and clocks in mono tabular
- [ ] Tap targets ≥ 44 px (rails 48–80 px)
- [ ] Modals above the action rail
