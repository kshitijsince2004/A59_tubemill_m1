# Zedral M1 (A-59 Tube Mill) Engineering Audit

**Application:** `A59_tubemill_m1` (Module M1, Data Capture) for Goodluck India Limited, Sikandrabad A-59 line
**Scope of build:** Phase 1 manual digitization, four processes plus swage: Tube Mill, Furnace, STP, Draw Bench
**Audit type:** End to end technical due diligence, production readiness and pre launch engineering review
**Date:** 23 September 2026
**Basis:** Full static inspection of the uploaded codebase (server, client, shared, migrations, deploy config, dev specs) cross checked against the A-59 controlled process route and the Phase 1 implementation assessment. No runtime, database, SuperTokens core, or Business Central instance was available, so runtime dependent behaviour is marked Not Verifiable.

---

## A. Executive Summary

This is a real, coherent, feature complete Phase 1 product, not a prototype. The engineering is above the bar you usually see at this stage: a clean layered server (routes, services, shared validation), a normalized Postgres schema with foreign keys, indexes and row level security, a role based access model enforced server side on every process router, a PWA client with an offline outbox, a declarative export engine, an ERP writeback job ledger, and a documented PLC ingestion seam kept inert until Phase 2. The `TODO`/`FIXME`/`not implemented` count across roughly 40,000 lines is 7, and all 7 are intentional guards (unsupported PLC driver, unsupported BC adapter). That is a strong maturity signal.

The gap between where it is and production is concentrated, not diffuse. The single largest issue is authentication: in the deployed configuration the app does not authenticate end users by default, and the fallback paths that make the demo usable (static role, header supplied role) grant full process access without credentials. Alongside that sit three other credential weaknesses (a deterministic SuperTokens password that bypasses the PIN lockout, a null hash PIN backdoor, and shipped default secrets), a data integrity gap (no multi statement transactions, so multi step production writes are not atomic), a deployed export failure (7 of 10 report templates are missing and the fallback writes to a read only filesystem on Netlify), and the absence of a client error boundary, structured logging and automated tests.

None of these require a rewrite. The architecture is sound and most blockers are hardening and configuration rather than redesign. Realistic effort to a genuinely production ready, single plant pilot is measured in weeks, not months, with authentication and transactional integrity as the two items that must be resolved before any real user data is captured.

**Overall production readiness: Not ready for a live, authenticated Goodluck deployment. Ready as a supervised pilot or demo once authentication is enforced and the P0 items below are closed.**

---

## B. System Architecture

### Stack

Monorepo with npm workspaces: `shared`, `server`, `client`.

- **Server:** Node plus Express 4, `pg` for Postgres, SuperTokens (`supertokens-node`) for sessions, `exceljs` for report rendering, `serverless-http` for the Netlify function port. Source is authored in a TypeScript flavoured JS and built with Babel (a TS to JS migration was performed; see the migration plan in Dev Specs).
- **Client:** React 18, Vite 6, React Router 7, `@tanstack/react-query`, `supertokens-web-js`, a hand written service worker plus IndexedDB outbox for offline capture.
- **Shared:** Zod form schemas and a custom field level validation ruleset engine used by both tiers.
- **Database:** PostgreSQL, schemas `master` / `txn` / `plc` / `erp` / `security` / `ops` (plus `demo` in the local set). Multi tenant by a fixed `tenant_id` with row level security and `FORCE ROW LEVEL SECURITY` on core tables.
- **Deploy:** Netlify. Static client from `client/dist`, the whole Express app wrapped as one serverless function (`netlify/functions/api.js`), Netlify Database (Neon) for Postgres.

### Request flow (traced, Tube Mill run open, representative)

```
Operator UI (TubeMillRunConsole.jsx)
  -> api/http.js apiRequest: adds Authorization or x-app-role, Idempotency-Key,
     queues to IndexedDB outbox if offline
  -> Express app.js: CORS, express.json, SuperTokens middleware, routers mounted
     twice (at "/" and at "/api")
  -> tubeMillRoutes: router.use('/tubemill', authMiddleware) then requireAuth +
     requireProcessAccess('TM', READ|WRITE); route handler validates body with a
     Zod schema (openRunSchema.safeParse)
  -> RunService.openRun: getQueueCard -> INSERT txn.prod_tm_run -> markQueueInProgress
     -> publishRunOpened / publishMachineState (in process event bus)
  -> db/pool.query: BEGIN; set_config('app.tenant_id'); <statement>; COMMIT
  -> Postgres (RLS policy: tenant_id = current_setting('app.tenant_id'))
  -> response envelope { data, errors }
```

### Layering and separation of concerns

Clean. Routes handle transport, auth guards and input parsing; services hold business logic and own all SQL; `shared` holds contracts and validation; a small event layer (`InProcessEventBus`, `DomainEvents`) decouples side effects like ERP writeback and genealogy. The collector, ERP and export subsystems are isolated behind their own folders with adapter interfaces (`SimPlcDriver` vs `UnsupportedPlcDriver`, `FileBcConnector` vs a future OData connector). This is the right shape and it is the reason most findings below are localized.

### Role and access model

Four roles: `OPERATOR`, `MACHINE_HEAD`, `PLANT_HEAD`, `ADMIN` (a former `SUPERVISOR` role was removed, see migration 027 and the supervisor removal spec). Authorization is rank based plus per process and per machine ACLs (`security.process_access`, `security.machine_access`), enforced by middleware (`requireAuth`, `requireRole`, `requireProcessAccess`, `requireMachineAccess`, `requirePlantHead`, `requireAdmin`). Every process router applies `authMiddleware` and `requireAuth` before its handlers, and mutating routes add role or process guards. The client mirrors the model for routing (`RoleRoute`) but the server is the enforcement point.

---

## C. Complete Findings

Severity key: Critical (production and safety blocker), High, Medium, Low, Informational. Confidence is Confirmed (evidence in code), Potential (likely but runtime dependent), or Not Verifiable (needs a running environment).

