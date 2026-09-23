# ZEDRAL — Tube Mill UI, Navigation & Production Data Flow · Implementation Plan

**Scope: Tube Mill process only (and its directly related files).** Fragile, additive update. **Audience:** dev team / IDE.
Repo: `zedral_test-share-the-code`. This plan is the result of inspecting the actual code — it does not guess how Reading/Setup worked; §1 reports exactly what exists.

---

## 0. Headline (read before touching anything)

The Orders → Capture → History flow the brief asks for **already exists** and is **process-driven**. It is not four isolated screens; it is one operator workspace that switches its body by `processCode`. So this is **not a redesign** — it is: register **Tube Mill (TM)** as a process, add its capture bodies (the Setup Sheet + the reading forms), and wire them into the existing switches. Every other process (HRS/PKL/ANN/CRS/CTL/RWD) and every shared file stays untouched except three small, process-guarded switch points.

**One honest correction the audit forces:** there is **no component literally called "Setup Sheet," and no "Reading tab,"** anywhere in the current code (I searched both `zedral_test-share-the-code` and `hsl_zedral-main`, code + docs). `SetupPage.tsx` is a **device-binding barcode screen** (`BIND-…` → `/device/register`), not a production setup sheet. "Readings" are the per-process **capture bodies**. So the Tube Mill "Setup Sheet" is built as a **new setup step in the capture flow**, on the existing **ANN base-assign pattern**, with its content taken from **TM-FT-05 Mill Setup Parameter Sheet** (already specified in `ZEDRAL_M1_TUBEMILL_TO_DRAW_BUILD_SPEC.md` as `tm_setup` + first-off gate). If a prior build genuinely had a named "Setup Sheet" component, it is not in these two repos — point the team at that build and I will reuse it verbatim; otherwise the pattern below is the faithful way to add it.

---

## 1. What exists today (audit result)

**Navigation (already Orders/Capture/History).** `components/layout/operator/OperatorNavRail.tsx` renders the operator side nav per process via `lib/classifyOperatorNav.ts`. For generic process lines (HRS/CRS/RWD/CTL) it renders **Orders + Capture** (`processHubItems`) plus **History** (`historyItem`), keyed off `scopeRoot`/`processBase`. ANN and PKL get process-specific variants (ANN: Base/Batches/History).

**Orders.** `components/process/ProcessHub.tsx` is the order/coil queue (tabs "Coils"/"Batches", per-process queue title). Selecting a card carries the order/coil into capture.

**Capture.** `components/ScopeCaptureRoute.tsx` → `pages/process/ProcessCapturePage.tsx` → `components/process/CaptureWorkspace.tsx`. `CaptureWorkspace` chooses the **capture body** by `processCode`. Bodies live in `components/process/bodies/`: `HrsSlitBuilder`, `PklChartGrid`, `PklCoilForm`, `AnnBaseCard`, `AnnBaseAssignModal`, `AnnBatchesPanel`, `AnnChargeBoard`, `CrsQualityForm`, `CtlPieceCounter`, `RwdTensionForm`.

**Reading = capture body.** "Multiple readings" is a real, existing concept — see `doc/ZEDRAL_HRS_MULTI_READING_CAPTURE_PLAN.md` (HRS start/middle/end) and `PklChartGrid` (hourly rows). A "reading" is a row/entry captured in the body.

**Setup / assign step = ANN Base.** The closest existing "configure before you capture" step is ANN's **Base** tab: `AnnBaseCard` + `AnnBaseAssignModal` assign a charge/base before readings. CRS/CTL use a **machine assignment** step (`master.machine_spec` + assignment board). This is the reusable scaffolding for the Tube Mill Setup Sheet.

**History.** `pages/process/ProcessOperatorHistoryPage.tsx` (generic) and `AnnOperatorHistoryPage.tsx`. Reads persisted records by process/order/shift.

**Process registry.** `lib/processConfig.ts` (`isProcessStationCode`, `config.label`), `store/processStore.ts`, `hooks/useProcessWorkspaceBase.ts`, `ProcessRouteService`/`ProcessStationService` (server) drive which codes are "process stations."

**Server persistence (the spine).** `modules/m1-collection/services/ProductionService.ts` saves per-process to `txn.prod_<proc>` keyed to `work_order_no` + `coil_no` + `shift_log_id` on the `coil.coil` + `planning.order_journey` genealogy. Routes in `productionRoutes.ts`. History reads the same tables. **This is the order→reading link the brief wants — it already exists; reuse it.**

**Conclusion:** the framework is exactly the architecture the brief describes. Tube Mill is missing as a process; nothing needs redesign.

---

## 2. The flow, mapped onto real components

