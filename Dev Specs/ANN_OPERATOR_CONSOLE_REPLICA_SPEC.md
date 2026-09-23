# Annealing Operator Console — Exact Replica Spec

> **Purpose:** Build an **exact functional and visual replica** of the Annealing (ANN) operator console in a different codebase.
>
> **Scope:** Floor / tablet **operator** UX for annealing only.  
> **Out of scope:** Machine Head ANN desk (`/machine-head/ann/*`), Admin ANN specs, Planner imports (except how batches feed the operator).
>
> **Source of truth in this repo:**
> - Shell: `packages/client/src/components/layout/operator/*`, `ProcessLayout.tsx`
> - Hub: `ProcessHub.tsx`, `bodies/AnnChargeBoard.tsx`, `AnnBaseCard.tsx`, `AnnBatchesPanel.tsx`
> - Charge console: `pages/process/AnnChargePage.tsx`, `AnnChargePanels.tsx`
> - Batching / Orders / Stop / History / Handover: `pages/process/AnnOperator*.tsx`, `AnnOutgoingHandoverPage.tsx`
> - Tokens: `packages/client/src/index.css`
> - General chrome: `docs/UI_UX_SOFTWARE_REFERENCE.md`, `doc/OPERATOR_SCREEN_LAYOUT.md`
>
> **Do not invent.** Gaps are marked `PARTIALLY IMPLEMENTED` or `NOT USED` for the live ANN path.

---

## 1. Product model (must match)

Annealing is **Archetype B** — work unit is a **charge on a base**, not a single coil capture with a right action rail.

| Concept | Meaning |
|---------|---------|
| **Base** | Physical annealing base / stand (`base_no`) |
| **Charge** | One production run on a base (`charge_no`) |
| **Annealing batch** | Plan/batch label (`annealing_batch_no`) |
| **Roster** | Coils stacked in the charge |
| **Stage** | Process stage on a fixed timeline (Loading → … → Unloading) |
| **Reading** | Periodic process parameter snapshot during a stage |
| **Stoppage** | Open downtime on the charge |

```text
Queue coils ──► Batching (stack + base) ──► Charge PREPARING
                                              │
                                         Assign base / Start
                                              │
                                         RUNNING stages + readings
                                              │
                                         DONE → back to Base Cards
```

---

## 2. Target device & chrome (exact)

| Constraint | Value |
|------------|-------|
| Device | Landscape industrial tablet / APK WebView |
| Theme | Light industrial only (`.theme-operator`) |
| Outer scroll | **Forbidden** — `h-screen overflow-hidden` |
| Fonts | IBM Plex Sans + IBM Plex Mono |
| Primary / nav | `#163328` |
| Accent (gold) | `#F1B824` — End Shift, Open stoppage, HOLD-class only |
| Canvas muted | `#F4F6F5` |

### Operator frame (same as other floor lines)

```text
┌────────┬──────────────────────────────────────────────────┐
│ NAV    │  STATUS RAIL (~52 px)                            │
│ 64 px  ├──────────────────────────────────────────────────┤
│ green  │  Offline banner (if offline)                     │
│ icons  ├──────────────────────────────────────────────────┤
│        │                                                  │
│ Logout │              MAIN CANVAS                         │
│        │              (inner scroll only)                 │
└────────┴──────────────────────────────────────────────────┘
```

| Region | Spec |
|--------|------|
| Left nav | Fixed `64 px` (`w-16`), `bg-nav`, icon 16 px + 8 px uppercase label, cells ~48×48 |
| Content offset | `margin-left: 64px` |
| Status rail | Top strip ≥ 52 px — line `ANN`, shift, Idle/Running/STOPPED badge, sync, clock, **End Shift** (gold) |
| **Right ProductionActionRail** | **NOT USED for ANN** (archetype B). Do not add a 104 px Start/End/Hold rail. |

**Replica note:** Status rail machine badge often stays **Idle** on ANN because charge RUNNING lives in charge-page local state, not the shared capture store (`PARTIALLY IMPLEMENTED` mismatch — replicate as-is or fix deliberately).