| ID | Finding | Category | Severity | Confidence | Evidence (file:line) | Impact |
|---|---|---|---|---|---|---|
| F1 | Deployed auth does not authenticate end users by default. With SuperTokens unset, `superTokensEnabled=false`; the static and header fallbacks either 401 everything (unusable) or, when enabled to make the demo work, grant a user with APPROVE on all processes and no credential check. README states plainly that neither dev nor static mode authenticates users and "All /api/* routes are publicly reachable". | Auth / Security | Critical | Confirmed | `config.js:51-96`; `authMiddleware.js:90-137`; `README.md` auth note | Anyone reaching the URL can read and write production data as any role |
| F2 | Header supplied role trust allows role spoofing when `allowHeaderRole` is on. `x-app-role: ADMIN` yields ADMIN with APPROVE on all five processes, no auth. This is the same switch the Netlify demo relies on to function. | Auth / Security | High | Confirmed | `authMiddleware.js:90-137`; `config.js:93-96` | Trivial privilege escalation to ADMIN if the switch is ever set in a shared or real deployment |
| F3 | Deterministic SuperTokens credentials create a parallel login that bypasses the PIN lockout. Email is `empCode@a59.local`; password is a hardcoded demo map or `A59-<first 8 of user_id>!`. The EmailPassword recipe and SuperTokens middleware are mounted, so `POST /auth/signin` accepts these. `user_id` is returned by `/auth/me`, `/tubemill/session` and in `created_by` fields, so the needed prefix is discoverable. | Auth / Security | High | Confirmed | `authService.js:108-142`; `authConfig.js:29-30` | Bypasses the 4 digit PIN and its 5 try lockout with a guessable password |
| F4 | PIN backdoor for users with no hash. `verifyPin` returns true for `0000` or `1234` when `pin_hash` is null and `authStrict` is false. `authStrict` is false in dev and any env with `AUTH_STRICT=false`. | Auth / Security | High | Confirmed | `pinService.js:23-29` | Any hash-less account is accessible with two well known PINs |
| F5 | Shipped default and shared secrets. `SERVICE_TOKEN` defaults to `dev-service-token`; DB creds `tubemill/tubemill`; every seeded user shares PIN `1234`; SuperTokens demo passwords are hardcoded (`Admin123!` and similar). `assertProductionSecrets` only warns (does not fail) on Netlify plus dev auth. | Security / Config | Medium | Confirmed | `config.js:63,129-144`; `seed.js:470,718-725`; `authService.js:112-121` | Predictable credentials in any environment seeded from defaults |
| F6 | No multi statement transactions in business operations. `query()` wraps each single statement in its own BEGIN/COMMIT for the tenant GUC; no service uses a shared client transaction (0 of 36 services call `pool.connect()`). Multi write operations are not atomic. | Data integrity | High | Confirmed | `db/pool.js:88-118`; `RunService.js:119-176,655-903`; services grep | A failure mid operation leaves partial state (run created but queue not updated, rollups not recomputed), corrupting the production and traceability record |
| F7 | Export templates missing and the fallback fails on Netlify. 10 reports are registered but only 3 `.xlsx` templates exist on disk; the other 7 fall back to a generated blank grid, and `ensureTemplate` does `fs.writeFileSync` into the bundle directory, which is read only on the Netlify function filesystem. | Integration / Deploy | High | Confirmed | `ReportExportService.js:18-88,176-184`; `export/templates/` (3 files) | 7 of 10 FT report exports do not match the approved GLI form, and error outright in the deployed environment |
| F8 | No client error boundary. No `ErrorBoundary`, `componentDidCatch` or `getDerivedStateFromError` anywhere; a render error white screens the whole app with no fallback. | Reliability / UX | High | Confirmed | grep across `client/src` (0 matches); `main.jsx` | A single component fault takes down the operator console mid shift |
| F9 | Access token in localStorage and grants trusted client side. The JWT is stored in both `sessionStorage` and `localStorage`, and the user grant object drives client routing. Server enforces authorization, so this is token theft exposure (XSS), not a data bypass. | Security | Medium | Confirmed | `authStore.js:19-54`; `http.js:25-33` | XSS can exfiltrate a valid session token |
| F10 | `/auth/supervisor-override` is unauthenticated and decoupled from the action it authorizes. It verifies a badge plus PIN and returns the authority's grants but creates no session and is not bound to the specific privileged write, so enforcement depends on the client honoring it. Also usable to probe badges and PINs (rate limited per user only). | Auth / Security | Medium | Confirmed | `authRoutes.js:85-109`; `authService.js:244-292` | Override authorization is advisory; a crafted client can request it without performing the guarded action, or probe credentials |
| F11 | Idempotency claim swallows all errors. `claimHttpIdempotency` treats any insert failure (including transient DB errors) as a duplicate and returns 409. | Correctness | Medium | Confirmed | `RunService.js:948-955` | Real errors are misreported as duplicate submissions |
| F12 | Offline outbox can be poisoned. `flushOutbox` stops on the first failure (`break`) and never deletes an item that replays to a 409 (server already claimed the key), so one stuck item blocks the whole queue forever. The stored bearer token can also expire before flush. | Reliability / Offline | Medium | Confirmed | `offline/outbox.js:51-84`; `http.js:63-72` | Offline captures can silently stop syncing |
| F13 | Two divergent migration histories. `server/migrations` (001-031, with `m1_app` role and a `demo`->`ops` rename) versus `netlify/database/migrations` (0001-0031, a consolidated 0001 bootstrap, no `m1_app`), applied by different mechanisms. Documented as intentional but hand kept in sync. | Architecture / Deploy | Medium | Confirmed | `db/migrate.js:6`; `netlify/.../0001_schema.sql` header; file listings | Schema drift risk between dev and the deployed database |
| F14 | Split validation strategy. Tube Mill validates with Zod schemas (19 `safeParse` calls) but never calls the shared business ruleset (`assertValid`); Furnace, STP, Draw Bench and Swage call `assertValid` and do not use Zod. The Tube Mill band and range rules in `shared/validation/rulesets/tubemill.js` are not enforced on TM writes. | Consistency / Correctness | Medium | Confirmed | routes grep: `assertValid` (no TM), `safeParse` (TM only); `ValidationGate.js` | Tube Mill parameter business rules are advisory client side only; two parallel validation systems to maintain |
| F15 | Per query transaction overhead. Every read and write incurs BEGIN plus `set_config` plus statement plus COMMIT, three extra round trips per statement, on serverless Neon. | Performance | Medium | Confirmed | `db/pool.js:88-118` | Latency multiplied on every call; worse under connection setup cost |
| F16 | N plus 1 in list and enrich paths. `listRuns` runs per run defaults plus setup queries (50 runs to 100 plus statements). `getRun`, called before and after every mutation, runs production buckets plus slit plus a month to date SUM plus setup plus defaults. | Performance | Medium | Confirmed | `RunService.js:178-208,350-366,913-946` | A single coil POST triggers roughly ten statements; list views scale poorly |
| F17 | No route level code splitting. `App.jsx` eagerly imports all pages (FurnaceCapture 2043 lines, StpCapture 1559); no `React.lazy`/`Suspense`. | Performance / UX | Medium | Confirmed | `App.jsx:1-66`; grep `lazy` (0) | Large single bundle, slow first load on shop floor tablets |
| F18 | Observability is `console.*` only (65 server calls), no structured logging, request IDs, metrics, tracing or error aggregation. A `plc.collector_health` heartbeat exists but has no alerting. | Observability | Medium | Confirmed | grep `console.` server; `CollectorRunner.js:60-70` | Hard to diagnose production incidents; no signal when the collector or DB degrades |
| F19 | No automated tests. Only hand run smoke and verify scripts (`verify-rls`, `verify-rbac`, `smoke-*`); no test framework or CI config. | Testing / DX | Medium | Confirmed | `server/package.json`; no jest/vitest dep | Regressions ship undetected; RBAC and RLS checks are manual |
| F20 | ERP writeback field bug and terminal failures. `enqueueTmWriteback` reads `coils[0]?.coil_id` but the column is `coil_tag`, so `lotNo` silently falls back to the batch number. `flushWriteback` never retries `FAILED` jobs and never uses `attempts` for backoff. | Integration / Correctness | Low | Confirmed | `ErpWritebackService.js:47,200-242` | Wrong lot number on TM writeback; failed jobs stick permanently |
| F21 | `bundle_no` allocation race. `MAX(bundle_no)+1` then insert; concurrent writes collide on the unique index and surface as a 400 or 500. | Concurrency | Low | Confirmed | `RunService.js:25-31,405-444` | Low risk at single operator scale, unhandled if concurrent |
| F22 | Collector in memory state does not survive serverless. `lastRunState`, `lastCutCount`, `tagCache`, `eventBuffer` are module Maps; on Netlify the on demand tick cannot reliably detect line start or stop or piece cuts. Mostly dormant because manual runs are skipped. | Integration | Low | Confirmed | `CollectorRunner.js:10-13,117-189`; `api.js:20-22` | The auto PLC path is non functional in the deployed model (by design for now) |
| F23 | Routers mounted twice (root and `/api`). Doubles the URL surface; both spellings are reachable. | Architecture | Low | Confirmed | `app.js:94-120` | Larger surface, potential confusion in guards and logs |
| F24 | Mixed source artifacts from the TS to JS migration. Some files are hand written JSX, others contain Babel compiled `_jsx()` calls in source. | Tech debt | Low | Confirmed | `main.jsx`; `HoldDefectDialog.jsx` vs `RoleRoute.jsx` | Inconsistent, harder to read and edit |
| F25 | Accessibility gaps. Zero `htmlFor` label associations; sparse aria (80 across roughly 100 components). Loading states are sparse (14 signals) relative to strong empty and error coverage. | UI / Accessibility | Low | Confirmed | grep `htmlFor` (0), `aria-`/`role=` (80), loading (14) | Inputs not programmatically labelled; some views blank during fetch |
| F26 | CORS reflects any origin with credentials in non production (`origin:true, credentials:true`). Dev only. | Security | Low | Confirmed | `app.js:36-60` | Not an issue in prod (`same-origin`), but risky if `CORS_ORIGIN=*` reaches prod |
| F27 | Badge and username enumeration via response timing (scrypt runs only when the user exists). | Security | Low | Confirmed | `authService.js:148-198` | Attacker can distinguish valid badges |
| F28 | Idempotency and writeback tables have no TTL or cleanup; they grow unbounded. | Scalability | Low | Confirmed | `RunService.js:948-955`; `erp.writeback_job` usage | Slow table growth over years of operation |
| F29 | Partial RLS coverage. RLS with FORCE is enabled on core Tube Mill, ERP and draw bench tables, but many later feature tables (furnace, STP detail) are not confirmed under RLS. Single tenant deployment limits impact. | Database / Security | Low | Confirmed | migrations grep: RLS on 10 of 31 files | Defense in depth is uneven; matters only if multi tenant |