```
ORDERS            ProcessHub (TM queue: work orders / coils to run)
   ↓ select
CAPTURE           ScopeCaptureRoute → ProcessCapturePage → CaptureWorkspace (processCode==='TM')
   ↓
READING           CaptureWorkspace picks the TM body
   ↓
SETUP SHEET       TmSetupSheet body (TM-FT-05 + first-off) — pattern: AnnBaseCard/AnnBaseAssignModal
   ↓
ENTER READINGS    TmParamReading / TmDailyProduction bodies (the reading forms)
   ↓
LOG SHEET         the persisted txn.prod_tm_* rows ARE the log sheet; export via the format template (build spec §3)
   ↓
PERSIST           ProductionService.saveTm* → txn.prod_tm_* (order/coil/shift keyed)
   ↓
HISTORY           ProcessOperatorHistoryPage (reads the same rows, shows order + timestamps)
```

Everything left of PERSIST is UI wiring on existing shells; PERSIST/HISTORY reuse existing services and tables.

---

## 3. Smallest change set (files to add / touch)

Additive and process-guarded. **New TM files** (safe — no other process imports them) and **three small switch edits** (guarded by `processCode === 'TM'`, so other processes are unaffected).

**A. Register the process (1 edit + seed).**
- `lib/processConfig.ts`: add `TM` to the process-station codes + `config` (label "Tube Mill", queue title, tabs). This makes `isProcessStationCode('TM')` true, so the nav, ProcessHub, ScopeCaptureRoute and History treat TM as a generic process automatically.
- Server: seed a `TM` process/station row via the existing `ProcessStationService` seed (no new registry).

**B. Capture bodies (new files, `components/process/bodies/`).**
- `TmSetupSheet.tsx` — the **Setup Sheet** (TM-FT-05: size, slit thk/width, roll set, mill, grade; tooling ID/OD/work-coil/impeder/boggie; speed/power specified-vs-observed; coolant conc/pressure; argon/wiper; fin-pass FF1/FF2/FF3; **first-off PASS/FAIL gate**). Build on `AnnBaseAssignModal`/`AnnBaseCard` (the assign-before-capture pattern) so it reads the selected order and persists a `tm_setup` row before readings are allowed.
- `TmParamReading.tsx` — hourly Mill Parameter reading (TM-FT-04): speed, power, tooling confirm, coolant, argon, wiper. Pattern: `PklChartGrid` (repeating hourly rows).
- `TmDailyProduction.tsx` — daily production (TM-FT-02): prime/PQ2/CQ/open counts+weights, yield. Pattern: `CtlPieceCounter` (counts + child rows).
- (Downtime, slit inspection, edge milling, work-coil reuse the existing shared stoppage/inspection sub-forms.)

**C. Wire the bodies (2 small switch edits, TM-guarded).**
- `components/process/CaptureWorkspace.tsx`: add `if (processCode === 'TM') { … render TmSetupSheet when setup incomplete, else the reading body … }`. Gate readings on `first_off_status === 'PASS'` (reuse the body-selection block already there).
- `components/process/ProcessHub.tsx`: add TM queue labels/tabs in the existing `processCode ===` blocks (title "Tube Mill Queue"; tab "Coils").
- `lib/classifyOperatorNav.ts`: TM falls into the generic `isProcess` branch already (Orders/Capture/History) — **no change needed** unless TM wants a "Setup" nav chip; if so, add `isTm` and a Setup item exactly like ANN's Base item. Prefer no change (Setup is a step inside Capture, not a nav tab) to stay minimal.

