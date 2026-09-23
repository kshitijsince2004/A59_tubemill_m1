# Industrial MES — UI & UX Software Reference

> **Purpose:** Explain the **UI and UX of the whole software** so another industrial project of the same type (plant MES / production console) can reuse the interaction model, layout system, and visual rules without copying brand-specific product names.
>
> **Rule of truth:** Patterns below are what this codebase actually implements. Gaps are marked `PARTIALLY IMPLEMENTED` or `NOT IMPLEMENTED`.
>
> **Companion docs in this repo:**
> - Architecture / RBAC: [`docs/ADMIN_RBAC_PLANT_OPERATIONS.md`](./ADMIN_RBAC_PLANT_OPERATIONS.md)
> - Brand tokens: [`doc/BRAND_GUIDELINES.md`](../doc/BRAND_GUIDELINES.md)
> - Short UI rules: [`doc/UI_UX_GUIDELINES.md`](../doc/UI_UX_GUIDELINES.md)
> - Operator spatial spec: [`doc/OPERATOR_SCREEN_LAYOUT.md`](../doc/OPERATOR_SCREEN_LAYOUT.md)
>
> **Token source of truth:** `packages/client/src/index.css`  
> **No application code was changed** for this document.

---

## Table of contents

1. [Product UX thesis](#1-product-ux-thesis)
2. [Two chrome families](#2-two-chrome-families)
3. [Visual design system](#3-visual-design-system)
4. [Surfaces by job](#4-surfaces-by-job)
5. [Operator (floor) UX](#5-operator-floor-ux)
6. [Desk UX — Machine Head](#6-desk-ux--machine-head)
7. [Desk UX — Plant Command Center](#7-desk-ux--plant-command-center)
8. [Desk UX — Admin](#8-desk-ux--admin)
9. [Desk UX — Quality & Planner](#9-desk-ux--quality--planner)
10. [Authentication & first-run UX](#10-authentication--first-run-ux)
11. [Named layouts & interaction patterns](#11-named-layouts--interaction-patterns)
12. [Component / primitive map](#12-component--primitive-map)
13. [Data display grammar](#13-data-display-grammar)
14. [Status, feedback & motion](#14-status-feedback--motion)
15. [Forms, validation & blockers](#15-forms-validation--blockers)
16. [Live data & refresh UX](#16-live-data--refresh-ux)
17. [Offline, sync & APK](#17-offline-sync--apk)
18. [Responsive & device assumptions](#18-responsive--device-assumptions)
19. [Accessibility & industrial ergonomics](#19-accessibility--industrial-ergonomics)
20. [Anti-patterns (ban list)](#20-anti-patterns-ban-list)
21. [How to reuse this UX on another project](#21-how-to-reuse-this-ux-on-another-project)
22. [Implementation status](#22-implementation-status)
23. [Source index](#23-source-index)

---

## 1. Product UX thesis

This software is a **production console** for industrial plants: calm, dense, and precise under pressure.

| Attribute | UX implication |
|-----------|----------------|
| Personality | Technical-clean, high trust, industrial — not marketing SaaS |
| Density | Cockpit-dense: information first, decoration never |
| One product, one look | Surfaces differ by **job and density**, not by palette |
| Canonical visual | Rolling-mill / CRM operator capture is the frozen reference |
| Process stations | Inherit the same shell and patterns (do not invent a second brand) |
| Light only | Dark mode is explicitly out of scope |

**One-line identity:** deep industrial green authority + steel-gold caution + monospace precision.

### What users feel when it works

1. **Operators** always know machine, shift, sync state, and the next critical action (START / STOPPAGE / HOLD) without hunting menus.
2. **Machine Heads** scan live boards and queues quickly; assignment and review stay desk-efficient.
3. **Plant Heads** see plant health as KPI strips + live merge, then drill into orders/defects/downtime.
4. **Admins** configure master data and access in quiet, table-oriented panels — not flashy dashboards.

---

## 2. Two chrome families

The whole product uses **exactly two** chrome systems. Do not invent a third for a new plant.

```text
┌─────────────────────────────────────────────────────────────┐
│  FLOOR / OPERATOR (kiosk tablet)                            │
│  64px icon rail │ status strip │ canvas │ optional 104px    │
│                 │              │        │ action rail       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DESK (Plant / Machine Head / Admin / Quality)              │
│  200px labelled sidebar │ white top rail │ scrolling main   │
└─────────────────────────────────────────────────────────────┘
```

| Family | Users | Nav | Top | Scroll model |
|--------|-------|-----|-----|--------------|
| **Floor kiosk** | Operators (APK / tablet) | 64 px icon + tiny label | Status strip (~52 px) | Outer `h-screen` locked; **inner panes** scroll |
| **Desk** | MH, Plant, Admin, Quality, Planner | 200 px labelled sidebar | White sticky top rail (~52 px) | `min-h-screen`; main column scrolls |

**Locked rule:** Desk surfaces keep a **white top bar**. Deep green stays on the **left rail** and on primary buttons / capture headers — never a full-width dark green header on desk.

---

## 3. Visual design system

### 3.1 Color tokens (reuse these roles even if hex changes)

| Role | Example hex | CSS tokens | Use |
|------|-------------|------------|-----|
| Primary / nav | `#163328` | `--color-primary`, `--color-nav` | Left rail, primary CTAs, active filters, capture header |
| On primary | `#FFFFFF` | `--color-*-foreground` | Text/icons on green |
| Accent / caution | `#F1B824` | `--color-accent` | **Only** END SHIFT, HOLD, PENDING-class status |
| Canvas | `#FFFFFF` | `--color-background` | App background |
| Card / muted | `#F4F6F5` | `--color-card`, `--color-muted` | Panels, secondary fills |
| Body text | `#163328` | `--color-foreground` | Titles and values |
| Labels | `#69807A` | `--color-muted-foreground` | Uppercase field labels |
| Border | `#C5CEC9` | `--color-border` | Dividers (operator theme softens slightly) |
| Success | `#22C55E` | `--color-success` / `--color-status-running` | Running, synced |
| Warning | `#F59E0B` | `--color-warning` / `--color-status-stopped` | Caution / stopped energy |
| Info | `#3B82F6` | `--color-info` / `--color-status-setup` | Preparing / informational |
| Danger | `#EF4444` | `--color-destructive` / `--color-status-reject` | Stop, reject, backlog urgency |
| Idle | `#69807A` | `--color-status-idle` | Idle |
| Chart purple | `#8B5CF6` | `--color-purple` | Rare chart series **only** — never brand chrome |

**Accent rule (locked):** steel gold is **not** a general highlight color. Save / Start / active filters stay **primary green**.

### 3.2 Typography

| Role | Family | Rule |
|------|--------|------|
| UI chrome, buttons, body | IBM Plex Sans (`--font-sans`) | Humanist sans; no Inter/Roboto as brand |
| IDs, weights, mm, clocks | IBM Plex Mono (`--font-mono`) | Always mono for technical data |
| Field labels | Sans, ~10 px, bold, uppercase, wide tracking | Muted color |
| Values | Semibold/bold foreground | High contrast |

### 3.3 Spacing, radius, elevation

| Rule | Value |
|------|-------|
| Grid | 8 px |
| Card padding | ≥ 16 px |
| Radius | `0.5rem` default; pills `9999px` |
| Desk content pad | `p-4 md:p-5` |
| Cards | `z-card` utility — light border, subtle elevation |
| Motion | Short fade / slide only; live pulse dot allowed |

### 3.4 Tech stack for styling

| Item | Status |
|------|--------|
| Tailwind CSS v4 `@theme inline` in `index.css` | `IMPLEMENTED` |
| Classic `tailwind.config.js` | `NOT IMPLEMENTED` |
| Separate design-tokens JSON package | `NOT IMPLEMENTED` |
| Dark mode | `NOT IMPLEMENTED` (forbidden) |

---

## 4. Surfaces by job

| Surface | Generic industrial job | Chrome | Density | Primary layouts |
|---------|------------------------|--------|---------|-----------------|
| Operator console | Machine operator | Floor kiosk | Highest (glove) | Hub queue + Capture + Action rail |
| Machine Head desk | Area / line supervisor | Desk 200 px | High | Live boards, tables, assignment, shift review |
| Plant Command Center | Plant supervisor | Desk 200 px | Medium–high | KPI strip, charts, drawers, live merge |
| Admin | Platform / plant admin | Desk 200 px | Medium–high | Forms, master tables, config panels |
| Quality | Spec owner | Desk 200 px | Medium | Spec list / editor |
| Planner | Production planner | Desk (thin) | Medium | Import hub |

**Principle:** same tokens everywhere; only **hit-target size**, **nav width**, and **information density** change.

---

## 5. Operator (floor) UX

### 5.1 Target device

| Constraint | Value |
|------------|-------|
| Device | Landscape industrial tablet / Android APK WebView |
| Orientation | Landscape-first |
| Browser chrome | Hidden (kiosk) |
| Interaction | Finger / glove |
| Viewport | `h-screen overflow-hidden` — outer shell never scrolls |

### 5.2 Locked frame

```text
┌────────┬────────────────────────────────────┬──────────┐
│        │  STATUS RAIL  (~52 px)             │          │
│  NAV   ├────────────────────────────────────┤  ACTION  │
│  64px  │  [optional offline banner]         │  RAIL    │
│  green │                                    │  104px   │
│  icons │         MAIN CANVAS                │  (when   │
│        │         (inner scroll only)        │   job    │
│ Logout │                                    │   active)│
└────────┴────────────────────────────────────┴──────────┘
```

| Region | Size | Role |
|--------|------|------|
| Left nav rail | 64 px | Orders / Capture / History (+ line extras); Logout pinned bottom |
| Status rail | ≥ 52 px | Identity, sync, device indicators, MANUAL STOP, END SHIFT |
| Offline banner | Auto | Connectivity warning under status |
| Main canvas | Flex fill | Hub list, capture form, history |
| Action rail | 104 px right | START / STOPPAGE / REMARK / HOLD — critical process controls |

**Content offset:** `margin-left: 64px`; when action rail visible, `padding-right: 104px`.

Files: `OperatorShell.tsx`, `OperatorNavRail.tsx`, `StatusRail.tsx`, `ProcessLayout.tsx`, `ProductionActionRail`.

### 5.3 Hub / queue UX (named layout)

```text
[ green icon rail ] [ search + filter pills ]
                    [ grouped list: BACKLOG / PENDING / IN PROGRESS / … ]
                    [ right detail card + primary outline action ]
```

UX rules:

- Filter pills: **active** = primary green + white text; **idle** = white + border + muted
- Queue groups: tinted section headers (e.g. backlog soft red wash)
- Rows: mono for IDs/measures; status as colored pill (never color-only)
- Master–detail: select row → detail panel; primary action opens capture
- Virtualized long lists where needed (`VirtualizedList`)

References: `ProcessHub.tsx`, SixHi hub (canonical), `ZFilterPills`.

### 5.4 Capture / production console UX (named layout)

```text
[ process header: green bar + status pill + ORDER DETAILS ]
[ Current Order meta grid — label above, value below ]
[ Production fields + variance helpers ]
[ Sub-sections (passes, slits, charts…) ]
[ full-width primary: Save Production Data ]
[ right action rail: START | STOPPAGE | REMARK | HOLD ]
```

UX rules:

1. Critical controls live on the **right rail**, never buried in overflow menus.
2. Machine/order status visible in header (and preferably rail).
3. Validation blockers show **inline under fields**, not toast-only.
4. Sync / offline always visible on this surface.
5. Save is primary green; END SHIFT is gold on the status rail; MANUAL STOP is danger outline.

References: `CaptureWorkspace.tsx`, process bodies under `components/process/bodies/`, CRM SixHi capture (frozen reference).

### 5.5 Operator navigation IA

Typical items (line-dependent extras exist for ANN etc.):

| Nav id | Purpose |
|--------|---------|
| Orders / Hub | Queue and select work |
| Capture | Active production form |
| History | Recent completed work |
| Logout | Confirm modal, then sign out |

**Bottom tab bar:** `NOT IMPLEMENTED` — do not add a phone-style bottom nav unless deliberately redesigning for portrait phones.

### 5.6 Operator journey (UX)

```text
Badge + PIN login
  → User-scope home for assigned machine
  → Hub: filter / search / pick order
  → Start (action rail)
  → Capture fields + optional stoppage / defect / crew
  → Save
  → Hold / handover / end shift as needed
```

---

## 6. Desk UX — Machine Head

### 6.1 Chrome

- Shell: `MachineHeadShell.tsx`
- Nav: `MachineHeadNav.tsx` via `DeskSideNav` (200 px)
- Nav items are **capability-filtered** by assigned lines (`mhLineCapabilities.ts`)
- Optional line-scoped Import items; Supervisor sees a reduced subset

### 6.2 Typical MH information architecture

| Area | UX intent |
|------|-----------|
| Live / home | Scan machine tiles and active orders |
| Order assignment | Dense boards to move plan → machine |
| Crew | Roster maintenance (names/roles on machine) |
| Shift review | Approve / inspect shift outcomes |
| Import / specs / export / traceability | Line-dependent tools |

### 6.3 Desk visual patterns for MH

- Page header inside a light `z-card` band
- Dense tables and live status tiles
- Drawers/modals for order detail (bespoke, not a shared Dialog kit)
- Polling ~15–30 s for live views
- Smaller hit targets than floor (`md:` button heights) — mouse/keyboard first

### 6.4 MH journey (UX)

```text
Login → Machine Head dashboard / live
  → Pick line capability from sidebar
  → Monitor live → assign orders → review shift → export
```

---

## 7. Desk UX — Plant Command Center

### 7.1 Chrome

- Shell: `UnifiedShell.tsx` (“Plant Command Center”)
- Sidebar items (implemented): Dashboard, Live Operations, Traceability, Defect Intelligence, Downtime Intelligence, Alerts & Ops Feed, Production, Export, Device Setup, Audit Logs, Users
- Top: `UnifiedHeader` + `OfflineBanner`

### 7.2 Dashboard composition (UX)

Plant home is an **operations command** surface, not a marketing homepage:

| Region | UX role |
|--------|---------|
| Window selector (1/7/30/90 d) | Time scope for KPI intelligence |
| KPI strip | Today MT, OEE, Availability / Performance / Quality + trends |
| Main ops area | Live machines / production vs plan style boards |
| Quality + downtime cards | Pareto / drivers |
| Ops feed / drawers | Backlog, rejected orders, machine/order detail modals |
| Export affordances | Rejected orders / DPR entry points |

Components: `PlantHeadDashboard.tsx`, `PlantKpiStrip`, `PlantOperationsArea`, `PlantMainOpsArea`, `BacklogDetailDrawer`, etc.

### 7.3 Plant UX principles

1. **Monitor first** — Plant Head is largely read-oriented on shop-floor writes.
2. **Drill, don’t dump** — KPI → drawer/modal → order detail.
3. **Live merge** — reported KPIs overlay with live snapshot so the board feels current.
4. **Same desk chrome** as Admin/MH so role switching does not retrain muscle memory.

### 7.4 Plant journey (UX)

```text
Login → /plant
  → Scan KPI strip + live machines
  → Open backlog / rejected / machine detail
  → Navigate Defect / Downtime / Production intel
  → Export DPR or history
  → Users / Audit when needed
```

---

## 8. Desk UX — Admin

### 8.1 Chrome

- Shell: `AdminShell` + `AdminNav` + `AdminRail` (`DeskTopRail`)
- Brand: “ADMIN / System configuration”
- Rail IA: Master Data, Planning, Users, Audit Trail, System, Validation Rules
- Off-rail but important: Machines, Machine Assignment, Machine Specs, ANN Specs

### 8.2 Admin page UX pattern

Consistent **panel grammar**:

```text
[ AdminShell ]
  [ Page title / actions (Refresh, Add) ]
  [ AdminPanel cards ]
      [ Eyebrow label ]
      [ Table or form ]
      [ Inline error strip ]
```

Characteristics:

- Quiet tables and forms — configuration density, not KPI theatre
- Primary actions: create/edit/save with `ZButton`
- Status via `StatusBadge` on machines/users
- No dedicated Admin “executive dashboard” home — lands on Master Data

### 8.3 Admin journey (UX)

```text
Login → Master Data
  → Machines / Users / Machine Assignment
  → Planning upload when needed
  → System (shift windows, health)
  → Validation rules / Audit
```

---

## 9. Desk UX — Quality & Planner

| Role | Chrome | Home UX |
|------|--------|---------|
| Quality | `QualityShell` + `QualityNav` | Spec list → editor; careful form density |
| Planner | Thin role surface | Planning import hub (`/planning/import`) |

Same desk tokens; fewer navigational destinations than Plant/MH.

---

## 10. Authentication & first-run UX

### 10.1 Login screen

| Mode | UX |
|------|----|
| Operator | Badge / emp code + 4-digit PIN (large targets) |
| Staff | Email + password (SuperTokens) |
| Session expired | Message via `?session=expired` |

### 10.2 Post-login landing (role homes)

| Role | Lands on |
|------|----------|
| Operator | User-scope workspace / primary machine |
| Machine Head | Machine Head dashboard |
| Plant Head | Plant dashboard |
| Admin | Admin Master Data |
| Supervisor | Live (partial role) |
| Planner | Planning import |
| Quality | Quality specs |

### 10.3 Session UX

| Event | UX |
|-------|----|
| Idle lock (~2 h) | PIN unlock overlay (not full logout) |
| 401 after refresh fail | Logout → login with expired message |
| Access denied | Dedicated Access Denied card with return-home (`RoleRoute`) |
| Logout | Confirm modal on desk nav |

---

## 11. Named layouts & interaction patterns

Use these names when briefing designers/engineers on a sibling project.

### A. Hub / Queue

Master–detail queue with filter pills and grouped status sections.

### B. Capture / Production Console

Process header + meta grid + fields + primary save + **right action rail**.

### C. Desk Tool Page

200 px sidebar + white top rail + titled main + `z-card` panels/tables.

### D. Command Dashboard

KPI strip + multi-panel ops (plant) with drawers for detail.

### E. Live Board

Machine status tiles/cards + order lists + polling refresh.

### F. Assignment Board

Tabular / board UI to assign planned work to machines.

### G. Config CRUD

AdminPanel list → create/edit form → save → refresh list.

### H. Export / Report

Scope pickers (date, shift, line) → start job → progress modal → download.

### Shared interaction rules

| Pattern | Rule |
|---------|------|
| Critical process actions | Always visible rail or sticky strip |
| Status | Colored pill **with label** (not color alone) |
| Destructive | Outline or solid danger; confirm when irreversible |
| Secondary | Ghost / outline buttons |
| Gold accent | END SHIFT / HOLD / PENDING only |
| Lists | Prefer virtualization when hundreds of rows |
| Detail | Drawer or modal — keep list context |

---

## 12. Component / primitive map

Prefer shared primitives over one-off styled controls.

| Pattern | Spec | Code |
|---------|------|------|
| Primary button | Green fill, white text | `ZButton variant="primary"` |
| Secondary / ghost | White + border | `ZButton` secondary/ghost/outline |
| Danger | Red border/text or danger variant | MANUAL STOP, reject |
| Accent (gold CTA) | Solid gold | Prefer `bg-accent` on END SHIFT (`StatusRail`); note: `ZButton` `accent` is outline-like — `PARTIALLY` aligned |
| Inputs | Clear border; glove `h-14` | `ZInput` |
| Status pills | Soft bg + strong text | `ZBadge`, `StatusBadge` |
| Filter pills | Active green / idle bordered | `ZFilterPills` |
| Page header (operator) | Compact title chrome | `ZPageHeader` |
| Admin panel | Bordered card + rail label | `AdminPanel` |
| Desk nav / top | Shared chrome | `DeskSideNav`, `DeskTopRail` |
| Sync badge | Always on floor | `SyncStatusBadge` |
| Offline banner | Below top chrome | `OfflineBanner` |
| Route loading | Muted “Loading…” | `RouteSpinner` |

**Shared Dialog/Drawer design system:** `PARTIALLY IMPLEMENTED` — many bespoke modals/drawers exist; no single headless Dialog kit.

**Toast library:** `NOT IMPLEMENTED` — prefer inline errors and banners.

---

## 13. Data display grammar

| Data type | Display |
|-----------|---------|
| Coil / batch / machine codes | `font-mono` |
| Dimensions / weights | Mono + unit (`mm`, `MT`) |
| Timestamps / clocks | Mono, plant timezone (IST in this product) |
| Field labels | Uppercase muted sans |
| Titles | Bold sans |
| Status | Pill with text + tone |
| KPI numbers | Large, high contrast; trend deltas adjacent |
| Empty | Calm message in panel (`DataUnavailable` on plant; ad hoc elsewhere) |

**Units always visible** next to numeric production fields.

---

## 14. Status, feedback & motion

### Status → tone mapping (UX)

| Operational meaning | Tone |
|---------------------|------|
| Running / synced / healthy | Success green |
| Preparing / informational active | Info blue |
| Pending / hold caution | Accent gold / warning amber |
| Stopped / warn | Warning |
| Reject / manual stop / backlog urgency | Destructive red |
| Idle / inactive | Muted idle |

### Feedback channels

| Channel | Use |
|---------|-----|
| Inline field errors | Capture blockers, form validation |
| Error strips on panels | Page-level load/save failures |
| Offline banner | Network down |
| Sync badge | Outbox / sync state |
| Access Denied card | RBAC failure |
| Progress modal | Long exports |
| Toast popups | `NOT IMPLEMENTED` — do not rely on them |

### Motion

- Fade/slide for panels entering
- Pulse dot for live indicators
- No decorative parallax / marketing motion on floor

---

## 15. Forms, validation & blockers

| Concern | UX behavior |
|---------|-------------|
| Shop-floor forms | Large inputs; glove mode increases height |
| Numeric capture | Dedicated numeric helpers / keyboard focus behavior on tablet |
| Validation | Shared schemas + configurable admin rules |
| Blockers | Show **next to the field**; keep Save disabled or explain why |
| Crew / stoppage / defects | Sub-panels or modals attached to active order |
| Confirmations | Logout, destructive ends, some overrides |

Glove support: `useGloveModeStore` / glove-aware classes on `ZButton` / `ZInput`.

---

## 16. Live data & refresh UX

| Surface | Typical refresh | UX note |
|---------|-----------------|---------|
| Operator hub / capture | ~15 s (network-aware) | Silent refresh; avoid full-page flicker |
| Plant live merge | Poll live snapshot | Fingerprint-based quiet updates where implemented |
| MH live boards | ~15–30 s intervals | Status tiles update in place |
| Manual Refresh | Visible buttons on dashboards | User-controlled catch-up |

Users should never wonder if the board is stale — show `refreshedAt` / sync state when available.

---

## 17. Offline, sync & APK

| Capability | Status | UX |
|------------|--------|-----|
| Offline banner | `IMPLEMENTED` | Persistent strip when offline |
| Sync status badge | `IMPLEMENTED` | Operator chrome |
| Outbox / queue writes | `IMPLEMENTED` | Capture continues; sync later |
| Operator SQLite assist | `IMPLEMENTED` (APK path) | Transparent to user |
| Capacitor Android APK | `IMPLEMENTED` | Operator-only build; kiosk guidance in M1-10 |
| Push notifications | `NOT IMPLEMENTED` | — |

**Floor UX contract:** connectivity must be visible at all times on operator surfaces.

---

## 18. Responsive & device assumptions

| Assumption | Reality |
|------------|---------|
| Operator | Landscape tablet / APK; locked viewport; `user-scalable=no` on operator HTML |
| Desk | Laptop/desktop first; `md:` / `lg:` tighten padding and reveal clocks |
| Phone portrait operator | `NOT IMPLEMENTED` |
| Bottom navigation | `NOT IMPLEMENTED` |
| Hybrid responsive redesign of desk ↔ floor | Not done — **two separate chrome families** |

When porting to another project: decide early whether floor is **kiosk landscape only** (recommended for glove MES) or true responsive phone.

---

## 19. Accessibility & industrial ergonomics

| Practice | Implementation notes |
|----------|----------------------|
| Large hit targets on floor | ≥ 44–56 px preferred; rail buttons often taller (`min-h` ~5 rem on action rail) |
| Focus rings | Token `--color-ring`; nav items have `focus-visible` styles |
| Color + text | Status always labeled |
| Confirm destructive | Logout modal; careful stop/end actions |
| Screen reader labels | `aria-label` / `aria-current` on nav |
| Contrast | Dark green on white / white on green — industrial high contrast |
| Full WCAG audit kit | `PARTIALLY` — patterns exist; no dedicated a11y test suite called out as complete |

Industrial ergonomics beat consumer polish: **reach, glove, glanceability, and irreversible-action safety** win over animation and whitespace luxury.

---

## 20. Anti-patterns (ban list)

Do **not** do these when cloning the UX to another plant project:

1. Purple / indigo marketing gradients as brand
2. Gold Save / Start buttons
3. Dark theme “operator night mode” without a full redesign program
4. Card overload in headers
5. Decorative icon rows with no action
6. One-off hex colors outside the token table
7. Redesigning the canonical capture reference while other screens diverge
8. Inter / Roboto / system UI as the primary product brand font
9. Hiding START / STOPPAGE / HOLD inside meatball menus on the floor
10. Toast-only validation on capture
11. Mixing a third chrome family (e.g. top-only mobile app chrome) without documenting a deliberate exception
12. Phone-style bottom tabs on a landscape glove kiosk without redesigning hit geometry

---

## 21. How to reuse this UX on another project

### Step 1 — Keep the two chrome families

Copy the **spatial contracts** (64/52/104 floor; 200/52 desk), not necessarily the hex values.

### Step 2 — Remap roles to surfaces

| Generic role | Surface |
|--------------|---------|
| Operator | Floor kiosk |
| Area supervisor / Machine Head | Desk + live boards |
| Plant supervisor | Command dashboard desk |
| Admin | Config CRUD desk |
| Quality / Planner | Thin desk tools |

### Step 3 — Keep named layouts

Implement Hub, Capture+Rail, Desk Tool, Command Dashboard, Live Board, Assignment, Config CRUD, Export — even if process names change (steelmaking, rolling, finishing, etc.).

### Step 4 — Preserve interaction grammar

- Critical actions on rail
- Status pills with labels
- Mono for IDs/measures
- Inline validation
- Visible sync on floor
- Gold only for caution CTAs

### Step 5 — Replace domain language, not structure

| This product example | Sibling project example |
|----------------------|-------------------------|
| Coil / batch | Heat / slab / lot / bundle |
| MT / mm | t / kg / °C as needed — keep mono + units |
| Process codes HRS/PKL/… | Shop codes (SM, RM, FIN…) |
| DPR export | Daily production report |

### Step 6 — Decide gaps intentionally

| Gap in this product | Recommendation for sibling |
|---------------------|----------------------------|
| No toast system | Add only if inline errors are insufficient |
| No shared Dialog kit | Introduce one early to reduce bespoke modals |
| No area dashboard chrome | Add desk “area” home if multi-shop KPIs need a middle layer |
| No PLC alarm UX | Design alarm strip separately from stoppage forms |
| No dark mode | Keep light unless control-room night shift demands it |

### Portable wireframe kit (ASCII)

**Floor**

```text
[Nav][ Status: Machine · Shift · Sync · STOP · END ]
[64 ][ Hub filters · queue · detail                  ][START]
[   ][                                               ][STOP ]
[   ][                                               ][HOLD ]
```

**Desk**

```text
[ 200 Sidebar ][ Top: title · sync · clock ]
[ Brand       ][ Main: KPI / table / form  ]
[ Nav items   ][                           ]
[ Logout      ][                           ]
```

---

## 22. Implementation status

| UX module | Status | Notes |
|-----------|--------|-------|
| Design tokens in CSS | `IMPLEMENTED` | `index.css` `@theme` |
| Brand accent rules | `IMPLEMENTED` | Documented + mostly enforced |
| Operator kiosk chrome | `IMPLEMENTED` | Shell + rails |
| Hub + Capture layouts | `IMPLEMENTED` | Process + CRM canonical |
| Desk chrome (Admin/Plant/MH/Quality) | `IMPLEMENTED` | Shared `DeskSideNav` |
| Plant command dashboard | `IMPLEMENTED` | KPI + live merge |
| MH capability nav | `IMPLEMENTED` | Line-filtered |
| Offline / sync UX | `IMPLEMENTED` | Banner + badge + outbox |
| Glove mode | `IMPLEMENTED` | Store + control heights |
| Shared Dialog/Drawer kit | `PARTIALLY IMPLEMENTED` | Many custom overlays |
| Global EmptyState / Toast | `NOT IMPLEMENTED` / partial | Inline patterns instead |
| Dark mode | `NOT IMPLEMENTED` | Forbidden by guidelines |
| Portrait phone operator | `NOT IMPLEMENTED` | |
| Bottom navigation | `NOT IMPLEMENTED` | |
| Dedicated Admin KPI home | `NOT IMPLEMENTED` | Lands on Master Data |
| Area-level dashboard chrome | `NOT IMPLEMENTED` | Line UIs only |

---

## 23. Source index

| Topic | Path |
|-------|------|
| Tokens | `packages/client/src/index.css` |
| Brand | `doc/BRAND_GUIDELINES.md` |
| Short UI rules | `doc/UI_UX_GUIDELINES.md` |
| Operator layout (portable) | `doc/OPERATOR_SCREEN_LAYOUT.md` |
| APK / offline | `doc/M1-10_Operator_APK_Conversion.md` |
| Shell architecture notes | `doc/design.md` |
| Operator shell | `packages/client/src/components/layout/operator/*` |
| Desk nav | `packages/client/src/components/layout/shared/DeskSideNav.tsx` |
| Plant shell | `packages/client/src/components/layout/UnifiedShell.tsx` |
| MH shell / nav | `packages/client/src/components/layout/machinehead/*` |
| Admin shell / nav | `packages/client/src/components/layout/admin/*` |
| Process hub / capture | `packages/client/src/components/process/ProcessHub.tsx`, `CaptureWorkspace.tsx`, `ProcessLayout.tsx` |
| Primitives | `packages/client/src/components/primitives/*` |
| Operator UI atoms | `packages/client/src/components/ui/operator/*` |
| Plant KPI | `packages/client/src/components/plant-head/*` |
| Role homes | `packages/client/src/lib/roleHome.ts` |
| Routes | `packages/client/src/App.tsx` |

---

## Consistency checklist (for sibling projects)

Before shipping a screen on a new industrial MES using this reference:

- [ ] Uses only the agreed token roles (primary / accent / status)
- [ ] Uses shared buttons/inputs/badges where possible
- [ ] Technical data is monospace with units
- [ ] Matches a named layout (Hub, Capture, Desk Tool, Command, Live, Assignment, Config, Export)
- [ ] White top bar + green left rail on desk; kiosk rails on floor
- [ ] Gold only for END SHIFT / HOLD / PENDING-class caution
- [ ] Floor hit targets glove-safe; critical actions on the action rail
- [ ] Offline/sync visible on floor
- [ ] Validation inline — not toast-only
- [ ] No third chrome family without an explicit exception note

---

*End of UI/UX software reference.*