---

## D. Critical Issues (address immediately)

1. **F1 Authentication is not enforced in the deployed configuration.** This is the one item that makes everything else moot. Until real user authentication is required for every `/api/*` route in the deployed environment, any person or bot that reaches the URL can read and mutate production and traceability data as any role. This must be closed before a single real Goodluck record is captured.

2. **F6 Production writes are not atomic.** For a system whose entire purpose is a trustworthy manufacturing and genealogy record, non atomic multi step writes are a correctness defect, not just a robustness one. A dropped connection between "create run" and "mark queue in progress", or inside the production quantity upsert loop and its rollup, leaves the record internally inconsistent with no error surfaced to the operator.

These two are the true blockers. F3, F4, F5 (the other credential weaknesses) are High and should be closed in the same auth work.

---

## E. Production Blockers

Everything that must be resolved before a live, authenticated, single plant Goodluck deployment:

- **F1** Enforce SuperTokens (or another real IdP) for all `/api/*` routes in the deployed build; make `allowHeaderRole` impossible in production (fail fast if set).
- **F2, F3, F4** Remove or hard gate the header role path in production; remove the deterministic SuperTokens password fallback and the null hash PIN backdoor; require explicit credential provisioning.
- **F5** Fail the boot (do not warn) when `SERVICE_TOKEN`, DB credentials, or seeded PINs are still defaults in any non local environment. Force a credential rotation and per user PIN set on first login.
- **F6** Wrap multi step service operations in a single DB transaction (see Roadmap for the concrete pattern).
- **F7** Ship all 10 report templates, or make the blank fallback write to a writable path (`/tmp` on Netlify) and verify each export renders the approved GLI layout.
- **F8** Add a root React error boundary with a safe fallback and an offline banner.
- **F13** Establish one source of truth for the schema, or an automated check that the two migration sets are equivalent, before the deployed DB and dev DB drift.
- **F18, F19** Minimum viable observability (structured logs with request IDs, DB and collector health alerting) and a smoke test that runs the RBAC and RLS verify scripts in CI.

---

## F. Technical Debt

- **F13 Dual migration histories.** The deployed schema is a hand maintained consolidation separate from the dev migration chain. This will drift; the cost lands later as a "works in dev, breaks in prod" incident that is expensive to diagnose. Highest leverage debt to retire.
- **F14 Two validation systems.** Zod for Tube Mill, the ruleset engine for the rest. Beyond maintenance cost, it means Tube Mill business rules are not enforced server side. Converging on one approach (the ruleset engine, since it supports DB overlays and severities) removes a class of "why did this rule not fire" bugs.
- **F16, F15 Query pattern.** The per query transaction plus N plus 1 access pattern is cheap to live with at pilot volume and expensive at scale. It is debt because it is woven through the services; addressing it well means a `withTransaction(client => ...)` helper and batching, which also fixes F6.
- **F24 Migration artifacts.** Mixed compiled and hand written JSX in source is low impact but signals the TS to JS migration was not fully cleaned up. Left alone it slowly erodes readability.
- **F17 No code splitting** and **F23 double mounting** are structural conveniences that will cost bundle size and surface area as the app grows into the remaining plant stages.
- Large files (StpService 1060, DrawBenchService 1018, FurnaceService 958, FurnaceCapture 2043, StpCapture 1559 lines) are approaching the size where they should be decomposed.

Future impact: if the roadmap adds the remaining plant stages (pickling, slitting, straightening, finishing, NDT, QP-01) on top of this base without retiring F13 and F14 first, each new process doubles the migration sync burden and inherits the split validation. Retire those two before widening scope.

---

## G. Security Findings (consolidated)

The security posture is a demo posture, and the code is honest about it (the README states routes are publicly reachable). The mechanisms for a real posture exist (SuperTokens, scrypt PINs with lockout, RBAC, RLS, timing safe comparisons, service token guard on the ingest endpoint), they are simply not wired to fail closed.

- **Critical:** F1 no enforced authentication in deployment.
- **High:** F2 header role spoofing, F3 deterministic SuperTokens password bypassing lockout, F4 null hash PIN backdoor.
- **Medium:** F5 default and shared secrets, F9 token in localStorage, F10 unauthenticated supervisor override and credential probing.
- **Low:** F26 permissive dev CORS, F27 badge enumeration by timing, F29 uneven RLS coverage.

