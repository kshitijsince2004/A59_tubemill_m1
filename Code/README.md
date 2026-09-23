# A-59 Tube Mill M1

Operator capture platform for Goodluck India A-59 route: **Tube Mill → Furnace → STP → Draw Bench** (Zedral Module M1 digitization).

**Phase 1 (manual digitization):** four-process shell with paper-log capture for Furnace / STP / Draw Bench, plus the existing Tube Mill run console. AUTO-mapped fields are operator-enterable with `data_source=MANUAL`. PLC/SCADA ingest for FUR/STP/DRW is deferred to Phase 2.

Includes TM run console (TM-02 autofill, sim PLC collector, consumables/yield/export, BC file-plan adapter, RBAC + RLS + shift handover, offline outbox).

## Prerequisites

- Node.js 20+
- Docker Desktop (PostgreSQL + optional full stack)

## Local development

```powershell
cd "c:\dev\A59 Tube Mill M1\Code"
docker compose up -d db supertokens
copy .env.example .env
npm install
npm run build -w shared
npm run migrate
npm run seed
npm run dev
```

- **API:** http://localhost:3001/health  
- **UI (Vite):** http://localhost:5173  
- **SuperTokens Core:** http://localhost:3567/hello  

After login, use the top process nav: Tube Mill | Furnace | STP | Draw Bench (ACL-filtered). Admins see **Admin**.

`AUTH_ALLOW_HEADER_ROLE=true` (dev) allows `x-app-role` when no SuperTokens session. Production requires SuperTokens; unauthenticated calls return `401`.

### Process APIs

| Process | Prefix | Capture unit |
|---|---|---|
| Tube Mill | `/tubemill/...` | Run (`prod_tm_run`) |
| Furnace | `/furnace/...` | Charge (`prod_ann_run`) |
| STP | `/stp/...` | Lot (`prod_stp_lot`) |
| Draw Bench | `/drawbench/...` | Lot (`prod_db_lot`) + swage |

Draw Bench extras: Table-C bench suggest/eligibility (`GET /drawbench/benches/suggest`), Table-A inspection cadence on submit, Table-B paint/swage-end masters, XLSX reports **DB-FT-01 / DB-FT-03 / DB-FT-08**. Known freezes: full **DRAW-07** check sheet pending; DB-45/80/120 finished bands confirm on hard copy.

Lifecycle: `DRAFT → SUBMITTED → APPROVED` (+ HOLD). Export: `GET .../lots/:id/export?format=json|csv`.

### PLC seam (Phase 2 ready, inactive)

Every capture header has `data_source` (`MANUAL|PLC|SCADA|SENSOR|API`, default `MANUAL`). Phase 1 does not simulate PLC for Furnace/STP/Draw Bench.

### Bootstrap only

`npm run seed` and `npm run reset-db` wipe and reload reference data. Use for local bootstrap — not as a production runbook.

```powershell
docker compose down -v
docker compose up -d db
npm run migrate
npm run seed
```

Or: `npm run reset-db`.

## Production build

```powershell
npm run build
npm start
```

Serves API and `client/dist` from the same process (port `PORT`, default 3001).

### Netlify (demo branch)

`netlify.toml` at the repo root uses `base = "Code"`, builds `shared` + `client`, publishes `client/dist`, and mounts the Express app as a Function at `/api/*`. Schema + reference data live in `netlify/database/migrations/` (applied by Netlify Database). Set a non-default `SERVICE_TOKEN` in the Netlify UI.

On Netlify, set `SUPERTOKENS_CONNECTION_URI` (managed or self-hosted Core), `AUTH_ALLOW_HEADER_ROLE=false`, and a non-default `SERVICE_TOKEN`. Unauthenticated API calls return `401`.

```powershell
# Local Docker path remains:
docker compose up -d db
npm run migrate
npm run seed
npm run build
npm start
```

### Docker (API + DB)

```powershell
$env:SERVICE_TOKEN = "your-strong-token"
docker compose up --build -d
```

- UI + API: http://localhost:3001  
- Migrate runs as DB owner; app connects as `m1_app` (RLS).  
- Seed is **not** auto-run — after first migrate, bootstrap once:

```powershell
$env:DATABASE_URL = "postgresql://tubemill:tubemill@localhost:5433/tubemill"
npm run seed
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://tubemill:…@localhost:5433/tubemill` | App DB (prefer `m1_app` in prod) |
| `MIGRATE_DATABASE_URL` | (compose) | Owner URL for migrations |
| `PORT` | `3001` | HTTP port |
| `TENANT_ID` | fixed UUID | Bound tenant (never from client) |
| `AUTH_MODE` | `dev` / `static` in prod | Role source |
| `STATIC_APP_ROLE` | `OPERATOR` | Role when `AUTH_MODE=static` |
| `COLLECTOR_MODE` | `sim` | Only `sim` implemented; other values fail closed |
| `BC_ADAPTER` | `file` | Only `file` implemented; `odata` fails closed until UAT |
| `BC_BASE_URL` / `BC_TENANT` / `BC_CLIENT_ID` / `BC_CLIENT_SECRET` | (empty) | Reserved for live Dynamics OData (unused) |
| `SERVICE_TOKEN` | (required in prod) | `x-service-token` for `/internal/tubemill/ingest` |
| `CORS_ORIGIN` | `*` / `same-origin` in prod | Allowed origins |
| `BC_PLAN_PATH` | (optional) | Override path for legacy queue JSON; ERP sync uses `seeds/erp_*.json` |
| `YIELD_TOLERANCE_PCT` | `2` | Mass-balance warn threshold |

## ERP sync (Phase A + staged Phase B)

File BC stand-in (`BC_ADAPTER=file`). No live Dynamics OData until ERP supplies UAT + custom API pages.

**Runbook**

```powershell
npm run migrate
npm run seed
# As ADMIN (x-app-role or SuperTokens session):
# POST /api/erp/sync          — masters + Released orders → erp.raw_landing → masters / ops.queue_card / erp.released_order
# GET  /api/erp/health        — watermarks + outbox depth
# POST /api/erp/writeback/flush — STAGED jobs → LOGGED (demo file connector)
```

Seeds: `server/seeds/erp_masters.json`, `erp_orders.json`, `erp_codes.json`.

On **APPROVED** (TM / FUR / STP / DRW), Output/Consumption/Scrap payloads land in `erp.writeback_job` with `status=STAGED` (not posted live). Admin **Flush write-back** on the TM console advances STAGED → LOGGED and appends `ops.bc_writeback_log`.

FUR / STP / DRW capture headers use a WO dropdown from synced Released orders (`GET /api/erp/orders`).

**Gates (live Phase C blocked)**

| Gate | Blocker |
|---|---|
| OQ-03 | BC custom API pages for manufacturing entities (orders, routing, stop/scrap, lot) |
| OQ-13 | Sign-off to switch staged write-back to live posting |
| OQ-19 | UAT credentials / tenant + connector config |

Field mapping uses the Dev Spec MD §6 representative set until the Excel matrix workbook is added to the repo.

**Explicitly out of this build:** live OData client, ledger population, reconciliation, loss-in-INR, webhooks, WIP reclass.

## Plant build (TM → Draw Option C)

**Validation** — shared engine in `@a59/shared` (`validation/`). Server returns **422** with field `Issue[]` on ERROR; WARN persists. Client helper: `client/src/lib/validateForm.js`. Self-test: `npm run test:validation -w shared`.

**XLSX export** — ExcelJS `TemplateInjector` + layout JSON under `server/src/export/layouts/` (`DB-FT-01`, `ANN-FT-01`, `STP-FT-01A`, `TM-FT-02`). Programmatic blanks are written to `server/src/export/templates/` on first export. Drop controlled plant `.xlsx` files there to replace blanks (same layouts).

```
POST /api/furnace/export     { report: "ANN-FT-01", id? }
POST /api/stp/export         { report: "STP-FT-01A", id? }
POST /api/drawbench/export   { report: "DB-FT-01", id? }
POST /api/tubemill/export    { report: "TM-FT-02", id? }
```

**Genealogy** — `txn.material_lot` + `txn.process_handoff`. TM APPROVE publishes coil/bundle tags; FUR/STP/DRW/SWG pick upstream via `GET /api/genealogy/upstream`.

**SWG** — first-class tab + `/swage/lots` CRUD. Demo badge `OP-SWG01` / PIN `1234`.

**Stoppages** — `txn.stoppage_entry` extended with `process_code` + `source_id`; panel on FUR/STP/DRW/SWG. APIs: `/api/stoppages/*`.

**Acceptance**

- ERROR validation blocks save (client + 422)
- Export XLSX buttons place data in mapped cells
- TM approve → material lots appear in upstream pickers
- SWG tab ACL-gated; coded stoppages open/close on non-TM processes

## Auth

**SuperTokens** session auth (header Bearer tokens):

| Path | Who | How |
|---|---|---|
| Badge + PIN | All seeded users (`emp_code`) | `POST /api/auth/badge-pin` → SuperTokens session |
| Email + password | Staff (`ADMIN`, `MACHINE_HEAD`, `PLANT_HEAD`) | SuperTokens EmailPassword via `/api/auth` |
| Screen unlock | Authenticated | `POST /api/auth/verify-pin` |

