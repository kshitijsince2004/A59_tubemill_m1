# ZEDRAL — M1 Phase 1 · Implementation Assessment

**Goodluck India Limited · Sikandrabad A-59 · Tube Mill → Furnace → STP → Draw Bench · Manual digitization, PLC-ready**
**Audience:** developers / IDE agent. This is the pre-build assessment required before any code (per the brief §39). It is grounded in the actual repo (`zedral_test-share-the-code`) and the plant's controlled process route.

---

## 0. Scope, and two corrections up front

**Phase 1 is strictly digitization.** Operators enter data on digital forms that reproduce the existing paper log sheets; data is stored, reviewable, searchable, historical and exportable using the existing Zedral M1 patterns. **No PLC/SCADA/sensor capture is built in Phase 1.** The architecture keeps that path open through a `data_source` field and a documented ingestion seam (§13), but nothing live is wired.

**Correction 1 — process order.** The brief's "Tube Mill → STP → Furnace → Drawbench" is not the plant route. The controlled route card (GLI-WI-QA-13) and the A-59 process-route doc give: **RM → Slitting → Tube Mill (ERW) → Furnace (Annealing 104A) → STP (105A soap) → Draw Bench (107)**, where drawing is a multi-pass cycle **FUR → STP → Swage → Draw → Centreless**, repeated for 1st/2nd/3rd pass. So the correct Phase-1 order is **Tube Mill → Furnace → STP → Draw Bench**. Use this.

**Correction 2 — reuse the field dictionary that already exists.** The four data-mapping workbooks are already built and sit in `Zedral x Goodluck/Claude outputs/`: `Zedral_A59_TubeMill_M1_Data_Mapping.xlsx` (122 fields), `Zedral_A59_Furnace_M1_Data_Mapping.xlsx` (27), `Zedral_A59_STP_M1_Data_Mapping.xlsx` (28), `Zedral_A59_DrawBench_M1_Data_Mapping.xlsx` (58). These are the authoritative field dictionaries (colour-coded AUTO/DERIVED/MANUAL). Do not re-derive fields; build the forms from these.

**Reuse-first.** The existing codebase already runs a per-process capture platform (cold-rolling processes HRS/PKL/CRM/ANN/SKP/RWD/CRS/CTL). Phase 1 extends that platform with four new processes. It must feel like the same M1 grown wider, not four bolt-ons.

---

## 1. Existing architecture discovered

TypeScript monorepo, layered, offline-tolerant, stable contracts at boundaries.

- **Packages:** `@zedral/platform` (event bus `InProcessEventBus`/`KafkaEventBus`, `canonical/` entities + event contracts, `writeback/WritebackClient`, `security`, `tenant`, `registry`, `observability`), `@m1/shared-validation` (Zod contracts, `src/rules/m1Forms.ts`), `@m1/server` (Kysely over Postgres, `src/modules/m1-collection`, `src/services`, `src/export`, `migrations/`), `@m1/client` (React PWA), `packages/connectors` (Manifold connector framework).
- **DB:** PostgreSQL, schemas `master` / `coil` / `txn` / `planning` / `security` / `audit`; **Kysely** typed builder; **node-pg-migrate** (`exports.up/down`, `pgm.sql`), seeds as JSON.
- **Tenancy/security:** `security.tenant` / `permission` / `device_registration`; multi-tenancy migration; RLS + FORCE RLS; SuperTokens sessions + scrypt/`timingSafeEqual` PINs.
- **Process model already exists:** `ProcessRouteService.ts`, `ProcessStationService.ts`, `processStationRoutes.ts`, migrations `process_sheet` and `process_station_flags`. Processes and stations are first-class, configurable, seeded — this is the extension point for the four new processes.
- **Offline capture:** `packages/client/src/operator/` (`native`, `db`), `lib/sync` — offline-first is already built.

## 2. Existing M1 / "Tube Mill" architecture (honest state)

The brief treats "Tube Mill" as already implemented. **In code it is not yet built** — the implemented reference is the cold-rolling per-process set. What exists and is the pattern to extend:

- **One capture module, many processes:** `packages/server/src/modules/m1-collection/` with `services/ProductionService.ts` (one service, per-process save methods `saveHrs…saveCtl`) and `routes/productionRoutes.ts`. Processes are distinguished by `process_id`.
- **Contract pattern:** `m1Forms.ts` — `baseProcessEntrySchema` (`machineCode, shiftLogId, coilNo, timeFrom, timeTo, remarks, …`) extended per process (`hrsSchema … ctlSchema`), plus child sub-schemas (slit slots, pass rows, chart rows). Inferred types `M1<PROC>Form`.
- **Data model:** `txn.prod_<proc>` per process + child tables (e.g. `txn.prod_ctl_bundle`); the **COIL_NO spine** with `coil.coil` + `coil_process_history`; `planning.order_journey` genealogy (`ProcessRouteService`/`ProcessStationService`, `CoilLineageWalker`); shared `txn.shift_log`, `stoppage_entry`, `defect_entry`, `crew_entry`; `txn.machine_handover` / `machine_shift_session` for shift boundary.
- **Lifecycle:** `ProcessEntryStatus` **DRAFT → SUBMITTED → APPROVED** (+ **HOLD**); order status `PENDING/PREPARING/IN_PROGRESS/STOPPAGE/COMPLETED/REJECTED`; journey `ACTIVE/COMPLETED/HOLD/REJECTED`. Reuse as-is.
- **Two relevant reference processes already exist:** **ANN (Annealing)** — charge/base grouping, furnace, zone data — is the closest match for the new **Furnace**; **CTL (Cut-to-Length)** — machine-common-area, unlimited weighed bundle child, per-machine assignment — is the closest for downstream cutting and the pattern for **Draw Bench** per-machine capture. This is a large head start.

> The A-59 tube-mill design work from earlier this session (run/coil/bundle model, PLC-first collector) lives in `Dev Specs/ZEDRAL_TUBEMILL_M1_A59_*`. In Phase 1 that PLC-first path is **deferred**: the tube-mill form is captured manually like the others, and the collector design becomes the Phase-2 PLC extension point (§13).

## 3. Existing role architecture (reuse, do not fork)

`UserRole` enum already: **OPERATOR, SUPERVISOR, MACHINE_HEAD, PLANT_HEAD, ADMIN** (rank map 0/0/1/3/4). Migrations `reintroduce_supervisor_role`, `multi_tenancy`. Row-level line/machine scoping via `security` + `line_access`; backend-enforced, not frontend-only. **No new roles or auth.** New processes get access by assigning operators to the process/machine through the existing scoping.

## 4. Existing DB entities to reuse (no duplicates)

Do **not** create parallel Users, Operators, Machines, Processes, Orders, Shifts, Plants. Reuse:

| Need | Existing entity |
|---|---|
| Users / roles / perms | `security.*` (app_user, role, user_role, permission, line_access, tenant) |
| Plant / process / station | process registry (`ProcessRouteService`, `process_station` seed + flags) |
| Machine / envelope | `master.machine` / `master.machine_spec` (+ CRUD) |
| Shift | `master.shift`, `txn.shift_log`, `machine_shift_session`, `machine_handover` |
| Order / plan | `planning.*` (import_batch, plan_order, order_journey), `hrsOrderRoutes`, order-assignment board |
| Material identity | `coil.coil` + `coil_process_history` (COIL_NO spine; matches the plant's coil ID + WO genealogy) |
| Shared sub-records | `txn.stoppage_entry`, `defect_entry`, `crew_entry` |
| Audit | `audit.*` (`lineage_ref`, change_request, export_job), shift_event/override audit |

The plant's own key (RM coil ID `AA-BB-CC-D-EEEE` + WO number, slit appends `-F-G-H`) maps directly onto the existing COIL_NO spine + `order_journey`. Key new records on **coil/lot + WO**, as the plant does.

## 5. New DB entities required (minimal)

- **Per-process capture tables** (mirror `txn.prod_<proc>`): `txn.prod_tm` (+ children per the tube-mill mapping), `txn.prod_fur` (furnace, with a **6-zone** temperature block I–VI, not 4 — see risk R-3), `txn.prod_stp` (bath log: temps/times + analysis TA/FA/pH/HCl%/Fe%), `txn.prod_drw` (draw production/1st-off: FROM/TO OD-ID-TH-LEN, accepted/rejected/drawn-metre, pass no). Add child tables only where a form has a repeating group (draw passes, STP baths, furnace charge lots), following the `prod_ctl_bundle` precedent.
- **`data_source` column** on every new capture table (and, additively, on the shared capture header): enum `MANUAL | PLC | SCADA | SENSOR | API`, default `MANUAL`. This is the single most important forward-compatibility change (§13).
- **Process/station seed rows** for Tube Mill, Furnace, STP, Draw Bench, Swaging (draw sub-step) in the existing process registry — not a new table.
- **Masters:** stoppage reason-code master (currently missing, R-1), furnace zone config, STP bath-chemical list (Annexure-1), draw die/plug tooling (history-card regime), swage-end-length-by-tonnage table. Reuse `master.machine_spec` shape for envelopes (draw-bench tonnage table C, furnace RHF list).
- **New Zod contracts** in `shared-validation/src/rules/m1Forms.ts`: `tmSchema`, `furSchema`, `stpSchema`, `drwSchema` (+ child schemas), each extending `baseProcessEntrySchema`; inferred `M1TMForm` etc.

Everything else is reuse. Migrations follow existing numbering under `packages/server/migrations/` (respect the Windows/UTF-16 caution).

## 6. Existing components reusable (frontend)

`packages/client/src` already provides: `components/capture` + `components/forms` (the capture framework), `components/machinehead` + `pages/machinehead`, `components/plant-head` + `pages/plant`, `components/orders` + `pages/orderAssignment` (assignment board + `MachineAllocationModal`), `components/export` + `pages/reports`, `components/process` + `pages/process`, `components/sixHi` / `live` / `analytics`, `components/ui` + `primitives` (dropdowns, date/time, modals, toasts, loading/empty states), `operator/` (offline). The new process screens compose these; do not introduce a new UI system.

## 7. Components to modify

- **Navigation:** extend the existing sidebar/nav to list Tube Mill, Furnace, STP, Draw Bench under M1 (role/assignment gated). No new nav system.
- **Process registry seed + capture-form registry:** register the four processes and route the capture screen by `process_id`.
- **Export:** add report/mapping entries (see §10) — modify `export/definitions/registerDictionary.ts`, `export/read/processMappers.ts`, `export/dpr/dprFieldCatalog.ts`.
- **Machine assignment:** add the new machines (Tube mills, RHF furnaces, STP line, draw benches DB-10…250T) to `master.machine`/`machine_spec` seed + CRUD.

## 8. New components required

- Four capture screens: `TubeMillCapture`, `FurnaceCapture`, `StpCapture`, `DrawBenchCapture`, each built from the field dictionaries and the existing form primitives.
- Process-specific sub-widgets: furnace **6-zone temperature grid** (Min/Max I–VI, speed, PNG/NH3 consumption), STP **bath monitoring grid** (per-bath temp/time + analysis), draw-bench **pass/1st-off block** (FROM/TO dims, accepted/rejected/drawn-metre, pass no), swage-end-length entry.
- Four export configs (declarative, §10) — not new export engines.

## 9. Existing export architecture (reuse)

Mature and declarative: `export/definitions/ReportDefinition.ts` + concrete reports (`DprReport`, `ShiftSummaryReport`, `CoilTraceReport`, `LineLogReport`, `QcFailsReport`, `RawRegisterReport`, `RejectedOrdersReport`, `AnnChargeReport`), `registerDictionary.ts`, `ExportJobService.ts` (`export_job` audit), `read/processMappers.ts`, `render/*WorkbookBuilder.ts`, DPR layout `layouts/dpr_layout.v1.json` + `dprFieldCatalog.ts`, `exportRoutes.ts`, `components/export` + `pages/reports`. This already matches the brief's desired Base-Export-Service → per-process config shape.

## 10. Required export changes

Add a **process export configuration** per new process (columns, order, header names, units, formatting, filename pattern, sheet name) as a new `ReportDefinition` + `processMappers` entry, so the format matches each approved log sheet (e.g. draw report GLI-FT-PRD-DRW-01 column order; furnace ANN-FT-01 6-zone layout; STP-01A bath columns; TM-FT-02 WO-wise prime/PQ2/CQ/open). Common metadata (date/shift/machine/operator naming) follows the existing Zedral export convention, which takes precedence. Reuse the export UI, button, filename and formatting conventions unchanged.

## 11. API changes

Follow existing conventions (`productionRoutes`, `processStationRoutes`, `exportRoutes`, `hrsOrderRoutes`, idempotency via `txn.idempotency_key`). Extend, don't restyle:

- `GET /processes`, `/machines`, `/shifts` — exist (`processStationRoutes`, `masterDataRoutes`).
- Per-process CRUD + submit: reuse the `m1-collection` route shape (`POST/PUT /m1/<proc>/records`, `/submit`) — add TM/FUR/STP/DRW handlers in `ProductionService` + `productionRoutes`.
- `POST /m1/<proc>/export` — reuse `exportRoutes`.
- Pass `data_source` through save/import (defaults MANUAL) so the same endpoints accept a future PLC/SCADA writer.

## 12. Permission changes

None structural. Operators are scoped to the new processes/machines via existing `line_access`; MACHINE_HEAD sees assigned machines/processes; PLANT_HEAD is plant-wide. Backend enforces (not frontend-only). Confirm the two audit fixes before onboarding this as a live tenant: run app as **`m1_app`** (not superuser) and stop header-trusted tenant (audit H-2/M-1); fix `carryForward.ts` `_entry` bug and add the new processes to its handover map (H-1).

## 13. Future PLC integration points (architected now, inactive)

- **`data_source` enum** on every capture record (MANUAL default) — the record does not depend on the source being manual.
- **Ingestion seam:** the Manifold **connector framework** (`packages/connectors`) + the platform **event bus** + **canonical event contracts** are the future path: a PLC/SCADA collector becomes a connector plugin that writes the same canonical events, which a consumer maps into the same `txn.prod_*` tables with `data_source='PLC'`. The A-59 collector design is already specified in `Dev Specs/ZEDRAL_TUBEMILL_M1_A59_ARCHITECTURE.md`.
- **Per-field readiness is already known** from the mapping workbooks: Furnace is the easiest L2 (RHF SCADA already logs the 6 zone temps + speed), STP L2 (auto-crane bath temps/times via ET200S/TP700), Tube Mill welder L2 (Thermatool/MicroLogix), Draw Bench stays L1/manual. Phase 2 wires these highest-value AUTO fields first; the forms flip those fields from MANUAL entry to confirm-only without schema change.
- Do **not** simulate PLC data in Phase 1.

## 14. Risks / dependencies

- **R-1 Stoppage reason-code master** — TM-FT-03 codes not yet provided; needed to seed the code master and map downtime to OEE later.
- **R-2 Machine/shift check sheets missing** — TM-09, DRAW-07, SLT-03, ANN-03 (GLI-ST), STP-02, HRPO-02 not shared; the start-of-shift check step will be stubbed until provided.
- **R-3 Furnace is 6 zones, not 4** — ANN-FT-01 records temperature zones I–VI (Min/Max) + speed + PNG/NH3; earlier "4 zones" is wrong. Model six.
- **R-4 Draw multi-pass genealogy** — drawing loops FUR→STP→Swage→DB→Centreless for passes 1–3; the record model must carry pass number and re-entry into Furnace/STP without creating duplicate journey rows (reuse dedup vectors). Decide pass modelling before the DRW table freezes.
- **R-5 Tube-mill identity** — the ERW stage is continuous (many coils → many cut tubes); for Phase-1 manual capture, key to WO + lot/coil per the log sheet and defer the run/coil/bundle refinement to when the tube-mill form is finalised.
- **R-6 Downstream WIs/formats not yet shared** — straightening (STR-01 exists), cutting/chamfering (FINISH-01/02, QA-06A exist), SRB, honing, NDT (ECT/UT/hydro), final inspection QP-01, oiling/pack/despatch — out of the four-process Phase-1 scope but flag for the full map.
- **R-7 Audit fixes** — H-1 (carryForward `_entry`), H-2 (`m1_app`/superuser), M-1 (service-token/tenant) must be resolved before multi-tenant go-live.
- **R-8 Windows/UTF-16** — `.ts` edits on Windows can corrupt to UTF-16 and break the Vite build.

## 15. Proposed implementation sequence (per brief §38, adapted)

1. **Audit** existing codebase + the four mapping workbooks (this document).
2. **Field dictionary** — already built (the four workbooks); reconcile each field to a target column.
3. **Gap vs DB** — diff mapping fields against existing `master`/`coil`/`txn` columns; list only the genuinely new columns.
4. **Reuse map** — bind each process to its nearest existing pattern (Furnace←ANN, cutting/per-machine←CTL, order/journey/shift/export shared).
5. **Minimal DB changes** — process/station seeds, the four `prod_*` tables + children, `data_source` column, masters; one migration set.
6. **Common process-form architecture** — a config-driven capture screen keyed by `process_id`, composing existing primitives.
7. **Furnace** (start here — closest to ANN, and most SCADA-ready for Phase 2).
8. **STP** (bath grid).
9. **Draw Bench** (multi-pass, per-machine like CTL).
10. **Tube Mill** (manual form now; PLC path deferred) and integrate all four into M1 navigation.
11. **Role-specific access & workflows** (Operator/Machine Head/Plant Head via existing scoping).
12. **Search & filtering** (server-side; date/range/process/machine/shift/operator/order/status).
13. **Audit trail** — reuse existing.
14. **Reusable export service** — add the four process export configs.
15. **Map each process to its exact export format**, then **end-to-end + permission + data-integrity + export testing** (per §33).
16. **Document PLC integration points** (§13) — done here; keep current as fields flip to AUTO in Phase 2.

---

## Bottom line

Phase 1 is an extension, not a new app. The platform already has the process registry, roles, coil/journey spine, shift/handover, capture lifecycle, offline operator, and a declarative export engine. The work is: add four `prod_*` tables + `data_source`, four Zod contracts, four capture screens (Furnace and Draw Bench largely reusing ANN and CTL), four export configs, and the process/machine seeds — built from the field dictionaries that already exist. The result reads as one M1 grown from the cold-rolling line into the full Tube Mill → Furnace → STP → Draw Bench route, with the PLC path documented and inert until Phase 2.

*Grounded in `zedral_test-share-the-code` (paths cited are real) and the A-59 controlled process route. No code has been written; this is the pre-build assessment the brief §39 requires.*