What is done well and should be preserved: scrypt with per PIN salt and `timingSafeEqual` (`pinService.js`), per user PIN lockout (5 fails, 15 minute lock), the `x-service-token` guard with constant time comparison on the internal ingest route, parameterized SQL everywhere (no string concatenated queries were found, so SQL injection risk is low), tenant scoping via a GUC rather than request headers, and no `dangerouslySetInnerHTML` or `eval` in the client (low XSS surface aside from the localStorage token).

No evidence of SQL injection, command injection, SSRF, or insecure deserialization was found. Input is parameterized and, for most processes, schema validated.

---

## H. Performance Findings (by expected impact)

1. **F15 plus F16 combined** are the dominant real cost. Because every statement is its own transaction and the run enrich path fans out into five or more statements, a single operator action can be ten to fifteen round trips, and a 50 row run list can be 100 plus. On serverless Postgres with per statement latency this is the difference between snappy and sluggish on a tablet over plant wifi. Practical fix: a `withTransaction` helper that sets the tenant GUC once and runs the whole operation on one client (this also fixes the atomicity blocker F6), plus collapsing the list and enrich queries into set based SQL or a single joined query.
2. **F17 bundle size.** No lazy loading means the first paint pulls the entire app including the 2000 line capture pages. Route level `React.lazy` on the five capture pages and the admin and plant sections would cut initial load materially. Verify with a production `vite build` bundle report (not run here).
3. **F22 collector** polling is suppressed on Netlify and dormant for manual runs, so it is not a current cost, but if the auto path is revived the 2 second interval doing a `getRun` per active run will N plus 1 again.
4. Client polling (Tube Mill console, plant live dashboard, STP monitor) is present and, verified, clears its intervals on unmount, so there are no timer leaks. Confirm poll intervals are not tighter than needed.

---

## I. UI / UX Findings (actionable only)

- **F8 error boundary** is the highest UX risk: any uncaught render error blanks the console. Add a boundary with a "reload / your data is saved offline" fallback.
- **F25 form labels:** inputs have no `htmlFor` association (0 found). For a gloved, industrial tablet context and for basic accessibility, associate every input with its label (fix once in the shared `ZInput` component and it propagates).
- **F25 loading states:** empty and error states are well covered (131 and 268 signals) but explicit loading states are sparse (14). Add skeletons or spinners on the capture and dashboard fetches so views do not flash blank.
- The information architecture is strong: role based homes, a process switcher gated by access, dedicated Machine Head, Plant Head and Admin shells, and consistent `{data, errors}` handling with toasts. The offline banner and sync status badge are good shop floor touches. No aesthetic only changes are recommended.

---

## J. Quick Wins (high value, low effort)

- Fail boot on default `SERVICE_TOKEN` and default DB credentials in any non local env (change the warn in `assertProductionSecrets` to a throw). (F5)
- Remove the `0000`/`1234` null hash PIN branch entirely, or force `authStrict=true` in all deployed builds. (F4)
- Add a root `ErrorBoundary` component. (F8)
- Point the export blank template fallback at `/tmp` (or precompute templates at build time) so exports stop failing on Netlify. (F7)
- Fix `coils[0]?.coil_id` to `coil_tag` in the TM writeback. (F20)
- Make `flushOutbox` treat a 409 as success (delete the item) and continue past failures instead of breaking. (F12)
- Add `htmlFor` in the shared input component. (F25)
- Re-select `FAILED` writeback jobs (with an attempt cap) so a transient BC error is not terminal. (F20)

---

## K. Recommended Roadmap

### P0 Critical and immediate (before any real data capture)

**F1 Enforce authentication in deployment.**
Why it matters: without it the data store is open to anyone with the URL, as any role.
Action: require `SUPERTOKENS_CONNECTION_URI` in deployed builds and fail closed if absent; set `AUTH_ALLOW_HEADER_ROLE=false` and make the header path unreachable when `isProduction`; keep `AUTH_STRICT=true`. Add an integration test that an unauthenticated `/api/*` call returns 401.
Complexity: Medium.

**F6 Transactional integrity.**
Why it matters: the product is a trustworthy production and genealogy record; partial writes corrupt it.
Action: add `withTransaction(fn)` in `db/pool.js` that opens one client, sets the tenant GUC once, runs `fn(client)`, and commits or rolls back; refactor the multi write service methods (`openRun`, `submitRun`, `approveRun`, `endProduction`, `updateProductionQuantities`, genealogy publish) to take the client. This also improves performance (F15).
Complexity: Medium to High (touches the core services, but mechanical).

**F3, F4, F5 Close credential bypasses and defaults.**
Why it matters: parallel guessable login, PIN backdoor and default secrets defeat the auth you are enforcing in the same step.
Action: remove the deterministic SuperTokens password fallback (provision explicitly, force reset on first login); delete the null hash PIN branch; throw on default secrets and seeded PINs outside local.
Complexity: Low to Medium.

### P1 High priority (before pilot go live)

**F7 Report templates.** Ship all 10 GLI templates or fix the writable path; verify each renders the approved layout. Complexity: Medium.
**F8 Error boundary and safe fallback.** Complexity: Low.
**F13 One schema source of truth** or an automated equivalence check between the two migration sets. Complexity: Medium.
**F18 Observability baseline:** structured logs with request IDs, DB and collector health alerting. Complexity: Medium.
**F19 CI smoke:** run `verify:rls`, `verify:rbac`, `verify:state-machine` and the smoke scripts on every push. Complexity: Low to Medium.
**F12 Outbox hardening:** 409 as success, continue past failures, refresh token before flush, cap retries. Complexity: Low.
**F10 Bind supervisor override** to the specific action server side (issue a short lived scoped grant, verify it on the guarded write) or move the check into the write path. Complexity: Medium.

### P2 Important improvements

**F14 Converge validation** on the ruleset engine and enforce Tube Mill business rules server side. Complexity: Medium.
**F16, F15 Query consolidation:** collapse `listRuns` and `enrichRun` fan out into set based queries; batch rollups. Complexity: Medium.
**F17 Route level code splitting** for capture, admin and plant sections. Complexity: Low.
**F11 Idempotency claim:** distinguish a genuine duplicate (unique violation) from other errors. Complexity: Low.
**F20 Writeback:** field fix and FAILED retry with cap. Complexity: Low.
**F9 Token storage:** move to in memory plus refresh, or accept the tradeoff explicitly and add a strict CSP. Complexity: Medium.

### P3 Optimization and polish

**F25 Accessibility and loading states.** Complexity: Low.
**F23 Single mount** (drop the double router mount, standardize on `/api`). Complexity: Low.
**F24 Finish the TS to JS cleanup** (regenerate or hand normalize the compiled JSX). Complexity: Low.
**F28 Retention** on idempotency and writeback tables. Complexity: Low.
**F29 Extend RLS** to the remaining feature tables if multi tenant is ever on the table. Complexity: Medium.

---

## L. Functional Audit (against the Goodluck A-59 route)

### What Phase 1 intended, and whether it was built

