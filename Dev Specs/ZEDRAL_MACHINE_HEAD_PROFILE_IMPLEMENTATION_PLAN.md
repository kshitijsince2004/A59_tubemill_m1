# ZEDRAL — MACHINE HEAD Profile · Detailed Implementation Plan

**Audience:** dev team / IDE. **Scope:** the complete Machine Head profile for Zedral M1 on the Goodluck A‑59 line (Tube Mill → Furnace → STP → Draw Bench). **Grounded in** `zedral_test-share-the-code`. This document is **standalone** — every screen, route, service, table and guard is named with its path so no other doc is needed to build it.

> Two companion plans cover **Plant Head** and **Admin**. The three together define the 4‑profile model: **Operator (0) → Machine Head (1) → Plant Head (2) → Admin (3)**.

---

## 1. What Machine Head IS

Machine Head is the **machine‑scoped operational owner** of the shopfloor. In the 4‑role model it is the merge point for the two roles being retired — **Supervisor** (review/approve) and **Quality** (spec sheets + inspection disposition) — plus the monitoring/import authority Machine Head already carries. One person, one login, three responsibilities, all limited to the machines in their `security.machine_access`.

| Property | Value |
|---|---|
| Enum | `UserRole.MACHINE_HEAD` — `packages/shared-validation/src/types/roles.ts` |
| Rank | `ROLE_RANK.MACHINE_HEAD = 1` |
| Route guard | `MachineHeadRoute` — `packages/client/src/components/RoleRoute.tsx` (`minRole=MACHINE_HEAD`, rank‑OR‑`allow`) |
| Data scope | `security.machine_access` (machine‑wise). NOT plant‑wide. |
| Auth | SuperTokens session (staff tier) + holds the **override‑PIN** authority |
| Home route | `/machine-head-dashboard` → `MhLiveEntry` (`lib/roleHome.ts`) |
| Backend gate | `requireRole([MACHINE_HEAD, …])` + `assertShiftLogApproval` (machine‑wise) + RLS |

**The scope rule (already implemented — keep it):** a Machine Head may approve / reject / reopen / override a shift log **iff every machine that shift ran on is in their `machineAccess`**. This is enforced by `assertShiftLogApproval(user, shiftLogId)` in `packages/server/src/auth/machineAccessPolicy.ts`, which `packages/server/src/routes/shiftLogRoutes.ts` already calls on `/:id/approve`, `/:id/reject`, `/:id/reopen` (lines ~645/657/669). A 4HI‑only head must not approve 6HI or 2HI work even on a shared process.

---

## 2. The single landmine — keep the override‑PIN mechanism

Two unrelated things contain the word "supervisor". **Only the role is removed.** The **override‑PIN mechanism stays and belongs to Machine Head:**

- `verifySupervisorOverridePin` + `POST /auth/supervisor-override` — `packages/server/src/routes/authRoutes.ts` → **KEEP name and endpoint.**
- `authApi.supervisorOverride(...)` — `packages/client/src/lib/authApi.ts` → **KEEP.**
- Consumers: `packages/client/src/components/forms/FieldWrapper.tsx` (field‑level override), `packages/client/src/operator/sync/SyncStatusBadge.tsx` (discard parked action), and **APK kiosk exit**.
- `OVERRIDE_ROLES` in `packages/server/src/services/authService.ts` already accepts `MACHINE_HEAD` — the only edit is dropping the `'SUPERVISOR'` string. Deleting the mechanism itself **breaks the offline APK kiosk.**

Machine Head is the human authority that keys the override PIN in the field.

---

## 3. Complete functionality inventory

Machine Head has four functional pillars. Every screen and endpoint below already exists unless marked **[new]** or **[wire]**.

### 3.1 Pillar A — Review & Approve (the retired Supervisor role)

The shift‑review surface. `PlantShiftReviewPage` is **already routed under Machine Head** at `/machine-head/shift-review` (`App.tsx` L412, `MachineHeadRoute`), backed by `PlantShiftReviewPanels.tsx` / `PlantShiftReviewRows.tsx` (`packages/client/src/pages/plant/`).

