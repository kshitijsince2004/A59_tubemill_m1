# ZEDRAL — ERW Tube Mill (A-59) · System Architecture

**Goodluck India Limited · Sikandrabad Unit 2 · A-59 ERW Tube Mill · Module M1 (Data Capture)**
**Audience:** developers / IDE agent. Read this first, then `ZEDRAL_TUBEMILL_M1_A59_IMPLEMENTATION_SPEC.md` for the buildable detail.

This document is **self-contained**: it explains the existing Zedral platform this feature plugs into (so you do not need any other doc to understand the working), then the new PLC-first architecture for the tube mill and how data flows end to end.

---

## 1. What we are building, in one paragraph

The A-59 tube mill runs as a continuous ERW line: strip from many coils is welded end to end, formed and seam-welded into tube, then cut into pieces and banded into bundles. Module M1 captures this line's production **without asking operators to transcribe machine data**. A server-side collector reads the welder and line controls continuously; the server stores it against a **production run** (the capture unit for a continuous line); the operator tablet **confirms** machine values, **enters** only what a person must measure or judge, and **clears exceptions**. The six paper forms (production, downtime, hourly parameters, work-coil history, arc-weld current, edge milling) become views over one event stream and assemble themselves.

This is the first line built on the **PLC-first (v-next) architecture**. Every earlier process was tablet-driven manual capture; here the machine is the primary sensor and the tablet is a monitor plus exception surface.

---

## 2. The platform this builds on (primer)

The codebase is a TypeScript monorepo. It is layered and service-oriented, offline-tolerant, with stable contracts at every boundary so new modules attach without disturbing capture. Repo: `packages/` in the `zedral_test-share-the-code` (a.k.a. `hsl_zedral-main`) tree.

### 2.1 Technology stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript (Node) across server, shared, client |
| Validation contracts | **Zod** schemas in `@m1/shared-validation` (single source of truth for shapes, shared client + server) |
| DB access | **Kysely** typed query builder over **PostgreSQL** (schemas `master` / `coil` / `txn` / `planning` / `security` / `audit`) |
| Migrations | **node-pg-migrate** — JS files (`exports.up` / `exports.down`, `pgm.sql(...)`) under `packages/server/migrations/**`; JSON seeds under `migrations/seeds/` |
| Eventing | `@zedral/platform` event bus — `getEventBus()`, `buildEventEnvelope()`; pluggable `InProcessEventBus` (default) or `KafkaEventBus` |
| Canonical model | `packages/platform/src/canonical/` — `entities.ts`, `entityRegistry.ts`, `eventContracts.ts`, `eventSchemas.ts` (the shared vocabulary all modules speak) |
| Integration (Manifold) | `packages/connectors/` — connector `framework/` (`base.ts`, `registry.ts`) + `plugins/`; ERP write-back via `packages/platform/src/writeback/WritebackClient.ts` |
| Client | React **PWA**, offline-first, shop-floor tablets (`packages/client`) |
| Auth | SuperTokens session auth + badge/PIN (scrypt + `timingSafeEqual`); Postgres **RLS + FORCE RLS**, row-level line scoping |
| Serve / deploy | Docker (`Dockerfile`, `docker-compose.yml`), nginx (`nginx.conf`), on-prem plant server; Grafana provisioning under `deploy/monitoring/` |

### 2.2 Monorepo layout (the parts that matter here)

```
packages/
  platform/              @zedral/platform — cross-cutting runtime
    src/eventbus/        EventBus.ts, InProcessEventBus.ts, KafkaEventBus.ts, envelope.ts
    src/canonical/       entities.ts, entityRegistry.ts, eventContracts.ts, eventSchemas.ts
    src/writeback/       WritebackClient.ts  (ERP write-back)
    src/registry/        connector registry
    src/security/        auth/token helpers
    src/tenant/ middleware/ observability/
  connectors/            Manifold — ingestion/transform/mapping
    src/framework/       base.ts, registry.ts
    src/plugins/         connector plugins  (← the PLC collector lands here)
  shared-validation/     @m1/shared-validation — Zod contracts
    src/rules/m1Forms.ts baseProcessEntrySchema + per-process schemas + inferred types
  server/                @m1/server
    migrations/modules/m1/   node-pg-migrate files (+ seeds/)
    src/modules/m1-collection/   services/ProductionService.ts, routes/productionRoutes.ts, consumers/
    src/services/handover/       ShiftBoundaryService, carryForward, MachineHandoverService
    src/export/          dpr/ (dprFieldCatalog.ts, blankDprWorkbook.ts), layouts/ (dpr_layout.v1.json), shiftSummary/, render/
    src/repositories/ db.ts context.ts
  client/                @m1/client — React PWA
```