The corrected Phase 1 scope (from the implementation assessment and the controlled process route) is the four stages **Tube Mill to Furnace to STP to Draw Bench**, with drawing as a multi pass cycle and swaging as the draw end pointing sub step, all manual capture with a PLC ready seam. That scope is built: five capture consoles (TM, FUR, STP, DRW, SWG), four roles, per process and per machine access, DPR and FT exports, coil and WO genealogy, ERP writeback (file adapter), audit trail, validation rules admin, master data admin, and offline capture.

The wider plant route has stages that are correctly out of Phase 1 scope and are flagged as future in the plant's own documents: HR coil pickling (A-59 only inbound), slitting, straightening (108), cutting and end facing (109), SRB (109A), honing (109B), NDT (ECT, UT, hydro), and the final QP-01 control plan. These are not defects. The one functional consequence worth stating: because pickling and slitting are upstream of the tube mill and not captured, the traceability spine (coil number plus WO number, which the plant keys everything on) begins at the tube mill, so coil provenance before the mill is not in M1 yet.

### Feature Audit Matrix

Status key: Built and traced (confirmed in code end to end), Built, API verified (routes, services and client present and wired, internal logic not exhaustively line traced), Partial, Inert by design, Not in Phase 1, Not Verifiable (runtime needed).

| Feature | Expected behaviour | Actual behaviour (evidence) | Status | Issues | Severity | Recommended fix |
|---|---|---|---|---|---|---|
| Login (badge plus PIN) | Operator logs in with badge and 4 digit PIN, gets a session and role | `validateBadgePin` verifies scrypt PIN, lockout, then creates a SuperTokens session; client stores token and user | Built and traced | Parallel guessable ST password (F3); null hash PIN backdoor (F4); default PIN 1234 (F5) | High | Close F3, F4, F5 |
| Auth enforcement on APIs | Every `/api/*` requires a valid session and role | Guards present on all routers, but the deployed default does not authenticate; fallbacks grant full access (F1, F2) | Partial | Not fail closed in deployment | Critical | Enforce SuperTokens, disable header role in prod |
| RBAC (4 roles, process and machine ACLs) | Server enforces role and per process, per machine access | `requireRole`, `requireProcessAccess`, `requireMachineAccess` applied on mutating routes; rank plus ACL logic sound | Built and traced | Depends on F1 being closed to matter | High (via F1) | None beyond F1 |
| Tube Mill capture (run, coils, bundles, params, first off, stoppages, defects, submit, approve, lock) | Full run lifecycle with a state machine and quantity rollups | `RunService` implements the lifecycle, state transitions, rollups, yield; routes validated with Zod | Built and traced | Not atomic (F6); TM business ruleset not enforced (F14); N plus 1 (F16) | High | Transactions; enforce ruleset |
| Furnace capture (charge, 6 zone temps, gas, consumption, approve, export) | Annealing capture with zone temps and gas plant logs, business rule validation | Routes call `assertValid('FUR')`; `FurnaceService`, gas matrix, consumption modal present; export layout ANN-FT-01 | Built, API verified | 6 zone modelling not line verified here (assessment R-3); export template present | Medium | Verify 6 zone schema and export fidelity |
| STP capture (lot, bath analysis, chemical addition, stages, sign off, export) | Soap draw surface treatment bath logs and analysis | Routes call `assertValid('STP')`; `StpService` (1060 lines), bath and chemical modals, stage advance; layouts STP-FT-01A, STP-06, STP-FT-04 | Built, API verified | Two of three STP export templates missing on disk (F7) | High (via F7) | Ship templates |
| Draw Bench capture (lot, passes, tooling, inspection, disposition, approve, export) | Multi pass draw with tooling history and 1st off | Routes call `assertValid('DRW')`; `DrawBenchService` (1018 lines); board, console, history, work order hub; layouts DB-FT-01/03/08 | Built, API verified | Two of three DB export templates missing on disk (F7); multi pass genealogy dedup not verified (assessment R-4) | High (via F7) | Ship templates; verify pass dedup |
| Swage capture | Draw end pointing length by tonnage | `swageRoutes`, `SwageService`, `SwageCapture` present with `assertValid('SWG')` | Built, API verified | None specific | Informational | None |
| Genealogy (coil plus WO spine) | Trace a lot back to its mother coil across stages | `GenealogyService`, upstream lot select, traceability page; TM material lots published on approve | Built, API verified | Spine starts at tube mill (pickling and slitting not in M1) | Informational | Add upstream stages in later phase |
| DPR and FT exports | Approved GLI formatted workbooks per process | `ReportExportService` with layouts and exceljs injection; CSV and XLSX endpoints | Partial | 7 of 10 templates missing, fallback fails on Netlify (F7) | High | Ship templates or fix writable path |
| ERP writeback (Business Central) | Stage output, consumption, scrap on approve; flush to BC | DB backed job ledger (`erp.writeback_job`), file connector; enqueue on approve | Built, API verified (file adapter) | Live OData not implemented (asserted off); field bug and terminal failures (F20) | Low | Fix F20; wire OData in Phase 2 |
| PLC and SCADA capture | Live welder and furnace and STP data | `data_source` seam, sim driver, `UnsupportedPlcDriver` fail closed | Inert by design | In memory state will not survive serverless (F22) | Low | Phase 2 connector work |
| Offline capture | Queue writes offline, sync on reconnect | IndexedDB outbox, enqueue on offline, flush on `online` event | Built and traced | Poisoning and 409 handling (F12) | Medium | Harden flush |
| Audit trail | Record who changed what | `AuditTrailService`, audit routes, admin and plant audit views | Built, API verified | Completeness of coverage not runtime verified | Not Verifiable | Verify coverage at runtime |
| Admin (users, machines, master data, validation rules, planning, system, integrations) | Manage users, ACLs, masters, rules | Admin pages and routes present, guarded by `requireAdmin` | Built, API verified | Validation rules admin edits the ruleset overlays used by `assertValid` (good) | Informational | None |
| Machine Head and Plant Head dashboards, reviews, reports | Review, approve, monitor, export | Dedicated shells, review routes, plant reporting service, live dashboards | Built, API verified | Report internals and numbers not runtime verified | Not Verifiable | Verify report figures against source data |

### End to end runtime verification (Not Verifiable here)

The following could not be exercised without a database, SuperTokens core and a BC instance, and are marked Not Verifiable rather than assumed: actual login and session refresh, whether each capture write persists and reappears, DPR figure correctness against seeded data, the furnace 6 zone and draw multi pass edge cases, audit trail completeness, and export layout fidelity against the physical GLI forms. A runtime pass (seed the local Docker stack, run the smoke and verify scripts, and manually walk one lot from tube mill to draw bench) is the recommended next validation step and would convert most "API verified" rows above to "Built and traced".

---

## M. Process Functionality and Data Capture (per stage)

This section traces what each stage does, its capture lifecycle, and how each field gets its value. Field source classes are taken from the four M1 data mapping workbooks in `Dev Specs/SHEET` and reconciled against the shared form schemas and the service code. Source classes: MANUAL (operator types it), DERIVED (carried from the work order, upstream lot, or a master such as the TM-02 chart), AUTO (a machine or a server rollup produces it), SYSTEM (generated id).