| Action | Route / endpoint | Guard | Scope check |
|---|---|---|---|
| List shift logs awaiting action | `PlantShiftReviewPage` → `GET /reports/machine-head` | `MachineHeadRoute` / `requireRole([MACHINE_HEAD, ADMIN])` | filtered to `machineAccess` |
| Open one shift for review | `ReportingService.getShiftReview(shiftLogId, machineCode?)` | — | machine‑wise |
| **Approve** | `PUT /shift-logs/:id/approve` | `requireRole([MACHINE_HEAD, PLANT_HEAD])` | `assertShiftLogAccess(…,'APPROVE')` + `assertShiftLogApproval` |
| **Reject** (with note) | `PUT /shift-logs/:id/reject` | same | same |
| **Reopen** | `PUT /shift-logs/:id/reopen` | same | same |
| Complete a shift | `PUT /shift-logs/:id/complete` | `requireRole([MACHINE_HEAD, PLANT_HEAD, ADMIN])` | machine‑wise |
| Handover summary | `GET /reports/handover` → `ReportingService.getMachineHandoverSummary(shiftLogId)` | `requireRole([MACHINE_HEAD, PLANT_HEAD, ADMIN])` | machine‑wise |

Lifecycle Machine Head drives: **DRAFT → SUBMITTED → APPROVED** (or **REJECTED → reopened → DRAFT**), plus **HOLD**. Approve/reject/reopen call `ShiftLogService.approve/reject/reopen` in `packages/server/src/services/shiftLogService.ts`.

### 3.2 Pillar B — Quality (the retired Quality role)

Quality spec sheets (QSS) and inspection disposition move under Machine Head.

| Screen | Current route | Change |
|---|---|---|
| Quality spec list | `/quality/specs` → `QualitySpecsPage.tsx` | **[wire]** guard `QualityRoute` → `MachineHeadRoute` |
| Quality spec editor | `/quality/specs/:id` → `QualitySpecEditorPage.tsx` | **[wire]** `QualityRoute` → `MachineHeadRoute` |
| Quality shell (nav) | `components/layout/quality/QualityShell.tsx` | keep; mount under Machine‑Head nav |
| Backend | `packages/server/src/routes/qualityRoutes.ts` — `qualityWrite = requireRole([QUALITY, ADMIN])` | **[wire]** `QUALITY` → `MACHINE_HEAD` (ADMIN keeps master edit) |
| Service | `packages/server/src/services/QualitySpecService.ts` | scope reads/writes by machine→process |

**Split decision (default):** Machine Head **views/applies** specs and does inspection disposition; **Admin authors** the grade/master spec set. ANN/PKL/machine spec *authoring* screens (`AnnSpecAdmin`, `PklSpecAdmin`, `MachineSpecAdmin`) are already `MachineHeadRoute`‑guarded today, so Machine Head retains spec‑sheet authoring for the process specs; only true master data (grades, validation rules) stays with Admin.

### 3.3 Pillar C — Monitoring & live dashboards (existing Machine Head)

| Surface | Route | Component |
|---|---|---|
| Machine‑Head home / live entry | `/machine-head-dashboard`, `/live` | `MhLiveEntry.tsx` |
| Consolidated MH dashboard | `pages/live/MachineHeadDashboard.tsx` (+`…Panels/Rows/Tabs`) | `ReportingService.getMachineHeadDashboard(machines)` |
| ANN live / detail / trends / batching / report | `/machine-head/ann/{live,charge/:chargeNo,trends,batching,report}` | `pages/machinehead/ann/*` |
| PKL live / coil / specs | `/machine-head/pkl/{live,coil/:coilNo,specs}` | `pages/machinehead/pkl/*`, `PklSpecAdmin` |
| HRS live / coil | `/machine-head/hrs/{live,coil/:coilNo}` | `pages/machinehead/hrs/*` |
| RWD live / coil | `/machine-head/rwd/{live,coil/:batchNo}` | `pages/machinehead/rwd/*` |
| Crew management | `/machine-head/crew` → `MachineHeadCrewPage.tsx` | `machineCrewRoutes` / `MachineCrewService` |
| Traceability | `/machine-head/traceability` → `PlantOrderTracking standalone` | `traceabilityRoutes` |

