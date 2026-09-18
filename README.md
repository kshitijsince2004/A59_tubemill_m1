# A59 Tube Mill M1

Zedral Module M1 (Data Capture) build for the Goodluck India A-59 ERW tube mill, Sikandrabad Unit 2.

## Folder layout

- **Dev Specs/** — Developer specifications and implementation plans.
- **Code/** — Standalone A-59 M1 application (API, UI, migrations, Docker).

## Netlify demo deploy

The `demo` branch ports the app for Netlify (static client + serverless Express + Netlify Database).

### Critical: do not paste `Code/.env` into Netlify

Local `.env` values like `DATABASE_URL=...@localhost:5433` and `SERVICE_TOKEN=dev-service-token` break the deployed API (`ECONNREFUSED 127.0.0.1:5433`).

| Set in Netlify | Do **not** set on Netlify |
|---|---|
| Enable **Data & Storage → Database** (injects `NETLIFY_DB_URL`) | `DATABASE_URL=...localhost:5433` — **delete it** |
| `SERVICE_TOKEN` = any strong secret | `PORT` |
| `TENANT_ID` (optional) | Docker credentials (`tubemill`/`tubemill`) |
| `AUTH_MODE=dev` or `static` | |
| `COLLECTOR_MODE=sim`, `BC_ADAPTER=file` | |

### Steps

1. Production branch = `demo`.
2. **Data & Storage → Database → Create/Enable**.
3. **Site configuration → Environment variables** → delete `DATABASE_URL` if it points at localhost.
4. Set a non-default `SERVICE_TOKEN`.
5. Redeploy. Check `/api/health` → `"db":"ok"`, `"hasNetlifyDbUrl":true`, `"databaseUrlIsLocalhost":false`.

**Auth note:** Neither `dev` nor `static` authenticates users. All `/api/*` routes are publicly reachable.

**Collector:** On Netlify, the sim PLC collector ticks on each `GET /api/tubemill/runs/:id/live` poll.

Local Docker/dev path is unchanged: `npm run migrate` + `npm run seed` against `docker compose` Postgres.

See [Code/README.md](Code/README.md) for local development.