**Lifecycle, common to all five stages:** a record moves DRAFT to SUBMITTED to APPROVED to LOCKED, with an optional HOLD, enforced by a state machine and the role guards (operator captures and submits, machine head approves, plant head reads). On APPROVE the stage publishes its output into the shared genealogy spine and enqueues an ERP writeback job. Validation runs at write time (Tube Mill via Zod schemas, the other four via the shared ruleset engine, see finding F14).

**1. Tube Mill (ERW), 122 fields, tables `txn.prod_tm_run` plus coil, setup, bundle, param snapshot, stoppage, inspection, consumable.** The richest stage. Header fields (run no, mill, WO, batch, customer, grade, size, shift, date) are DERIVED from the queue card, which is seeded from the ERP plan via `syncPlanToQueue`. Setup tooling (ID/OD tool, boggie, impeder, ferrite, work coil, fin pass, weld dia) is DERIVED from the TM-02 chart with operator confirm or override logged; weld geometry (WC to WR distance, V length, V gap, coolant, first off dims and form) is MANUAL. Speed and power are AUTO (welder), piece count is AUTO (COC saw), quality class is MANUAL, weights are DERIVED (count times theoretical), totals and yield are AUTO server rollups. Downtime start and stop are AUTO (collector), reason and code are MANUAL. This split is exactly what the field dictionary specifies and it is what the run service implements, with the caveat that the AUTO welder and collector fields are currently captured manually because the collector is inert (F22).

**2. Furnace / Annealing, 27 fields, tables `txn.prod_ann_run`, `txn.ann_gas_log`.** Charge header DERIVED from the work order (auto from order flow) or manual. Six zone temperatures (I to VI, min and max) and line speed are AUTO from RHF SCADA per the dictionary, tube count and HT type are MANUAL or DERIVED from the grade recipe, gas consumption (PNG, NH3) and gas plant params (dew point, H2 percent, O2 ppm) are AUTO if a meter or plant PLC is wired otherwise MANUAL. The build captures all of these manually today.

**3. STP (soap draw surface treatment), 28 fields, tables `txn.prod_stp_lot`, `txn.stp_bath_analysis`, `txn.stp_coating`, `txn.stp_bath_history`.** Lot header DERIVED from the work order (a `/stp/orders` endpoint seeds it from ERP). Bath temperatures and dip times across the eight bath sequence stages are AUTO per the dictionary (auto crane, bath sensors, Siemens SCADA), and the crane state is AUTO. Bath analysis (titration: TA, FA, pH, HCl percent, Fe percent) and coating weight are MANUAL by nature (lab). Chemical additions and breakdown remarks are MANUAL.

**4. Draw Bench, 58 fields, tables `txn.prod_db_lot` plus shift check, inspection, tooling issue, tooling master, tooling usage, swage.** Predominantly manual (L1). Header DERIVED from the work order and the load plan (bench assigned by Table C capacity). FROM and TO dimensions, form deviation, surface, accepted and rejected counts, tooling condition and die history are MANUAL (operator and QA). Drawn metre, pull load, cycle time and a tubes-produced counter are AUTO only if a bench PLC is wired; draw speed is a fixed master value. Multi pass (1st, 2nd, 3rd) is an operator-set enum on the lot.

**5. Swage, table `txn.prod_db_swage`.** The draw-end pointing sub step. Machine, die, draw size and tag are DERIVED or MANUAL; tag length and length after die, and quantity, are MANUAL (operator scale). Minimum swage-end length is validated against the tonnage table.

Confirmed vs not verified: the Tube Mill capture path was traced end to end (UI to route to `RunService` to tables). Furnace, STP, Draw and Swage were verified at the route, validation and genealogy level and their field dictionaries were reconciled, but their internal service logic was not line traced, so their capture correctness is API verified, not runtime verified.

## N. Inter-Process Data Flow (what carries stage to stage)

The plant keys everything on coil number plus work order number. The build implements this as a shared genealogy spine: a `txn.material_lot` table plus a `txn.process_handoff` table, both defined in migration 010 (`GenealogyService.js`).

**How a field enters a stage.** Planned header fields (work order, customer, grade, size, batch) enter at the Tube Mill from the ERP-seeded queue card, and at STP from `/stp/orders`; Furnace and Draw take them from an attached upstream lot or manual entry. Process values, tooling, quantities and inspection results are captured fresh at each stage and do not carry.

**What carries stage to stage.** On APPROVE each stage publishes its output into `material_lot` (`publishTmMaterialLots` at `RunService.js:701`, `publishFurMaterialLots` at `FurnaceService.js:396`, `publishDrwMaterialLots` at `DrawBenchService.js:533`). A downstream operator lists available upstream lots (`listUpstreamLots`, filtered by an `upstreamOf` map: FUR accepts TM, STP accepts TM and FUR, DRW accepts TM/FUR/STP/SWG) and attaches one (`attachMaterialLot`), which writes a `process_handoff` row, flips the lot to IN_PROCESS with the new `current_process`, and stamps `material_lot_id` and `upstream_handoff_id` onto the downstream record.

The fields that carry on that spine are: **work_order_no, coil_tag / lot_tag, customer_code, grade_code, size.** That is the genealogy join, and it matches the plant's coil-plus-WO spine.

Flow map (verified in code):

| Hop | Mechanism | Fields carried | Notes |
|---|---|---|---|
| ERP plan to TM | `syncPlanToQueue` to `queue_card` to `openRun` | WO, batch, customer, grade, size | Planned context entry point |
| TM to FUR | TM approve publishes coil and bundle lots; FUR attaches | WO, coil_tag, customer, grade, size | coil_tag preserved on the TM-origin lot |
| FUR to STP | FUR approve publishes charge lot; STP attaches (mutates current_process) | WO, customer, grade, size | coil_tag set null on the FUR charge lot (F30) |
| STP to DRW | STP mutates the attached lot's current_process; DRW picks it | WO, customer, grade, size | STP does not publish its own lot (by design) |
| DRW to next | DRW approve publishes drawn lot (to_size) | WO, customer, grade, size (drawn) | new lot keyed on draw tag |
| Any stage to ERP | approve enqueues `erp.writeback_job` | output, consumption, scrap | file connector only |

**Findings in the data flow:**