Backend for the dashboard: `GET /reports/machine-head`, `GET /reports/drilldown`, `GET /reports/daily`, all `requireRole([MACHINE_HEAD, …])`, scoped by machine→process.

### 3.4 Pillar D — Import, assignment, devices (existing Machine Head)

| Function | Route | Guard today | After merge |
|---|---|---|---|
| Rolling / PPC import | `/import/rolling` → `RollingImportPage` | `MachineHeadRoute allow=[SUPERVISOR]` | drop `allow`, plain `MachineHeadRoute` |
| Per‑process MH import | `/machine-head/{ann,hrs,pkl,rwd,6hi,4hi,2hi}/import` | `MachineHeadRoute` | unchanged |
| Order assignment | `/order-assignment`, `/crs/order-assignment` | `MachineHeadRoute allow=[SUPERVISOR]` | drop `allow` |
| PPC preview/commit | `sixHiRoutes` `/import/ppc/*` | `[ADMIN, MACHINE_HEAD, SUPERVISOR, PLANNER]` | drop `SUPERVISOR`; fold `PLANNER`→ADMIN or keep MACHINE_HEAD |
| Device registration | `deviceRoutes` | `[ADMIN, MACHINE_HEAD]` | unchanged |

---

## 4. Machine Head on the Goodluck A‑59 processes (TM / FUR / STP / DB)

This is the profile's substance for Goodluck. For each process the operator captures; the Machine Head owns the **gate/disposition, the sign‑off, and the machine‑scoped export**.

### 4.1 Tube Mill (ERW) — capture spine = **run**, not coil