---

## 3. Information architecture & routes

Assume operator workspace base = `/{username}.operator` (user-scope).

| Screen | Route | Nav label | Purpose |
|--------|-------|-----------|---------|
| Base Cards (hub default) | `{base}?tab=charges` | **Base** | Grid of bases + open charge |
| Batches tab | `{base}?tab=coils` | **Batches** | Preparing / unassigned + pending queue |
| Batching | `{base}/batching` | **Batch** | Stack coils, create charge |
| Orders | `{base}/orders` | **Orders** | Inspect pending queue |
| Stoppage hub | `{base}/stoppage` | **Stop** | Open stoppages across bases |
| History | `{base}/history` | **History** | Reading history table |
| Charge console | `{base}/charge/{chargeNo}` | (via card) | Live production / readings |
| Handover | `{base}/handover` | via Status **End Shift** | Outgoing shift handover |

**Do not show** on ANN nav: Manual / New Order button (hidden for ANN).  
**Do not use** as primary path: `/capture` or `/capture/:coilNo` — routes may exist; live production is **`/charge/:chargeNo`**.

### Nav item order (exact)

1. Base  
2. Batches  
3. Batch  
4. Orders  
5. Stop  
6. History  
7. (Logout pinned bottom)

Icons (Lucide equivalents): Layers, ListOrdered, PackagePlus, Info, PauseCircle, History, LogOut.

---

## 4. Screen-by-screen replica specs

### 4.1 Base Cards (`AnnChargeBoard`)

**API**

- `GET /stations/ann/board` → `{ board: AnnBoardRow[] }`
- `GET /stations/ann/charges` → preparing / unassigned list
- Poll refresh every **30 s** + manual Refresh

**Layout**

```text
[ Base Cards title                    ] [ Refresh ]
[ All | Running | Stoppage | Complete | Idle ]  ← filter pills with counts
[ Search: base, batch, stage… ]
[ Card grid — responsive columns ]
```

**Card status mapping** (`boardCardStatus`)

| Condition | Card status | Strip color |
|-----------|-------------|-------------|
| No charge | `IDLE` | muted |
| Charge `DONE` | `COMPLETE` | info blue |
| Charge `PREPARING` | `IDLE` | muted |
| `has_open_stoppage` | `WARNING` (label STOPPAGE) | warning amber |
| Else | `RUNNING` | success green |

**Base card chrome (exact visual)**

```text
┌────┬─────────────────────────────────────────┐
│ V  │ Base | Ann batch no. | Stage            │
│ E  │ progress bar + caption (elapsed/STOP…)  │
│ R  │ Temp | Fan | Press | coils | reading age│
│ T  │                                         │
└────┴─────────────────────────────────────────┘
```

- Left vertical strip `w-8`, vertical-rl uppercase status text  
- Min height ~`5.5rem`, rounded-lg, border, hover lift  
- Click charge → navigate `/charge/{chargeNo}`  
- Click empty base → assign flow (`onOpenBase` / assign modal)

**AnnBoardRow fields to display**

- `base_no`, `charge.charge_no`, `annealing_batch_no`, `status`, `current_stage_code`, `no_of_coils`, `soak_temp_degc`
- `stages_done` / `stages_total`
- `active_stage_start_at` (elapsed)
- `latest_reading` (charge_temp, base_press, base_fan_rpm, taken_at)
- `has_open_stoppage`

---

### 4.2 Batches tab (`AnnBatchesPanel`)

- Hub tab `?tab=coils` (label **Batches** in nav)
- Shows preparing/unassigned charges and pending queue summary
- Entry into batching / charge as implemented in panel (replicate list + open actions from source)

---

### 4.3 Ann Batching (`AnnOperatorBatchingPage` + `AnnBatchingWorkspace`)

**Header copy (exact)**

- Title: `Ann Batching` (uppercase tracking)
- Subtitle: `Stack orders bottom→top, assign batch + base, create charge`

**Behaviour**