Roles: `OPERATOR` · `MACHINE_HEAD` · `PLANT_HEAD` · `ADMIN`. Access is further scoped by `security.process_access` and `security.machine_access`. Machine Head approve/hold/first-off is machine-scoped via `machine_access`. `PLANT_HEAD` is read-only on mutations. `ADMIN` bypasses ACL and owns the **Admin** shell (`/admin/users`, `/admin/machines`, `/admin/master-data`, `/admin/validation-rules`, `/admin/planning`, `/admin/system`, `/admin/audit`). Process quality specs stay under Machine Head (`/quality/specs`).

| Env | Purpose |
|---|---|
| `SUPERTOKENS_CONNECTION_URI` | SuperTokens Core (local: `http://localhost:3567`) |
| `AUTH_STRICT` | Require hashed PINs (no `1234`/`0000` fallback) |
| `AUTH_ALLOW_HEADER_ROLE` | Dev only: accept `x-app-role` when no ST session |

Demo seed logins — **Badge ID + PIN** (primary path for everyone, including Machine Head / Admin):

| Badge ID | PIN | Role | Machines |
|---|---|---|---|
| `ADM-01` | `1234` | ADMIN | all |
| `PH-01` | `1234` | PLANT_HEAD | all (read) |
| `MH-01` | `1234` | MACHINE_HEAD | all |
| `MH-TM` | `1234` | MACHINE_HEAD | `A-59` |
| `MH-FUR` | `1234` | MACHINE_HEAD | `RHF-03`…`RHF-05` |
| `MH-STP` | `1234` | MACHINE_HEAD | `STP-LINE`, `STP-01` |
| `MH-DRW` | `1234` | MACHINE_HEAD | all draw benches |
| `MH-SWG` | `1234` | MACHINE_HEAD | `SWG-01` |
| `OP-A59` | `1234` | OPERATOR | `A-59` |
| `OP-RHF03` | `1234` | OPERATOR | `RHF-03` |
| `OP-RHF04` | `1234` | OPERATOR | `RHF-04` |
| `OP-RHF05` | `1234` | OPERATOR | `RHF-05` |
| `OP-STPLINE` | `1234` | OPERATOR | `STP-LINE` |
| `OP-STP01` | `1234` | OPERATOR | `STP-01` |
| `OP-DB10T` | `1234` | OPERATOR | `DB-10T` |
| `OP-DB20T` | `1234` | OPERATOR | `DB-20T` |
| `OP-DB40T` | `1234` | OPERATOR | `DB-40T` |
| `OP-DB45T` | `1234` | OPERATOR | `DB-45T` |
| `OP-DB80T` | `1234` | OPERATOR | `DB-80T` |
| `OP-DB120T` | `1234` | OPERATOR | `DB-120T` |
| `OP-DB180T` | `1234` | OPERATOR | `DB-180T` |
| `OP-DB250T` | `1234` | OPERATOR | `DB-250T` |
| `OP-SWG01` | `1234` | OPERATOR | `SWG-01` |

Optional staff email (after first badge login provisions SuperTokens):

| Email | Password |
|---|---|
| `admin@a59.local` | `Admin123!` |
| `planthead@a59.local` | `Plant123!` |
| `machinehead@a59.local` | `Super123!` |
| `mh.tm@a59.local` | `MhTm123!` |
| `mh.fur@a59.local` | `MhFur123!` |
| `mh.stp@a59.local` | `MhStp123!` |
| `mh.drw@a59.local` | `MhDrw123!` |
| `mh.swg@a59.local` | `MhSwg123!` |

Use **Badge / PIN** on the login screen (`POST /api/auth/badge-pin`). Session: `GET /api/auth/me`.

Local Core:

```powershell
docker compose up -d db supertokens
```

## Architecture

```
SimPlcDriver (adapter) → CollectorRunner → EventBus (tm.*)
       → CollectorIngestService → plc.sample / stoppages / bundles / tm_exception
UI ← GET /live
FileBcAdapter → ops.queue_card / ops.bc_writeback_log
```

Domain events published: `tm.run_opened`, `tm.setup_approved`, `tm.machine_state`, `tm.run_closed`, plus collector `tm.line_*` / `tm.piece_cut` / `tm.power_sample`.

Queue and writeback live in schema `ops`.

## Verification

```powershell
npm run build
npm run verify:phases -w @a59/server
npm run verify:rls -w @a59/server
# With API running and AUTH_ALLOW_HEADER_ROLE=true:
npm run verify:rbac -w @a59/server
npm run verify:state-machine -w @a59/server
```

## Out of scope (this package)

Real OPC-UA/Modbus, live Dynamics OData, Kafka, lift into `hsl_zedral_v1`, Plant Command Center / MH live dashboards (deferred past RBAC spine).

## Brand / UI

Follows Dev Specs brand and operator layout guidelines: light canvas, forest green `#163328`, steel gold `#F1B824` for END SHIFT / HOLD / PENDING, IBM Plex, fixed 64/52/104 chrome. PWA shell + IndexedDB outbox for offline mutating requests.
