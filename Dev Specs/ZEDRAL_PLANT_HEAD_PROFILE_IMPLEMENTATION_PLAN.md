# ZEDRAL — PLANT HEAD Profile · Detailed Implementation Plan

**Audience:** dev team / IDE. **Scope:** the complete Plant Head profile for Zedral M1 on the Goodluck A‑59 line (Tube Mill → Furnace → STP → Draw Bench). **Grounded in** `zedral_test-share-the-code`. This document is **standalone** — every screen, route, service and guard is named with its path.

> Companion plans cover **Machine Head** and **Admin**. Model: **Operator (0) → Machine Head (1) → Plant Head (2) → Admin (3)**.

---

## 1. What Plant Head IS

Plant Head is the **plant‑wide oversight** profile: it sees **every process and every machine** on the A‑59 line, in one consolidated shell, and reads the numbers that matter to a plant manager — production, yield, OEE, downtime, defects, order tracking — with drill‑down from plant all the way to a single record. It is **oversight, not operation**: Plant Head does **not** capture readings, and (in the target model) does **not** action individual shift approvals — that moved to Machine Head.

| Property | Value |
|---|---|
| Enum | `UserRole.PLANT_HEAD` — `packages/shared-validation/src/types/roles.ts` |
| Rank | `ROLE_RANK.PLANT_HEAD = 2` (above Machine Head, below Admin) |
| Route guard | `PlantRoute` — `packages/client/src/components/RoleRoute.tsx` |
| Data scope | **plant‑wide** — all processes/machines, no `machine_access` filter |
| Auth | SuperTokens session (staff tier) |
| Home route | `/plant` → `UnifiedShell` → `PlantHeadDashboard` |
| Backend | `requireRole([PLANT_HEAD, …])`; PPC writes explicitly **denied** (`denyPlantHeadPpc`) |

**Scope note (grounded):** `PlantRoute` is `minRole=MACHINE_HEAD`, so the `/plant` area is rank‑reachable by Machine Head and above; Plant Head's distinction is the **plant‑wide, unfiltered** data it reads (no `machineAccess` restriction) and its read‑only posture, not a separate URL space.

---

## 2. The Plant shell — `/plant` (`UnifiedShell`)

Plant Head's entire experience is the `/plant` shell in `packages/client/src/App.tsx` (L349–363), rendered by `UnifiedShell`. Tabs:

| Tab | Route | Component (`packages/client/src/pages/…`) | Purpose |
|---|---|---|---|
| Dashboard | `/plant` (index) | `reports/PlantHeadDashboard.tsx` | plant KPIs |
| Live | `/plant/live` | `live/LiveDashboard.tsx` | real‑time line state |
| Production | `/plant/production` | `reports/PlantProduction.tsx` | output by process/machine/shift |
| Orders | `/plant/orders` | `reports/PlantOrderTracking.tsx` | order journey / backlog |
| Defect intelligence | `/plant/defect-intelligence` | `reports/PlantDefects.tsx` | top defects, trends |
| Downtime intelligence | `/plant/downtime-intelligence` | `reports/PlantStoppages.tsx` | stoppage/loss analysis |
| Alerts | `/plant/alerts` | `reports/PlantAlerts.tsx` | threshold/exception alerts |
| Audit | `/plant/audit` | `audit/AuditTrailView.tsx` | change history |
| DPR export | `/plant/dpr-export` | `reports/PlantDprExport.tsx` | plant‑wide DPR |
| Export history | `/plant/exports/history` | `reports/ExportHistory.tsx` | past export jobs |
| Users | `/plant/users` | `admin/UsersAdmin.tsx` (embedded) | **see §6 — decision** |
| Setup | `/plant/setup` | `SetupPage.tsx` (embedded) | device binding view |

Legacy redirects preserved: `/reports/plant-head`, `/reports/export`, `/reports/dpr`, `/audit` → their `/plant/*` equivalents.

---

## 3. Backend — the reporting surface

Plant Head is powered almost entirely by `ReportingService` (`packages/server/src/services/ReportingService.ts`), fronted by `reportRoutes` and the `DashboardReportingService` façade (`services/reporting/DashboardReportingService.ts`).