- Load queue / board / bases / spec-limits
- Stack coils bottom → top
- Assign annealing batch + base
- Create charge: `POST /stations/ann/charges` with `{ action: 'create', … }`
- Soft advisories only (`annBatchingAdvisories.ts`) — warnings, not hard blockers unless API rejects

---

### 4.4 Orders (`AnnOperatorOrdersPage`)

- List from `GET /stations/ann/queue`
- Detail drawer: `AnnQueueOrderDetailDrawer` → `GET /stations/ann/queue/:coilNo/detail`
- Drawer sections are **server-driven** (`sections[]`) — do not hardcode field list beyond chrome

---

### 4.5 Stoppage hub (`AnnOperatorStoppagePage`)

- Lists open stoppages from board/charges
- End open stoppages here
- **Start** new stoppage from charge console (not primary here)

---

### 4.6 Reading history (`AnnOperatorHistoryPage`)

**API:** `GET /stations/ann/readings?from=&to=` (+ board for base list)

**UI**

- Title: `Reading history`
- Filters: Base select, batch/charge search, from/to datetime, Refresh
- Table columns: time, base, batch, charge, stage, temps / press / fan (as in source)

Default from = now − 2 days; to = now.

---

### 4.7 Charge console — primary production UI (`AnnChargePage`)

This is the screen to replica with highest fidelity.

#### 4.7.1 Data load

`GET /stations/ann/charges/{chargeNo}` →

```ts
{
  charge: Record<string, unknown>; // base_no, status, current_stage_code, annealing_batch_no, total_active_min, …
  roster: RosterRow[];
  stages: Stage[];
  readings: Reading[];  // newest first assumed for readings[0]
  stoppages: Stoppage[];
}
```

Also: `GET /stations/ann/stoppage-categories`, `processStore.loadQueue()`, tick `nowMs` every **30 s**.