- **F30 (Medium, confirmed):** Genealogy forks at the furnace charge and can lose the coil link. Furnace approve creates a new `material_lot` keyed on `charge_no` with `coil_tag` set to null and no `process_handoff` back to the coil lot that was attached into the furnace run. So `getGenealogy` on a drawn or annealed lot may not walk back to the mother coil when a furnace charge batched coils, or across the multi pass FUR to STP to Swage to Draw re-entry (the assessment's R-4 risk). The spine is a per-lot handoff chain, not a coil tree. For a traceability product this is the most important functional gap after the P0 items. Fix: link the published charge lot to its input coil lots (carry `coil_tag` or write a handoff), and model the multi pass re-entry without forking identity.
- **F31 (Medium, confirmed):** `attachMaterialLot` performs three writes (handoff insert, lot update, downstream stamp) with no shared transaction (the F6 pattern), and its `.catch` fallback on the downstream stamp swallows the original error and retries without `upstream_handoff_id`, masking schema mismatches. A mid-attach failure can leave a lot marked IN_PROCESS with no handoff, or a handoff with no downstream stamp.
- **F34 (Low, confirmed):** the spine carries identity (WO, coil, grade, size) but not quantity or weight, so cross-stage mass balance and multi-stage yield reconciliation are not supported by the genealogy layer; each stage records its own quantities independently.

## O. PLC / SCADA Auto-Capture Candidates (potential connection, Phase 2)

The authoritative source here is the workbook `Dev Specs/SHEET/Zedral_A59_M1_PLC_SCADA_Data_Requirement_and_Tag_Mapping.xlsx` (v1.0, 20 Sep 2026, field derived from the on-site survey and live welder exports, 17 to 20 controllers, 14 stages). It maps every data point to a machine, PLC, tag, source, availability, M1 need and priority, and lists 19 gaps. The counts below are from that workbook; where two of its summary tabs differ slightly I give the workbook's own figures and note it is a v1.0 working document with unconfirmed tags marked "To Confirm".

**Overall availability (workbook):** roughly 132 to 147 data points mapped, of which about 39 are readable now, about 55 are reachable but need each machine's tag list first (Gap G-01), about 28 to 34 are operator-typed by nature, 7 are M1-calculated, and about 10 are missing or to check on site. Only one source streams live today: the Thermatool welder (Weld-Manager export: weld power, speed, tube size, energy, run and stop message).

**Ready to connect now (39 points), by stage:** HF Welding 18, Furnace RHF 11, STP 10. These three are the highest value Phase-2 targets because their SCADA or history is already on the network. Everything else is reachable but blocked on tag lists, on a read-only path between the two OT subnets (G-02), and on read-only logins (G-16); the legacy serial controllers (three Twido, three S7-200CN) need protocol gateways (G-04, G-05).

Candidate matrix (M1 field, its current source in the build, the PLC or SCADA source, availability, priority):

| Stage | Field(s) | Current source in build | PLC / SCADA source | Availability | Priority |
|---|---|---|---|---|---|
| Tube Mill | Weld power kW, line speed mpm, tube OD and wall | Manual entry (AUTO seam exists) | Thermatool Weld-Manager | Live today | P0 / P1 |
| Tube Mill | Weld current, frequency, voltage percent, KW band, energy kWh, hourly tonnage | Manual or null | Welder telemetry | Live today | P1 |
| Tube Mill | Piece count (cut) | Manual quantity buckets | COC saw PLC (A59-COC-PLC) | Reachable, need tag list | P0 |
| Tube Mill | Line run and stop (downtime timing) | Manual stoppage entry | Welder MESSAGE plus line PLC | Live (welder) | P0 |
| Tube Mill | Coolant pressure | Manual | Utility PLC if wired | To confirm, likely manual | P2 |
| Furnace | 6 zone temperatures I to VI (min, max), line speed m/hr | Manual grid | RHF SCADA (WinCC), history log | Ready now | P0 |
| Furnace | PNG and NH3 consumption, dew point, H2 percent, O2 ppm | Manual | Gas plant PLC or meter | Reachable, need tag or meter | P1 |
| STP | Bath temps and dip times (degrease, pickle, phosphate, neutralize, lube, dryer, reactive oil) | Manual monitor | STP SCADA, TP700, auto crane | Ready now | P0 / P1 |
| STP | Crane and wagon state | Manual | ET200S / TP700 | Ready now | P2 |
| STP | Bath analysis (TA, FA, pH, HCl percent, Fe percent), coating weight | Manual (lab) | Not on PLC (lab titration) | Operator or lab by nature | P0 |
| Draw Bench | Drawn metre, pull load ton, cycle time, tubes-produced count | Manual | Bench PLC (Exor eSMART, KTP) | Reachable, DB-05/06/07 Ethernet-native first | P1 / P2 |
| Draw Bench | Accepted count | Manual | Bench PLC if wired | Reachable, need tag list | P1 |
| Draw Bench, Swage | FROM and TO dims, form, surface, tooling, swage lengths | Manual (operator, QA) | Not on PLC | Operator by nature | P0 |
| Cross cutting | Downtime reason | Manual | Not on any PLC | Operator plus code master (G-17, G-19) | P0 |
| Cross cutting | Production order or WO number | ERP-seeded queue or manual | Not on any PLC | ERP D365 BC or route-card QR scan (G-18) | P0 |

**How ready the code is for these connections.** The forward-compatibility seam the assessment promised is partly there: capture tables carry a `data_source` column (default MANUAL), and the collector is abstracted behind a driver interface (`SimPlcDriver` versus `UnsupportedPlcDriver`) with a canonical tag map. But the actual scaffold covers the Tube Mill only. `collector/tagMapping.js` defines six signals, all tube-mill welder and line (LINE_SPEED, WELD_POWER, WELD_CURRENT, RUN_STATE, CUT_COUNT, COOLANT_PRESSURE), and the only ingest endpoint is `/internal/tubemill/ingest` (service-token guarded). There is no collector, tag map or ingest path for the furnace or STP, which the workbook identifies as the two easiest and highest value connections after the welder. And the collector holds its diff state (last run state, last cut count) in module memory, which does not survive serverless invocations (F22), so even the tube-mill path is not deployable as-is on the current Netlify model.

**Additional finding:**

- **F32 (Medium, confirmed):** The PLC ingestion seam is tube-mill-only and demo-grade. To realize the 39 "ready now" points (especially the furnace 6-zone temps and STP bath temps, which are the documented quick wins), Phase 2 needs per-process collectors and ingest endpoints, the `data_source` confirm-only capture flow on the client (flip a field from manual entry to machine-confirmed without a schema change), and a persistent collector runner that does not depend on serverless module memory. Today every write is `data_source = MANUAL`; no AUTO or confirm-only path is exercised anywhere (F33, Informational).

**Dependencies to close before any PLC connection (from the workbook's gap list):** G-01 capture each machine's tag list on site; G-02 a read-only network path between the two OT subnets; G-16 read-only logins (welder HMI is OEM-locked); G-03 confirm the Weld-Manager export interface for continuous read; G-04 and G-05 protocol gateways for the legacy serial mill and draw controllers; G-18 ERP read APIs for the order number join; G-17 and G-19 the downtime reason coding and the TM-FT-03 stoppage code master. None of these are code problems; they are site engineering and access items, and they gate the "reachable" 55 points.

## Audit method and coverage

Static inspection covered: build and deploy config (root, server, client, shared package manifests, `netlify.toml`, Dockerfile references), both entry points (`server/src/index.js`, `netlify/functions/api.js`), the full auth surface (`config.js`, `authConfig.js`, `authMiddleware.js`, `authRoutes.js`, `authService.js`, `pinService.js`), the DB layer (`pool.js`, `migrate.js`, schema and RLS migrations, index and FK census), all 16 route files (guard census), the core services (`RunService` line by line, plus the integration services `CollectorRunner`, `InProcessEventBus`, `ErpWritebackService`, `ReportExportService`, `ValidationGate`), the client transport, auth store, routing, guards and offline outbox, `App.jsx`, and cross cutting greps (transactions, RLS, secrets, XSS sinks, incomplete markers, polling hygiene, accessibility). The data flow and PLC readiness addendum (sections M, N, O) additionally reviewed the four M1 data mapping workbooks (Tube Mill 122 fields, Furnace 27, STP 28, Draw Bench 58) with their per-field source classification, the PLC and SCADA tag mapping workbook (v1.0, 14 stages, roughly 132 to 147 data points, 19 gaps), the genealogy service and its handoff spine (`GenealogyService.js`, migration 010), and the collector tag map. Functional intent was cross checked against the A-59 controlled process route and the Phase 1 implementation assessment. Runtime behaviour was not exercised.

Findings F30, F31, F32 and F34 (genealogy fork, non-atomic attach, tube-mill-only PLC seam, no quantity on the spine) and the informational F33 are raised in sections N and O rather than repeated in the section C table, and fold into the roadmap under P1 (F30, F31) and P2 (F32).

---

## P. UX Audit

The product ships with a detailed internal UI/UX standard (`Dev Specs/UI_UX_GUIDELINES.md`, plus `OPERATOR_SCREEN_LAYOUT.md` and `BRAND_GUIDELINES.md`) and the delivered client follows most of it. This is a genuine, purpose built operator experience, not a generic CRUD front end. The audit below is against that standard and against shop floor usability, and it lists only actionable items, not aesthetics. Finding IDs continue from the addendum (F35 onward); F8 and F25 already exist in section C and are restated here for the UX lens.

### What is done well (preserve)

- **The operator shell is purpose built for the floor.** A persistent status rail (machine, shift, mill status, active order, hold state, clock, role), a dark green left nav rail, an offline banner, a stoppage banner, and a right action rail for critical controls (`OperatorShell.jsx`, `ProductionActionRail`). Critical actions (start, stoppage, hold, manual stop, end shift) live on the rail, not buried in menus, which is exactly guideline section 8 rule 1.
- **Shared primitives are used consistently:** `ZButton`, `ZInput`, `ZBadge`, `ZFilterPills`, `ZPageHeader`, `ZOperatorCard`. Status is a labelled coloured pill via `ZBadge` plus a `statusTone` map, never colour only, matching guideline section 7.
- **Errors are inline, adjacent to the control, not toast only** (`error-strip` under fields), matching guideline section 8 rules 4 and 6. Empty and error states are well covered across pages (131 empty state and 268 error handling signals).
- **Offline first UX is real and visible:** `SyncStatusBadge`, `OfflineBanner`, an IndexedDB outbox, and a flush on reconnect, matching guideline section 8 rule 3.
- **Responsive** down to about 560px via 16 media queries (breakpoints at 560, 640, 720, 900, 960, 1100px), so tablet and small widths adapt.
- **Data typography** uses monospace for IDs, dimensions and weights, per guideline section 7, and the PIN input is correctly `type=password` with `inputMode=numeric` and `maxLength=4`.

### Actionable UX refinements

- **F35 (Medium) Glove mode touch targets are not implemented.** The guideline (section 5) requires operator hit targets of 44 to 56px and names a `ZButton` glove mode and a `useGloveModeStore`. In the delivered build there is no glove mode at all (0 occurrences) and `.z-btn` is about 36px tall, with `.z-btn--sm` smaller, below the standard for gloved shop floor use. This is the single most material UX gap for the actual use context. Fix: add a glove sizing mode, or raise the operator surface button and input minimum height to at least 44px, and apply it on the five capture consoles. Evidence: `ui.css` `.z-btn` padding 0.5rem; grep glove = 0; `UI_UX_GUIDELINES.md:88`.
- **F36 (Medium, security adjacent) Demo badges and the default PIN are shown on the login screen in every environment.** The `DEMO_BADGES` chip row and the "Demo (PIN 1234)" hint render unconditionally in `LoginScreen`, not gated to dev. In a real deployment this advertises working credentials on the sign in page. Fix: gate the demo chips behind `import.meta.env.DEV`. Ties to F5. Evidence: `LoginScreen.jsx:208-220`; no env guard.
- **F37 (Low) Destructive and logout actions use native `window.confirm`.** Six call sites (all four nav sign outs, master data row delete, validation rule delete). Native confirm is a blocking, unstyled OS modal that reads as jarring on a kiosk tablet and breaks the visual system. Fix: use an in app confirm dialog (the app already has `FormModal`). Evidence: grep `window.confirm` 6 sites.
- **F38 (Low) No transient success feedback.** There is no toast or snackbar system anywhere (0 toast usage); a successful save, submit or approve is signalled only by a state change or refetch. On a noisy floor this can leave an operator unsure a write landed. Inline error handling is good; positive confirmation is thin. Fix: add a lightweight success toast on save, submit and approve.
- **F8 (High, restated for UX) No error boundary.** From the UX lens, any uncaught render fault blanks the operator console mid shift with no recovery path. A root boundary with a "reload, your offline data is safe" fallback is both a reliability and a UX fix.
- **F25 (Low, restated for UX) Inputs lack label association and loading states are sparse.** `ZInput` renders a bare input with no `id`, labels are separate `label.eyebrow` elements with no `htmlFor` (0 associations), which fails basic accessibility and hurts tap to focus on tablets; fix once in `ZInput`. Separately, explicit loading states are sparse (14 signals) versus strong empty and error coverage, so some fetch backed views can flash blank; add skeletons or spinners on the capture and dashboard queries.

### UX findings table

| ID | Finding | Category | Severity | Confidence | Evidence | Impact |
|---|---|---|---|---|---|---|
| F35 | Glove mode touch targets not implemented; buttons about 36px vs the 44 to 56px standard | UX | Medium | Confirmed | `ui.css` `.z-btn`; `UI_UX_GUIDELINES.md:88`; grep glove 0 | Hard to hit accurately with gloves on the floor |
| F36 | Demo badges and default PIN shown on the login screen in all environments | UX / Security | Medium | Confirmed | `LoginScreen.jsx:208-220` | Working credentials advertised on the sign in page in production |
| F37 | Destructive and logout actions use native `window.confirm` | UX | Low | Confirmed | 6 call sites | Blocking, unstyled, off brand modal on a kiosk |
| F38 | No transient success feedback (no toast system) | UX | Low | Confirmed | grep toast 0 | Operators lack positive confirmation a write landed |

### UX verdict

The information architecture, navigation, action model, status visibility and offline handling are strong and coherent, and the team clearly designed for the floor against a thoughtful internal standard. The gaps are concentrated, not systemic: touch target sizing for gloved use (F35) is the one that matters most operationally, the login credential exposure (F36) matters most for a real deployment, and the error boundary (F8) matters most for reliability. None require a redesign; they are refinements to a sound system.

### Roadmap additions (UX)

- **P1:** F36 gate demo badges to dev (quick win, ties to the credential work); F35 glove mode touch targets on the operator surfaces (Medium effort); F8 error boundary.
- **P3:** F37 in app confirm dialog; F38 success toasts; F25 input label association and loading skeletons.