**D. Reading → Setup Sheet link (the brief's core ask).**
In `CaptureWorkspace` for TM: the capture screen opens the **Setup Sheet first** for a new run/order (no `tm_setup` yet), exactly like ANN opens Base-assign; once first-off is PASS, it shows the reading bodies. The Setup Sheet is thus "brought back into the Reading flow" as its first step — reusing the ANN gate pattern, not a new architecture.

**E. Persistence (reuse, no new tables).**
- `modules/m1-collection/services/ProductionService.ts`: add `saveTmSetup`, `saveTmParam`, `saveTmProduction` writing to `txn.prod_tm_*` (tables from the build spec), keyed to `work_order_no`/`coil_no`/`shift_log_id`. Routes on `productionRoutes.ts` (`/m1/tm/...`). No new order/coil tables — reuse `planning.order_journey` + `coil.coil`.

**F. History (reuse).**
`ProcessOperatorHistoryPage` already lists a process's records by order/shift; it works for TM once the rows exist. Add a TM column set only if a field is missing (prefer reuse). The Setup Sheet and each reading are visible as the run's records, each showing its order and timestamp.

**Files NOT to touch:** every other process body, the CRM/6HI path, `SetupPage.tsx` (device binding — unrelated), auth, DB schema of other processes, exports of other processes, machine-head/plant-head dashboards (they pick up TM automatically via process config).

---

## 4. Data integrity (the critical section)

- **One source of truth per run.** The order/coil is selected in ProcessHub and carried through `useProcessWorkspaceBase`/`processStore` into CaptureWorkspace; every write (setup, each reading, production) stamps the same `work_order_no` + `coil_no` + `shift_log_id` + `operator` + `machine_code` via `ProductionService`. No parallel copy.
- **No duplicate tables.** TM uses `txn.prod_tm_*` (build spec) and the shared `coil`, `planning.order_journey`, `stoppage_entry`, `defect_entry`. Do not create a second "capture" or "order" store.
- **Setup → reading link.** A reading row references its run's `tm_setup` (FK), so tooling/first-off context is traceable; readings cannot be booked before first-off PASS (server guard + UI gate).
- **Traceability chain (as the brief draws it):** Production Order → operator, machine/process, `tm_setup` (reading configuration), readings, remarks, log sheet — all one graph on the existing spine, queryable in History.
- **No mock data as final.** Seed a TM process/station and a couple of test orders for dev only; real orders come from `planning`/ERP (see the ERP integration plan). Setup-sheet fields are configured from masters (`tm_param_chart`), never hardcoded.

---

## 5. UI direction (keep it the previous look)

Reuse `components/primitives/*` (ZBadge, buttons, inputs), the existing capture body layout, spacing, icons (`lucide-react`), and the operator shell. The Setup Sheet mirrors `AnnBaseCard`'s visual structure; the reading grids mirror `PklChartGrid`/`CtlPieceCounter`. No new cards, gradients, animations, or layout system. The result is the same interface with a Tube Mill process added.

---

## 6. Build order (smallest → safest)

1. Server: `txn.prod_tm_*` migrations + `ProductionService.saveTm*` + routes + seed the TM process/station (behind the existing seeds). Verify with `smoke:api`.
2. `processConfig` TM registration → confirm nav shows Orders/Capture/History for a TM operator with no other change.
3. `TmSetupSheet` body (first-off gate) on the ANN pattern; wire into `CaptureWorkspace` (TM-guarded). Verify setup persists and gates readings.
4. `TmParamReading` + `TmDailyProduction` bodies; wire in. Verify readings persist order-linked.
5. History: confirm TM records appear with order + timestamps (reuse `ProcessOperatorHistoryPage`).
6. Export buttons per the build spec (§3) — separate, optional in this pass.

---

## 7. Validate (the brief's end-to-end)

Create/Select TM order → open Capture → Setup Sheet loads (TM-FT-05) → first-off PASS → enter readings → save → the `txn.prod_tm_*` rows form the log sheet → open History → the **same** record appears against the same order, same timestamps, same operator. Check: no duplicate rows; readings blocked before first-off; other processes' nav/capture unchanged (regression); console + server logs clean. Run `test -w @m1/server`, `smoke:api`, `smoke:pilot`, and the client vitest.

---

## 8. Fragility guardrails

- Every shared-file edit is `processCode === 'TM'`-guarded → other processes cannot regress.
- New TM bodies are leaf files no one else imports.
- No DB schema change to existing tables; only new `txn.prod_tm_*`.
- Branch `feat/tubemill-ui-flow`; commit per step (server, config, setup, readings, history); keep `main` stable; revert the offending commit if a step breaks, don't patch forward.
- Open question for the team: if a named **Setup Sheet / Reading tab** feature existed in an earlier build (not in these two repos), share it and it will be reused instead of the ANN-pattern build above.

---

## Bottom line

The Orders/Capture/History flow, the order→reading link, and the History view already exist as a process-driven operator workspace. The Tube Mill update is additive: register `TM`, add its Setup Sheet (TM-FT-05, on the ANN base-assign pattern) and reading bodies, wire them into the two `processCode` switches, and persist through the existing `ProductionService` onto the existing order/coil spine. No redesign, no duplicate data, no change to other processes — the previous Zedral interface, cleaned up and connected to Tube Mill production data. The only honest gap is that a literal "Setup Sheet" component does not exist in the current code; it is built here from the real TM-FT-05 spec on the existing setup-step pattern, or reused verbatim if the team supplies the older build that had it.

*Grounded in `zedral_test-share-the-code` (real component paths cited) and `ZEDRAL_M1_TUBEMILL_TO_DRAW_BUILD_SPEC.md` for the TM tables and TM-FT-05 fields.*