#### 4.7.2 Full-page layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PRIMARY GREEN HEADER                                                │
│ [←]  BATCH_LABEL  [ANN] [RUNNING|STOPPAGE|COMPLETE]                 │
│      [ History | Orders | Stoppage ]  ← segmented pills             │
│ ─────────────────────────────────────────────────────────────────── │
│ Meta: Base · Charge · Status · Stage · Start · Elapsed ·            │
│       Anneal time · Temp · Shift     | Progress bar xx% n/m         │
└─────────────────────────────────────────────────────────────────────┘
│ bg-secondary canvas                                                 │
│ ┌───────────────────────────────┬──────────────────┐                │
│ │ Stage timeline card           │ Action center    │                │
│ │                               │ 19rem (lg+)      │                │
│ │ Reading entry card            │ Assign/Start     │                │
│ │  2–3 col numeric fields       │ Swipe advance    │                │
│ │  Remarks                      │ Skip cools       │                │
│ │                               │ Stoppage block   │                │
│ │                               │ Save / Clear     │                │
│ └───────────────────────────────┴──────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
+ Drawers: History readings, Roster/Orders, Stoppage form
+ Modal: Assign Base
```

**Grid:** `lg:grid-cols-[minmax(0,1fr)_19rem]`, gap `2.5`, padding `2.5`.

#### 4.7.3 Header status pill

| Condition | Label | Style |
|-----------|-------|-------|
| `charge.status === 'DONE'` | COMPLETE | white/20 |
| Open stoppage | STOPPAGE | warning / gold warning |
| Else | RUNNING | success green |

#### 4.7.4 Meta row (on primary)

Use `MetaInline` pattern: 9 px uppercase label + mono bold value.

| Label | Value |
|-------|--------|
| Base | `base_no` or `unassigned` |
| Charge | `chargeNo` |
| Status | Preparing if preparing/unassigned else raw status |
| Stage | Humanized `current_stage_code` |
| Start | Active stage start time |
| Elapsed | Live elapsed of active stage |
| Anneal time | `total_active_min` formatted `Xh YYm` / `Zm` |
| Temp | Latest reading charge temp or draft field |
| Shift | Current shift code |

Progress: `%` and `stagesDone/stagesTotal` with green fill bar.

#### 4.7.5 Stage timeline (`ChargeDetailsTimeline`)

Fixed stage codes (order matters):

| Code | Label | Icon idea |
|------|-------|-----------|
| LOADING | Loading | Arrow down to line |
| PURGING | Purging | Wind |
| HEATING | Heating | Flame |
| SOAKING | Soaking | Hourglass |
| FURNACE_COOL | Furnace Cool | Fan |
| NATURAL_COOL | Natural Cool | Cloud |
| RAPID_COOL | Rapid Cool | Zap |
| WATER_COOL | Water Cool | Droplets |
| POST_PURGING | Post Purging | Refresh |
| UNLOADING | Unloading | Arrow up from line |

Visual rules:

- Horizontal timeline, min width ~42 rem, scroll on narrow
- Connector line green if done/current else border
- Node: round button ~44–56 px; done = green border + check badge; current = green ring + “· NOW” + elapsed chip
- Tap stage → detail line: start → end · duration · SKIP if skipped

#### 4.7.6 Reading entry fields (exact order)

3-column grid on `sm+` (2 cols on xs). Inputs: `h-14`, mono, decimal `inputMode`, Enter advances to next; last → Remarks.

| Key | Label | Unit |
|-----|-------|------|
| chargeTemp | Charge Temp | °C |
| gasTemp | Gas Temp | °C |
| fcTemp | F/C Temp | °C |
| n2h2Flow | N₂/H₂ Flow | — |
| basePress | Base Pressure | — |
| baseFanRpm | Base Fan | RPM |
| fuelFlow | Fuel Flow | — |
| rcfRpm | RCF | RPM |

+ **Remarks** textarea (auto-grow 72–160 px).  
**PARTIALLY IMPLEMENTED:** Remarks are cleared on save but **not** sent in `action: 'reading'` POST — replica may keep this bug or extend API deliberately.

**Save reading POST**

```http
POST /stations/ann/charges
{
  "action": "reading",
  "chargeNo": "...",
  "shiftCode": "...",
  "chargeTemp": number?,
  "gasTemp": number?,
  "fcTemp": number?,
  "n2h2Flow": number?,
  "basePress": number?,
  "baseFanRpm": number?,
  "fuelFlow": number?,
  "rcfRpm": number?
}
```

Empty strings → omit. Flash “Reading saved” ~2.5 s. Disable when charge `DONE`.

#### 4.7.7 Operator action center (replaces right rail)

| Control | When shown | Behaviour |
|---------|------------|-----------|
| **Assign Base** | `!base_no` | Opens assign modal |
| **Start / In Progress** | Preparing and base assigned | `POST .../charges/{chargeNo}/start` |
| **SwipeAdvance** | Running, not preparing, has active stage, no open stoppage, not DONE | Swipe ≥ 72% width → `advance-stage` |
| Hint | Open stoppage | “End stoppage to advance” |
| **Skip Rapid Cool / Water Cool** | Those stages not ended/skipped | `prompt` MH user id + reason → `skip-stage` |
| **Open stoppage** | No open stoppage | Gold button → stoppage drawer |
| **Active stoppage card** | Open stoppage | Category, reason, elapsed, **End stoppage** |
| **Save reading** | Footer sticky | Primary `h-14` |
| **Clear** | Footer | Secondary clears form |

**SwipeAdvance UX**

- Track height 56 px, rounded-full muted
- Knob 48×48; drag fill green wash
- Label: `Swipe · Next: {nextStageLabel}`
- Threshold: `0.72 * (trackWidth - 56)`
- Disabled when busy / preparing / no active / DONE / open stoppage
- On final unload advance with `done: true` → navigate back to Base Cards

#### 4.7.8 Header segment drawers

| Segment | Opens | Content |
|---------|-------|---------|
| History | Drawer | Previous readings list for this charge |
| Orders | Drawer | Roster coils + add coil + ADVANCE/HOLD/REJECT dispositions |
| Stoppage | Drawer | Start (category + reason) or End active |

**Roster APIs**

- Add: `{ action: 'roster', chargeNo, coilNo }`
- Disposition: `{ action: 'disposition', chargeNo, coilNo, disposition: 'ADVANCE'|'HOLD'|'REJECT' }`

**Stoppage APIs**

- Start: `{ action: 'stoppage-start', chargeNo, categoryCode, reason? }`
- End: `{ action: 'stoppage-end', stoppageId }`

**Advance / skip**

- `{ action: 'advance-stage', chargeNo }`
- `{ action: 'skip-stage', chargeNo, stageCode, authorizedBy, skipReason? }`

#### 4.7.9 Assign base

`AnnBaseAssignModal` — vacant bases from board; assign via station API (`assign-base` action as implemented).

---

### 4.8 Handover (`AnnOutgoingHandoverPage`)

Opened from Status Rail **End Shift**.

- Shell shared with other process outgoing handovers
- ANN extras: **Shift Remarks** + `AnnShiftReviewPanel` / review stack (process, stoppages, totals, delay remarks)
- Replicate sections from `components/process/annShiftReview/*`

---

## 5. Status rail vs action center (ANN)

```text
┌──────────────────────────────────────────────────────────────┐
│ STATUS RAIL (global shell)                                   │
│ ANN | Shift X | ● Idle* | Sync | Clock | [ End Shift ]       │
└──────────────────────────────────────────────────────────────┘

Charge page LOCAL status (authoritative for production):
  Header pill RUNNING / STOPPAGE / COMPLETE
  Action center Start / Swipe / Stoppage / Save

* Shared StatusRail badge is NOT wired to charge RUNNING — replicate or fix.
```

| Concern | Where |
|---------|--------|
| End Shift | Status rail → `/handover` |
| Stage advance | Charge action center swipe |
| Readings | Charge form + Save |
| Stoppage start/end | Charge drawer + action center |
| No Start/End/Hold rail | Correct for ANN |

---

## 6. Operator journeys (exact)

### A. Run an existing charge

```text
Login (badge+PIN)
 → Base Cards
 → Tap RUNNING/PREPARING card
 → Charge console
 → (Assign base / Start if needed)
 → Enter readings → Save reading
 → Swipe advance stages
 → Open/End stoppage as needed
 → Final unload advance → back to Base Cards
```

### B. Create a new charge

```text
Nav Batch
 → Stack coils bottom→top
 → Assign batch + base
 → Create charge
 → Open charge console (or from Bases)
 → Start → readings → advance
```

### C. End of shift

```text
Status Rail → End Shift
 → ANN handover + shift review
 → Confirm outgoing handoff
```

---

## 7. API contract checklist (operator)

| Method | Path | Used by |
|--------|------|---------|
| GET | `/stations/ann/board` | Bases, history bases, batching |
| GET | `/stations/ann/charges` | Preparing list |
| GET | `/stations/ann/charges/:chargeNo` | Charge console |
| POST | `/stations/ann/charges/:chargeNo/start` | Start |
| POST | `/stations/ann/charges` `{action}` | create, roster, disposition, advance-stage, skip-stage, stoppage-*, reading, assign-base |
| GET | `/stations/ann/queue` | Orders, batching |
| GET | `/stations/ann/queue/:coilNo/detail` | Order drawer |
| GET | `/stations/ann/stoppage-categories` | Stoppage form |
| GET | `/stations/ann/readings?from&to` | History |
| GET | `/stations/ann/bases`, `spec-limits` | Batching (as workspace uses) |
| GET | `/shift-logs/active/ANN` | ProcessLayout shift bootstrap |

Auth:Bearer session; operator needs ANN machine/line access.

---

## 8. Visual / interaction checklist (acceptance)

Replica passes when:

- [ ] 64 px green icon nav with ANN-only items (no Manual)
- [ ] Status rail present; End Shift gold → handover
- [ ] **No** fixed right ProductionActionRail on ANN
- [ ] Hub defaults to Base Cards (`tab=charges`)
- [ ] Base cards match strip + metrics + status mapping
- [ ] Charge header is primary green with meta + progress
- [ ] Stage timeline has all 10 stages with icons / NOW / elapsed
- [ ] Reading grid 8 fields + remarks; Enter navigation; Save `h-14`
- [ ] Action center 19 rem with swipe-to-advance (≥72%)
- [ ] Open stoppage is gold; blocks advance until ended
- [ ] Skip only Rapid Cool / Water Cool with MH auth prompts
- [ ] Drawers: History / Orders(roster) / Stoppage
- [ ] Touch targets ≥ 44–56 px on primary controls
- [ ] Mono for IDs, temps, timers; uppercase muted labels

---

## 9. Explicit non-goals / traps

| Trap | Correct behaviour |
|------|-------------------|
| Copy HRS/PKL CaptureWorkspace + action rail | Wrong for ANN |
| Use `/production/ann` + `annSchema` as main UX | Dual legacy; charge console uses `/stations/ann` |
| Bottom tab bar / portrait phone | Not this console |
| Wire StatusRail to charge RUNNING without deciding | Current product often shows Idle |
| Send remarks on reading | UI has field; API payload omits it today |
| MH live/trends/report screens | Separate desk product |

---

## 10. File map (implement against these)

| Replica module | Source file |
|----------------|-------------|
| Shell | `OperatorShell.tsx`, `OperatorNavRail.tsx`, `StatusRail.tsx` |
| Layout gate | `ProcessLayout.tsx` (archetype B → no rail) |
| Hub | `ProcessHub.tsx` + `AnnChargeBoard.tsx` + `AnnBaseCard.tsx` + `AnnBatchesPanel.tsx` |
| Charge | `AnnChargePage.tsx` + `AnnChargePanels.tsx` |
| Batching | `AnnOperatorBatchingPage.tsx` + `AnnBatchingWorkspace.tsx` |
| Orders | `AnnOperatorOrdersPage.tsx` + `AnnQueueOrderDetailDrawer.tsx` |
| Stop hub | `AnnOperatorStoppagePage.tsx` |
| History | `AnnOperatorHistoryPage.tsx` |
| Handover | `AnnOutgoingHandoverPage.tsx` + `annShiftReview/*` |
| Assign modal | `AnnBaseAssignModal.tsx` |
| Config | `processConfig.ts` (ANN archetype `'B'`) |
| Nav classify | `classifyOperatorNav.ts` |

---

## 11. Minimal component tree to rebuild

```text
OperatorShell(processCode="ANN")
├── OperatorNavRail (ANN items)
├── StatusRail
├── OfflineBanner
└── ProcessLayout (archetype B, no ProductionActionRail)
    └── Outlet
        ├── ProcessHub
        │   ├── tab=charges → AnnChargeBoard → AnnBaseCard*
        │   └── tab=coils → AnnBatchesPanel
        ├── AnnOperatorBatchingPage → AnnBatchingWorkspace
        ├── AnnOperatorOrdersPage
        ├── AnnOperatorStoppagePage
        ├── AnnOperatorHistoryPage
        ├── AnnChargePage
        │   ├── Header (meta + progress)
        │   ├── ChargeDetailsTimeline
        │   ├── Reading fields + Remarks
        │   ├── Operator action center (SwipeAdvance, …)
        │   ├── ZDrawer ×3
        │   └── AnnBaseAssignModal
        └── AnnOutgoingHandoverPage
```

---

## 12. Token & control cheat sheet

| Control | Treatment |
|---------|-----------|
| Primary Save / Start / Assign | Green primary |
| End Shift / Open stoppage | Gold accent |
| End stoppage / destructive | Danger |
| Advance | Swipe control (not a simple green button) |
| Skip cool | Secondary full-width |
| Status RUNNING | Success |
| Status STOPPAGE | Warning |
| Status COMPLETE / IDLE | Info / muted |

---

*End of ANN operator console replica spec.*