### 2.3 The canonical model + event bus (the integration backbone)

Modules never write each other's tables. They publish **domain events** onto the bus and read canonical entities. Existing event contracts (`canonical/eventContracts.ts`) already include the ones the tube mill needs:

- `ProductionCountedEvent { countId, assetId, quantity, uom, countedAt, lineageRef }`
- `DowntimeLoggedEvent { stoppageId, stoppageCode, category, fromTime, toTime, durationMin, prodDate, lineageRef }`
- `DefectLoggedEvent { defectId, processId, entryId, coilNo?, defectCode, quantityMt? }`
- `ShiftClosedEvent { shiftLogId, processId, totalProdMt, closedAt }`

The tube mill adds a small set of run/machine events (§4.4). The rule to keep: **the collector and the capture module publish events; downstream modules (M4 OEE, M5 Yield, and so on) consume them.** M1 is the system of record for capture and exposes a BI read replica; consumers never write M1 tables.

### 2.4 Manifold — the connector framework (where the PLC collector lives)

Manifold is the ingestion/transform/mapping layer. A source is a **connector plugin** built on `connectors/src/framework/base.ts` and registered in the connector registry. Existing/expected sources: CSV, Excel, API, DB. **The PLC/SCADA collector is a new connector plugin** — the same framework, a new driver. This matters: the PLC-first path is not a bolt-on; it is a Manifold source that maps machine tags to canonical fields exactly like any other source, so the collector and the historical WinCC exports converge on one model.

### 2.5 Multi-tenant, RLS, offline capture

- **Tenancy:** every row carries `tenant_id`; RLS + FORCE RLS on core tables; requests carry tenant context (`getTenantId()`). Goodluck A-59 is a new tenant. **Before onboarding a second tenant, run the app as the `m1_app` role (NOBYPASSRLS), not the Postgres bootstrap superuser** (audit finding H-2), and stop trusting `x-tenant-id` from the service-token header (M-1).
- **Capture lifecycle:** DRAFT → SUBMITTED, then Shift In-charge APPROVE → LOCK; post-lock edits require an audit-logged change request. Offline-tolerant: the PWA queues locally and syncs on reconnect. The collector applies the same store-and-forward when the server link drops.

---

## 3. Why the tube mill needs a new shape

Every existing process captures **one coil on one machine, scoped to a shift** (the COIL_NO spine). The tube mill breaks that: many coils are consumed into one continuous ribbon and emerge as many bundles; the joint tube is deliberately scrapped. So the capture unit is the **production run** (one mill, one setup, one size/grade, one or more work orders, possibly spanning shifts), with a **coil-input fan** (material in) and a **bundle-output fan** (material out). This is the single structural difference from every other line; everything else reuses the platform above. Full rationale and model: implementation spec §0–§1.

---

## 4. The PLC-first architecture (the new part)

### 4.1 Three tiers and the data flow

```
  ┌────────────────────────────────────────────────────────────────────────────┐
  │  A-59 OT NETWORK (isolated subnets 192.168.2.x / 10.0.0.x, 17 controllers)  │
  │   Welder SCADA (Thermatool / AB-MicroLogix)   Line PLCs   COC saw counter   │
  └───────────────┬────────────────────────────────────────────────────────────┘
                  │  OPC-UA / Modbus TCP / WinCC CSV   (read-only, one direction)
                  ▼
  ┌────────────────────────────┐    time-series      ┌──────────────────────────┐
  │  COLLECTOR (connector      │  ───────────────►    │  plc.sample  (raw TS)    │
  │  plugin, on L1 server)     │    events            │  plc.collector_health    │
  │  - poll tags               │  ───────────────►    └──────────────────────────┘
  │  - debounce run/stop       │        │
  │  - count saw cuts          │        ▼  bus events (buildEventEnvelope → getEventBus)
  │  - store-and-forward       │   tm.line_started / tm.line_stopped / tm.piece_cut / tm.power_sample
  └────────────────────────────┘        │
                                        ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  SERVER (@m1/server)                                                        │
  │   Run engine (state machine) · hourly rollup · TM-02 band check · exceptions│
  │   canonical store (txn.prod_tm_*, master.*)  +  BI read replica            │
  │   HTTP API (routes)  ◄──────────────────────────────────────────────────┐  │
  │   Writeback → Dynamics 365 BC (plan read now, actuals write-back later)  │  │
  └───────────────────────────────────────────────────────────────────────┼──┘
                                        ▲                                   │
                    reads live values / posts entries                      │
                                        │                                   │
  ┌─────────────────────────────────────┴───────────────────────────────────┐ │
  │  TABLET (React PWA)  — monitor + confirm + exception                      │ │
  │   live machine strip · tooling confirm · manual measures · bundle fan ────┘ │
  │   stoppage coding · first-off gate · hold/defect                            │
  └─────────────────────────────────────────────────────────────────────────────┘
```

