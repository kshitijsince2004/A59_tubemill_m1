# Operator Tablet APK — architecture baseline (P1)

Recorded: 26 September 2026

| Area | Baseline |
|---|---|
| Client | React 18 + Vite 6; single web entry `index.html` → `main.jsx` → `App.jsx` |
| Operator surface | `/tm` `/fur` `/stp` `/drw` `/swg` + OperatorShell; lazy-loaded in App.jsx |
| Auth transfer | SuperTokens **header** bearer (server + client) |
| Auth storage (web) | sessionStorage for access/refresh; Capacitor Preferences planned for native |
| Offline | IndexedDB outbox (`a59-outbox`); 409 = success; continue on failure; max 8 attempts |
| Idempotency | `txn.idempotency_key`; duplicate only on Postgres 23505 |
| Capacitor / APK | Not present at baseline (size N/A) |
| API base | Relative `/api` on web; operator build uses `VITE_API_BASE` |
| Fail-closed plant | `DEPLOY_TARGET=windows` requires SuperTokens + non-default SERVICE_TOKEN |

Operator build output: `Code/client/dist-operator` (after `npm run build:operator -w client`).