| Endpoint | Guard | Service method |
|---|---|---|
| `GET /reports/plant-head` | `[PLANT_HEAD, MACHINE_HEAD, ADMIN]` | `getPlantHeadDashboard(windowDays, filters)` |
| `GET /reports/plant-head/backlog` | `[PLANT_HEAD, MACHINE_HEAD, ADMIN]` | `getPlantHeadBacklog(filters)` |
| `GET /reports/management` | `[PLANT_HEAD, ADMIN]` | `getManagementDashboard(period)` |
| `GET /reports/drilldown` | `[MACHINE_HEAD, PLANT_HEAD, ADMIN]` | `getPlantHeadDrilldown(...)` / `getDrilldown(metric, scope)` |
| `GET /reports/daily` | `[MACHINE_HEAD, PLANT_HEAD, ADMIN]` | `getDailyReport(date)` |
| `GET /reports/coil-traceability` | `[PLANT_HEAD, MACHINE_HEAD, ADMIN]` | `searchCoilTraceability(coilNo)` |
| `GET /reports/handover` | `[MACHINE_HEAD, PLANT_HEAD, ADMIN]` | `getMachineHandoverSummary(shiftLogId)` |
| `GET /audit` | `[PLANT_HEAD, ADMIN]` | `AuditTrailService` |
| `GET /shifts/audit` | `[ADMIN, PLANT_HEAD, MACHINE_HEAD]` | shift override audit |
| `GET /traceability`, `/traceability/suggest` | `[PLANT_HEAD, MACHINE_HEAD, ADMIN]` | `TraceabilityService` |

`getPlantHeadDashboard` runs **unfiltered by machine** — it aggregates every shift on the line (helpers: `fetchShiftRows`, `enrichCrm6ShiftProduction`, `fetchDowntimeByShift`, `fetchLossByShift`, `fetchTopDefects`). That plant‑wide read is exactly what distinguishes Plant Head from Machine Head, whose dashboard (`getMachineHeadDashboard(machines)`) takes a machine list.

---

## 4. The drill‑down — Plant → Process → Machine → Shift → Record

The signature Plant Head capability. `getPlantHeadDrilldown` / `getDrilldown(metric, scope)` walk down the hierarchy so a plant manager can start from a plant KPI and land on the offending record:

```
Plant KPI (yield/OEE/loss/defect)
  └─ Process (Tube Mill / Furnace / STP / Draw Bench)
       └─ Machine (specific mill / furnace / bench)
            └─ Shift (date + shift code + crew)
                 └─ Record (the coil/run/lot entry, via fetchEntryIdsForShifts + PROD_ENTRY_TABLES)
```

Coil/run traceability (`searchCoilTraceability(coilNo)`) follows the COIL_NO spine and `planning.order_journey` across the full A‑59 route, so Plant Head can trace one piece Tube Mill → Furnace → STP → Draw Bench end to end.

---

## 5. Plant Head on the Goodluck A‑59 processes

Plant Head reads **all four processes together**, never captures. What it watches per process:

| Process | What Plant Head reads |
|---|---|
| **Tube Mill (ERW)** | run output (MT), speed, first‑off pass rate, rejection, downtime by mill |
| **Furnace (RHF)** | throughput, zone‑excursion frequency (ANN‑FT‑01 bands), pieces/MT, annealing loss |
| **STP** | bath‑analysis conformance (STP‑FT‑01A spec‑vs‑observed pass rate), coating throughput |
| **Draw Bench** | pass yield, size conformance (DB‑FT‑01), tooling consumption (DB‑FT‑03/08), rework/reject |
| **Line‑wide** | end‑to‑end yield, OEE, top defects, top stoppages, order backlog, coil traceability |

The **management dashboard** (`getManagementDashboard(period)`, `/reports/management`, `[PLANT_HEAD, ADMIN]`) rolls these into period totals for a plant‑manager view.

---

## 6. What Plant Head can and cannot do

**Can (read/oversight):** every dashboard and drilldown above; coil/run traceability; audit trail (`/plant/audit`, `GET /audit`); shift override audit; plant‑wide DPR export (`PlantDprExport`, `exportRoutes` — Plant Head is in `requireRole([PLANT_HEAD, MACHINE_HEAD, ADMIN])`); export history; alerts.

**Cannot (operational writes):**
- **No capture** — no operator capture routes.
- **No shift approval** in the target model — approve/reject/reopen moved to Machine Head (`shiftLogRoutes` still lists `PLANT_HEAD` as a rank‑carve‑out; see decision below).
- **No PPC import** — explicitly blocked by `denyPlantHeadPpc(...)` in `sixHiRoutes` (`PPC_PREVIEW`, `PPC_PREVIEW_MACHINES`, `PPC_PREVIEW_COMMIT`).
- **No masters / validation rules / machine master** — Admin only.

**[dev-decision] — two capabilities the current code grants Plant Head that the "read‑only" target would remove:**