Key invariant: **only the collector touches PLCs.** The tablet reads from the server API and never opens a PLC connection.

### 4.2 Collector (connector plugin)

- Home: `packages/connectors/src/plugins/plc-a59/` (new), built on `framework/base.ts`, registered in the connector registry; deploy config under `deploy/connectors/`.
- Per-controller driver: OPC-UA where available, else Modbus/TCP poll, else the WinCC CSV export path (e.g. the 10 a.m. daily e-mail) through the normal Manifold CSV connector. **[dev-decision]** driver per controller, from the O-2 tag survey.
- Responsibilities: (a) buffer time-series into `plc.sample`; (b) **debounce** the line run/stop signal into stoppage open/close; (c) **count** the COC saw cut signal into piece counts; (d) heartbeat + **store-and-forward** on link loss. It emits bus events (§4.4) and maps tags → canonical via Manifold field-mapping; it does not write module tables.

### 4.3 Server responsibilities

- **Run engine:** owns the mill state machine (spec §7), opens/closes runs, enforces the first-off gate, books setup pieces as scrap.
- **Rollup:** aggregates `plc.sample` into hourly `txn.prod_tm_param_snapshot` (replaces the manual hourly form) and net runtime.
- **Band check:** compares live speed/power to the `master.tm_param_chart` window for the run's size+grade; raises an out-of-band **exception** the tablet must surface.
- **API + writeback:** serves the tablet; pulls work orders / RM coils from Dynamics 365 Business Central via `WritebackClient` (OData), writes actuals back later.

### 4.4 Tube-mill event contracts (add to `canonical/eventContracts.ts`)

Reuse `ProductionCountedEvent` (piece cut → count), `DowntimeLoggedEvent` (stoppage), `DefectLoggedEvent`. Add:

```ts
export interface RunOpenedEvent   { runId: string; millCode: string; workOrderNo: string; sizeKey: string; gradeCode: string; openedAt: string; }
export interface SetupApprovedEvent { runId: string; setupId: string; firstOffResult: 'PASS'|'FAIL'; approvedBy: string; approvedAt: string; }
export interface MachineStateEvent { millCode: string; runId?: string; state: 'IDLE'|'SETUP'|'FIRST_OFF_PENDING'|'RUNNING'|'STOPPAGE'|'ROLL_CHANGE'|'RUN_COMPLETE'; at: string; }
export interface PowerSampleEvent  { millCode: string; runId?: string; speedMpm?: number; powerKw?: number; currentAmp?: number; inBand: boolean; at: string; }
export interface RunClosedEvent    { runId: string; millCode: string; rawMaterialMt: number; acceptedMt: number; yieldPct: number; closedAt: string; }
```

Also extend `DowntimeLoggedEvent.category` union to the full loss taxonomy (`OPN | ELECT | MECH | UTILITY | POWER | PLANNED | OTHER`) so tube-mill stoppages map cleanly to OEE later.

### 4.5 Deployment topology

- **L1 server** (on-prem, per the Goodluck roadmap): Postgres primary + BI read replica, the server app, and the collector plugin. nginx + TLS in front; Docker compose as today.
- **OT boundary:** the collector has a one-way, read-only reach into the two OT subnets; no tablet and no cloud path touches OT. ERP (Dynamics 365 BC) sits on IT, reached over OData.
- **Devices:** shop-floor tablets on plant Wi-Fi, PWA, offline-tolerant.

---

## 5. Security & governance

- Roles: OPERATOR (own mill) · SHIFT IN-CHARGE/SUPERVISOR (approve, first-off, multi-mill) · PLANT HEAD (read-only analytics) · ADMIN (masters, machine + param-chart CRUD, integration). Row-level mill scoping via `security.line_access`.
- Carry the audit fixes before go-live: app runs as `m1_app` (H-2); constant-time service-token compare and no header-trusted tenant (M-1); the `carryForward.ts` `_entry`-suffix bug must be fixed and the tube-mill process added to its map (H-1) so shift handover carries open runs.
- OT isolation: PLC access is read-only and confined to the collector; no write path to machine controls exists in this system.

---

## 6. Where to go next

Build detail, DDL, contracts, API and phases: **`ZEDRAL_TUBEMILL_M1_A59_IMPLEMENTATION_SPEC.md`**. Open questions that gate schema freeze are listed there (§14) and summarised in the Dev Specs `README.md`.
