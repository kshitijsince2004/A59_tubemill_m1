# A59 Tube Mill M1

Zedral Module M1 (Data Capture) build for the Goodluck India A-59 ERW tube mill, Sikandrabad Unit 2.

## Folder layout

- **Dev Specs/** — Developer specifications and implementation plans.
- **Code/** — Standalone A-59 M1 application (API, UI, migrations, Docker).

## Netlify demo deploy

The `demo` branch ports the app for Netlify (static client + serverless Express + Netlify Database).

1. Connect the repo in Netlify with branch `demo` (or set production branch to `demo`).
2. Enable **Netlify Database** on the site (auto-provisions on deploy when `@netlify/database` is present).
3. Set environment variables:
   - `SERVICE_TOKEN` — required non-default secret (production/Netlify)
   - `TENANT_ID` — optional; defaults to demo UUID `00000000-0000-4000-8000-000000000001`
   - `AUTH_MODE=static` + `STATIC_APP_ROLE=OPERATOR` — default on Netlify (safer than `dev`)
   - Optional: `AUTH_MODE=dev` if you need the login role picker on a private demo URL
4. Deploy. Migrations under `netlify/database/migrations/` apply automatically (schema + reference seed).

**Auth note:** Neither `dev` nor `static` authenticates users. All `/api/*` routes are publicly reachable on the deploy URL. Prefer `static` so clients cannot assert `ADMIN` via `x-app-role`.

**Collector:** On Netlify, the sim PLC collector ticks on each `GET /api/tubemill/runs/:id/live` poll (no background timer).

Local Docker/dev path is unchanged: `npm run migrate` + `npm run seed` against `docker compose` Postgres.

See [Code/README.md](Code/README.md) for local development.
