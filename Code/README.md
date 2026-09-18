# A-59 Tube Mill M1

Operator run console for Goodluck India A-59 ERW tube mill (Zedral Module M1 data capture).

**Phases 1–5 complete** (standalone package): run-centric capture, TM-02 autofill, sim PLC collector adapter, consumables/yield/CSV+JSON export, BC file-plan adapter, RBAC + RLS + shift handover, operator chrome (login, Live, History, action rail, offline outbox).

## Prerequisites

- Node.js 20+
- Docker Desktop (PostgreSQL + optional full stack)

## Local development

```powershell
cd "c:\dev\A59 Tube Mill M1\Code"
docker compose up -d db
copy .env.example .env
npm install
npm run build -w shared
npm run migrate
npm run seed
npm run dev
```

- **API:** http://localhost:3001/health  
- **UI (Vite):** http://localhost:5173  

`AUTH_MODE=dev` (default outside production) accepts `x-app-role` for local testing (set via Login screen). Production uses `AUTH_MODE=static` + `STATIC_APP_ROLE` only.

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

On Netlify, `AUTH_MODE` defaults to `static` / `OPERATOR` (no header role elevation). Endpoints are still unauthenticated — do not treat a public URL as secure.

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
| `BC_ADAPTER` | `file` | Only `file` implemented; other values fail closed |
| `SERVICE_TOKEN` | (required in prod) | `x-service-token` for `/internal/tubemill/ingest` |
| `CORS_ORIGIN` | `*` / `same-origin` in prod | Allowed origins |
| `BC_PLAN_PATH` | `seeds/queue_plan.json` | File BC plan adapter |
| `YIELD_TOLERANCE_PCT` | `2` | Mass-balance warn threshold |

## Auth

| Mode | Behavior |
|---|---|
| `dev` | Login screen sets role; `x-app-role` accepted |
| `static` | Role from `STATIC_APP_ROLE` only; client headers ignored |

Supervisor+: first-off, approve, lock, shift boundary. Admin: ERP sync, writeback, param-chart PATCH. `PLANT_HEAD` is read-only.

Session: `GET /tubemill/session` → `{ role, authMode, collectorMode, bcAdapter, tenantId }`.

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
npm run build -w shared
npx tsx server/src/verify-phases.ts
npx tsx server/src/verify-rls.ts
```

## Out of scope (this package)

Real OPC-UA/Modbus, live Dynamics OData, SuperTokens, Kafka, lift into `hsl_zedral_v1`.

## Brand / UI

Follows Dev Specs brand and operator layout guidelines: light canvas, forest green `#163328`, steel gold `#F1B824` for END SHIFT / HOLD / PENDING, IBM Plex, fixed 64/52/104 chrome. PWA shell + IndexedDB outbox for offline mutating requests.