1. **User & access management.** `userRoutes` is `router.use(requireRole([ADMIN, PLANT_HEAD]))` and `machineAccessRoutes` `PUT /:userId` is `[PLANT_HEAD, ADMIN]`; `/plant/users` renders `UsersAdmin` embedded. So today Plant Head can manage users and assign machine access. **Decision:** keep Plant Head as a plant‑wide people manager (recommended — a plant head assigning their machine heads' scope is natural), **or** restrict to Admin. If restricting, drop `PLANT_HEAD` from `userRoutes` L9 and `machineAccessRoutes` PUT, and remove the `/plant/users` tab.
2. **Shift approval carve‑out.** `shiftLogRoutes` approve/reject/reopen list `[MACHINE_HEAD, PLANT_HEAD]`. The target says approvals are Machine Head's. **Decision:** keep `PLANT_HEAD` as an escalation path (recommended — plant head can approve when a machine head is absent) **or** remove it for a pure read‑only Plant Head.

Both are one‑line role‑list edits; pick per Goodluck's org preference. Default recommendation: **keep both** (Plant Head as an escalation + people manager), because it matches how the plant actually runs and the code already supports it.

---

## 7. Scope enforcement

1. **Guard:** `PlantRoute` (client) + `requireRole([PLANT_HEAD, …])` (server).
2. **No machine filter:** Plant Head reads are plant‑wide by design — `getPlantHeadDashboard` takes no machine list. This is the intended broad scope, not a leak.
3. **Write denials:** `denyPlantHeadPpc` on PPC endpoints; no capture routes reachable.
4. **RLS:** `tenant_id` still scopes every read to the tenant.

---

## 8. Change set (delta from current code)

Plant Head is largely built. The delta to reach the clean 4‑role target:

| # | File | Change |
|---|---|---|
| 1 | `shared-validation/src/types/roles.ts` | `PLANT_HEAD` rank → `2` (was `3`) after `SUPERVISOR`/`QUALITY` removed |
| 2 | `server/src/routes/reportRoutes.ts` | verify all `plant-head*` endpoints carry `PLANT_HEAD`; no `SUPERVISOR` refs remain |
| 3 | `server/src/routes/{auditRoutes,traceabilityRoutes,shiftRoutes}.ts` | drop `SUPERVISOR` from role lists (leave `PLANT_HEAD`) |
| 4 | `client/src/App.tsx` | `/plant/*` tabs unchanged; remove any `SUPERVISOR` conditionals |
| 5 | `server/src/routes/userRoutes.ts`, `machineAccessRoutes.ts` | **decision §6.1** — keep or drop `PLANT_HEAD` |
| 6 | `server/src/routes/shiftLogRoutes.ts` | **decision §6.2** — keep or drop the `PLANT_HEAD` approval carve‑out |
| 7 | `export/layouts/line_log/{FUR,STP,DB}.json` | **[new]** so plant DPR reproduces the A‑59 formats (shared with Machine Head plan) |

No new screens are required for Plant Head — the shell, dashboards, drilldown and exports already exist.

---

## 9. QA / acceptance checklist

- Plant Head logs in → lands on `/plant` → sees **all machines/processes** with no `machineAccess` filter.
- Every tab loads: dashboard, live, production, orders, defect‑intelligence, downtime‑intelligence, alerts, audit, dpr‑export, exports/history.
- Drilldown walks Plant → Process → Machine → Shift → Record; `searchCoilTraceability` traces a coil across TM→FUR→STP→DB.
- Plant DPR export runs plant‑wide and reproduces the A‑59 formats.
- **PPC import is refused** for Plant Head (`denyPlantHeadPpc` → 403).
- No capture route is reachable.
- Decisions §6 wired as chosen (users tab / approval carve‑out present or absent as decided).
- Tests: `npm run test -w @m1/server` (reportRoutes, rbac, exportRoutes); client route‑guard/roleHome.

---

## 10. Bottom line

Plant Head is the plant‑wide read lens: one shell (`/plant`), every process and machine, the plant KPIs (production, yield, OEE, downtime, defects, orders), full drill‑down to a single record, coil traceability across the whole A‑59 route, and plant‑wide DPR export — with capture and (in the pure‑read target) shift approval left to the roles below and above it. The build is nearly complete in `zedral_test-share-the-code`; the work is the rank renumber, scrubbing `SUPERVISOR` from the shared read endpoints, the two org decisions in §6, and the three new A‑59 export layouts it shares with Machine Head.

*Grounded in `zedral_test-share-the-code`. Companion docs: Machine Head and Admin profile plans.*