- **Monitors:** setup sheet compliance + hourly process params + daily production, live, per mill in `machineAccess`.
- **Gate — First‑off approval:** the run cannot progress past first article until Machine Head records a **first‑off PASS/FAIL** disposition. Enforced on the shift‑review screen; backed by `assertShiftLogApproval` (the run's mill must be in `machineAccess`).
- **Approves:** the Tube Mill shift log (DRAFT→APPROVED) machine‑wise.
- **Export:** Tube Mill DPR for their mill via `MachineDprExport` (`/machine-head/dpr-export`).

### 4.2 Furnace (RHF annealing) — 6‑zone reading (ANN‑FT‑01)

- **Monitors:** the six‑zone (I–VI) min/max temperatures, line speed (m/hr), pieces/MT, per the ANN‑FT‑01 layout.
- **Disposition:** Machine Head dispositions any **zone excursion** (a zone reading outside its min/max band) — approve‑with‑note or reject the run/shift. The validation engine flags the excursion as a warning; the Machine Head clears it.
- **Approves:** Furnace shift log machine‑wise.
- **Export:** the Furnace annealing report that reproduces ANN‑FT‑01 exactly, via the export framework (see §6). Uses the same pattern as `AnnChargeReportWorkbookBuilder`.

### 4.3 STP (soap / phosphate bath) — two‑table format (STP‑FT‑01A)

- **Monitors:** production + bath temperatures/times (table 1) and bath analysis spec‑vs‑observed (table 2).
- **Sign‑off:** Machine Head signs off the **bath analysis** — the observed values against spec. A bath reading outside spec blocks approval until dispositioned.
- **Approves:** STP shift/lot log machine‑wise.
- **Export:** STP report reproducing STP‑FT‑01A (two‑table).

### 4.4 Draw Bench (multi‑pass) — FROM/TO dims + tooling (DB‑FT‑01/03/08)

- **Monitors:** per‑bench FROM/TO (OD‑ID‑TH‑LEN), draw passes, inspection.
- **Tooling authority:** approves the **die/plug issue slip** (DB‑FT‑08) and reviews die history (DB‑FT‑03); die/plug issue is a Machine‑Head action against `master.db_tooling`.
- **Inspection disposition:** dispositions Draw Bench inspection results (warning‑only eligibility, CTL pattern) — accept / rework / reject.
- **Approves:** Draw Bench lot/shift log machine‑wise.
- **Export:** DB reports reproducing DB‑FT‑01 (dimensions), DB‑FT‑03 (die history), DB‑FT‑08 (issue slip).

**Per‑process capability summary**

| Capability | Tube Mill | Furnace | STP | Draw Bench |
|---|---|---|---|---|
| First‑off / gate | first‑off PASS/FAIL | zone‑excursion disposition | bath sign‑off | die/plug issue + first‑off |
| Approve shift/lot (machine‑wise) | ✅ | ✅ | ✅ | ✅ |
| Quality spec review | ✅ | ✅ | ✅ | ✅ |
| Inspection disposition | ✅ | ✅ | ✅ | ✅ (accept/rework/reject) |
| Machine DPR export | ✅ | ✅ | ✅ | ✅ |

---

## 5. Navigation & shell

Machine Head lands on `/machine-head-dashboard` (`MhLiveEntry`). The nav rail is `packages/client/src/components/layout/machinehead/MachineHeadNav.tsx` — it must expose, in one place, all four pillars:

1. **Live** (dashboard, per‑process live pages)
2. **Review** (`/machine-head/shift-review`) — approvals + gates
3. **Quality** (`/quality/specs`) — **[wire]** add to the nav
4. **Crew / Import / Traceability** (`/machine-head/crew`, `/import/rolling`, `/order-assignment`, `/machine-head/traceability`)
5. **Exports** (`/machine-head/dpr-export`, `/machine-head/exports/history`)

**[wire]** Add the shift‑review and quality‑spec entries to `MachineHeadNav.tsx`; both were previously reached through separate Supervisor/Quality shells.

---

## 6. Exports Machine Head can run

Machine Head exports are **machine‑scoped**. The engine is shared:

- `exportRoutes` (`packages/server/src/routes/exportRoutes.ts`) — `router.use(requireRole([PLANT_HEAD, MACHINE_HEAD, ADMIN]))`; `POST /` create job, `GET /download/:jobId`, `GET /notifications`, `POST /dpr/finalize`, `GET /` history, `GET /:jobId` status.
- Render: `export/render/XlsxRenderer.ts`, `PdfRenderer.ts`, `AnnChargeReportWorkbookBuilder.ts`; DPR fidelity: `export/dpr/DprTemplateInjector.ts` + `export/layouts/TemplateBinder.ts` + `export/layouts/line_log/*.json`.
- Existing line‑log layouts: `HRS.json`, `ANN.json`, `SKP.json`, `PKL.json`, `CTL.json`. **[new]** For A‑59, add `FUR.json`, `STP.json`, `DB.json` (Furnace/STP/Draw) that reproduce ANN‑FT‑01 / STP‑FT‑01A / DB‑FT‑01·03·08. These land in the process build specs already delivered; Machine Head is the role that triggers them for their machines.
- Client entry: `MachineDprExport.tsx` (`/machine-head/dpr-export`), `ExportHistory.tsx` (`/machine-head/exports/history`).

---

## 7. Scope enforcement (defence in depth)

Every capability is enforced backend‑side — never frontend‑only.

1. **Route guard** — `MachineHeadRoute` (client), `requireRole([MACHINE_HEAD, …])` (server).
2. **Machine‑wise authority** — `assertShiftLogApproval(user, shiftLogId)` resolves the shift's machine(s) via `resolveShiftLogMachines` (priority: `txn.machine_shift_session.machine_code` → `txn.crm6_order.machine_code` → `shift_log.mill_type` → `master.machine WHERE process_id` fallback) and throws unless ⊆ `user.machineAccess`. ADMIN / PLANT_HEAD skip via existing carve‑outs.
3. **RLS** — `tenant_id` + row‑level security on every `txn.*` table.
4. **Access level** — `security.machine_access` carries the `APPROVE`/`WRITE` level via `lineAccessPolicy.ts` / `machineAccessPolicy.ts`.

---

## 8. Change set (what the dev actually builds/wires)

Most Machine Head surfaces already exist. The delta to reach the clean profile:

| # | File | Change |
|---|---|---|
| 1 | `shared-validation/src/types/roles.ts` | remove `SUPERVISOR` + `QUALITY`; `MACHINE_HEAD` rank stays `1` |
| 2 | `client/src/components/RoleRoute.tsx` | delete `QualityRoute`; drop `allow={[SUPERVISOR]}` args at call sites |
| 3 | `client/src/App.tsx` | `/quality/specs*` `QualityRoute`→`MachineHeadRoute`; strip `allow={[UserRole.SUPERVISOR]}` on `/import/rolling`, `/order-assignment`, `/crs/order-assignment`, `/live`, `/machine-head-dashboard`, `/machine-head/traceability`, `/machine-head/rwd/*` |
| 4 | `client/src/components/layout/machinehead/MachineHeadNav.tsx` | add Review + Quality entries |
| 5 | `server/src/routes/qualityRoutes.ts` | `qualityWrite` `[QUALITY,ADMIN]`→`[MACHINE_HEAD,ADMIN]`; `qualityRead` drop `QUALITY` |
| 6 | `server/src/routes/shiftLogRoutes.ts` | already `[MACHINE_HEAD, PLANT_HEAD]` + `assertShiftLogApproval` — **verify only** |
| 7 | `server/src/services/authService.ts` | `OVERRIDE_ROLES` drop `'SUPERVISOR'` only (keep the mechanism, §2) |
| 8 | `server/src/routes/{deviceRoutes,traceabilityRoutes,machineAccessRoutes,sixHiRoutes,liveRoutes,shiftRoutes}.ts` | replace `SUPERVISOR` in role lists with `MACHINE_HEAD` |
| 9 | `server/src/services/{ReportingService,ShiftDetectionService,SixHiService,shiftLogValidationService}.ts` | any `UserRole.SUPERVISOR` → `MACHINE_HEAD`; `getMachineHeadDashboard` already exists |
| 10 | `export/auth/exportAuthz.ts` | drop `SUPERVISOR` + `QUALITY` (MACHINE_HEAD already permitted) |
| 11 | `export/layouts/line_log/{FUR,STP,DB}.json` | **[new]** A‑59 process layouts |

The migration that repoints users/scopes and drops the role rows lives in the consolidation plan (`migrations/19xx_consolidate_roles_to_four.js`).

---

## 9. QA / acceptance checklist

- Former supervisor logs in as Machine Head and can **approve only their machines**; a non‑assigned machine's shift is refused (403 from `assertShiftLogApproval`).
- First‑off gate (TM), zone‑excursion disposition (FUR), bath sign‑off (STP), die/plug issue + inspection disposition (DB) each block/allow approval as specified.
- Quality spec screens open under Machine Head (no separate Quality login).
- Machine DPR export produces the exact A‑59 format for the head's machines only.
- **APK kiosk exit (override PIN) still works** — `verifySupervisorOverridePin` / `supervisorOverride` intact.
- `MachineHeadNav` shows all four pillars; no dead Supervisor/Quality links remain.
- Tests: `npm run test -w @m1/server` (rbac, `machineHeadLifecycle`, reportRoutes, exportRoutes, quality); client route‑guard/roleHome/userScope; `npm run smoke:machine-head`.

---

## 10. Bottom line

Machine Head is the machine‑scoped operational owner: it **reviews and approves** shift logs machine‑wise (retired Supervisor), **owns quality specs and inspection disposition** (retired Quality), **monitors** live per‑process dashboards, **runs** import/assignment/crew, and **exports** the exact A‑59 reports for its machines — while holding the **override‑PIN** authority that must never be deleted. On the Goodluck line it is the human gate at every stage: TM first‑off, Furnace zone excursions, STP bath sign‑off, Draw Bench tooling and inspection. Nearly all of it already exists in `zedral_test-share-the-code`; the work is folding two roles in, wiring the nav, and adding the three A‑59 export layouts.

*Grounded in `zedral_test-share-the-code`. Companion docs: Plant Head and Admin profile plans.*
