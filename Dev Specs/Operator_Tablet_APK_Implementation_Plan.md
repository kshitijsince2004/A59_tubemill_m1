# Operator Tablet APK Implementation Plan (A-59 M1)

**Application:** Zedral M1 (A-59 line, Goodluck India Limited, Sikandrabad Unit 2)
**Deliverable:** a lightweight, operator only Android APK for line mounted shopfloor tablets
**Audience:** Zedral engineering (frontend, backend, integration, DevOps) and any IDE coding agent used to execute the build
**Prepared:** 26 September 2026
**Priorities, in order:** Role isolation, Reliability, Offline resilience, Security, Small footprint, Operator simplicity
**Basis:** the real A-59 M1 codebase (Node plus Express, PostgreSQL, self hosted SuperTokens, React / Vite / Capacitor), the A-59 technical audit, the M1 ERP integration plan, and the Windows production deployment strategy. Where a fact is not established it is marked TBD and never invented.

---

## 0. What this is, and what already exists

This APK is not a new application. It is a second build target of the existing M1 client, packaging only the operator surface as an Android app for tablets mounted at the machine lines. The web app and the APK share one codebase, one API, one data model, and one set of business rules. There is no fork, no parallel auth system, and no duplicated business logic. The backend stays the single source of truth.

The point of the APK over the plain browser PWA is device control and durability: a locked down single app kiosk the operator cannot leave, on device storage that survives an Android eviction or a reboot, screen always on, and a fleet update path that does not depend on someone opening a browser.

### 0.1 Current state (confirmed from the codebase and audit)

| Area | State today | Consequence for this build |
|---|---|---|
| Client | React 18, Vite 6, React Router 7, TanStack Query, SuperTokens web SDK; hand written service worker plus an offline outbox | Reuse as the app shell; the APK is a Vite build target of this same client |
| Operator surface | Five capture consoles (Tube Mill, Furnace, STP, Draw Bench, Swage), an operator shell with a status rail, offline banner, sync status badge and a right side action rail | This is exactly what the APK ships; everything else is excluded |
| Roles | OPERATOR, MACHINE_HEAD, PLANT_HEAD, ADMIN (a former SUPERVISOR role was removed) | The APK admits OPERATOR only; the other three are blocked at login |
| Auth | Badge plus 4 digit PIN, scrypt hashed with per PIN salt and constant time compare, 5 try lockout, then a SuperTokens session | Reuse as is; do not build a second auth path |
| Auth posture | Not fail closed in the deployed config; header supplied role and demo password fallbacks grant access without credentials (audit F1 to F5) | These are hard blockers. The APK cannot ship until auth fails closed |
| Offline | Outbox present and load bearing, but it stops on the first failure, does not treat a 409 as success, and can be poisoned by one stuck item (audit F12) | Harden and formalise the outbox before fleet use |
| Idempotency | An idempotency key exists on writes, but the claim path reports every insert error as a duplicate 409 (audit F11) | Fix so a real error is not masked as a duplicate |
| Server | Node plus Express, `pg` pool, per statement tenant GUC, row level security; the ERP write back ledger and a PLC ingestion seam kept inert for Phase 2 | Reuse; add only an idempotency dedupe table and a small set of delta read endpoints if they are missing |
| Deployment target | On premises single Windows Server at the plant; ERP is Dynamics 365 Business Central; the data lake is on prem by default | The APK points at the plant LAN server, not a cloud origin |
| Token transfer | Cross origin login from the APK fails on cookies over the plant network | Switch SuperTokens to header based (bearer) transfer; see Section 4 |

### 0.2 The rule that governs the whole build

Do not recreate the application. Inspect what is there, reuse it, and add only the thin native and offline layer the tablet needs. The final artifact is a purpose built operator client, not a compressed copy of the web app. Every new dependency, screen, endpoint, or background process must earn its place against reliability, speed, offline resilience, security, footprint, or operator simplicity. If it does not, it does not ship.

---

## 1. Operator capability matrix (strict scope)

This is the contract for what the APK does and does not do. It is enforced in three places: the router (no route to the excluded surface), the bundle (excluded modules are not compiled in, checked in CI), and the backend (every route authenticated and role scoped).

| Capability | Operator APK |
|---|---|
| Operator login (badge plus PIN) | YES |
| Operator profile and context | YES |
| Assigned machine and line | YES |
| Assigned shift and current shift | YES |
| Shopfloor work queue | YES |
| Production capture (the five process consoles) | YES |
| Checklist and first off capture | YES |
| Process execution lifecycle (draft, submit) | YES |
| Stoppage, defect, crew sub forms | YES |
| Shift handover (outgoing) | YES |
| Offline capture | YES |
| Background sync | YES |
| Plant Head login | NO |
| Machine Head login | NO |
| Supervisor login | NO (role no longer exists) |
| Admin login | NO |
| Super Admin login | NO |
| Approve / lock / review actions | NO (Machine Head and above, web only) |
| Management or plant dashboards | NO |
| Analytics and reports | NO |
| Master data or validation rule admin | NO |
| User and ACL management | NO |
| ERP and integration configuration | NO |

Lifecycle note: the record lifecycle is DRAFT to SUBMITTED to APPROVED to LOCKED, with an optional HOLD. The operator owns DRAFT and SUBMITTED. APPROVE and LOCK belong to Machine Head and above and stay on the web app. The APK exposes capture and submit, and read of the operator's own submitted records, and nothing past that.

---

## 2. Architecture principles

1. **Second build target, not a fork.** The APK is `vite build` of the operator entry, wrapped by Capacitor. Web and APK diverge only at the entry point and the native layer. Any shared component that must behave differently in the APK is gated behind a compile time flag, so the web build is byte for byte unchanged.
2. **WebView shell, no rewrite.** Capacitor wraps the existing React bundle in an Android WebView. No React Native, no second UI framework, no TWA. This is the lowest cost path to a native container and it keeps one codebase.
3. **Reuse first.** Auth, RBAC, validation rules, the capture services, the export engine, the ERP write back, and the data model are consumed as they are. The APK adds an offline storage layer, an ordered sync engine, a native bootstrap, and a kiosk shell. Nothing else.
4. **Offline is a requirement, not a feature.** Capture must never block on the network and must never lose a completed action to a dropped link. This shapes the storage and sync design more than anything else.
5. **Fail closed everywhere.** The frontend restricts, the backend enforces. A frontend restriction is never the security boundary.

---

## 3. Role and authentication boundary

The single most important requirement is strict role isolation. It is enforced at login and re enforced on every API call.

### 3.1 The operator login gate

```
Operator opens APK
      |
Enter badge + PIN
      |
POST /auth (badge + PIN)  ->  scrypt verify + lockout check
      |
Create session (SuperTokens, header transfer)
      |
Load /operator/context  ->  server asserts role == OPERATOR
      |
role == OPERATOR ?  --- no --->  401/403, session discarded, return to login
      | yes
Load assigned machine / shift / permissions
      |
Open Operator Workspace
```

### 3.2 Non operator accounts are blocked at the server, not hidden

The four non operator roles (Machine Head, Plant Head, Admin, and any future management role) must not be able to obtain an authenticated operator session through this APK. This is enforced on the server, not by hiding a screen.

Two enforcement points:

- **At login / context load:** the operator context endpoint the APK calls after sign in returns 403 for any session whose role is not OPERATOR. The APK never creates a workspace for a non operator session; it discards the session and shows "This account is not permitted to use this application."
- **On every request:** the operator API routes require an authenticated session and `role == OPERATOR`. A management token cannot drive an operator write even if it reaches the endpoint.

### 3.3 Auth blockers that must close before the APK ships

The audit found the deployed auth is not fail closed. These are hard blockers for a real deployment and are closed in the backend, once, for both web and APK:

| Blocker | Fix |
|---|---|
| Auth not enforced in the deployed config; all API routes publicly reachable | Require the SuperTokens connection in deployed builds and fail closed if absent; an unauthenticated API call returns 401 |
| Header supplied role grants access without credentials | Make the header role path impossible when running in production; fail fast if the switch is set |
| Deterministic SuperTokens password bypasses the PIN lockout | Remove the fallback; provision credentials explicitly, force a reset on first login |
| Null hash PIN backdoor (well known PINs on hash-less accounts) | Remove the branch; require a real PIN hash |
| Shipped default and shared secrets that only warn | Turn the warning into a hard boot failure outside local |

These are not APK work, but the APK must not ship on the demo posture, so they are Phase 0 prerequisites in Section 24.

---

## 4. Authentication architecture (reuse, adapted for cross origin)

Reuse the existing SuperTokens plus badge and PIN mechanism. Preserve the identity model, the role model, the company and plant scoping, the machine assignment, the shift assignment, the session model, and the logout and revocation behaviour. Do not build a parallel auth system.

Two adaptations are needed because the APK is a cross origin client.

### 4.1 Header based token transfer (the cross origin fix)

Inside the APK the WebView origin is `https://localhost` (Capacitor), while the API lives at the plant server. That is a cross origin request. Cookie sessions break here: a cross origin cookie needs `SameSite=None; Secure`, and a WebView refuses to store a `Secure` cookie over cleartext HTTP on the plant LAN, so the session is silently dropped and every following call returns 403.

The fix is to move SuperTokens off cookies and onto header (bearer) tokens, which travel in the `Authorization` header and work over HTTP without a certificate.

| Edit | Where | Change |
|---|---|---|
| Allow the version header in CORS | server CORS config | Add `x-app-version` to `allowedHeaders` so the preflight does not block it |
| Force header transfer, server side | server SuperTokens `Session.init` | Add `getTokenTransferMethod: () => 'header'` |
| Match header transfer, client side | client SuperTokens init | `Session.init({ tokenTransferMethod: 'header' })` |
| Allow the WebView origins | server CORS origins env | Include `https://localhost` and `capacitor://localhost` |

The SuperTokens fetch interceptor then attaches `Authorization: Bearer ...` and auto refreshes. These changes are backward compatible for the same origin web app. Switching transfer methods invalidates in flight cookie sessions once, so users simply log in again.

The lower risk long term posture is TLS on the plant server so the whole path is HTTPS. Header based tokens work with or without it and are the immediate fix; a plant certificate is the follow up.

### 4.2 Secure token storage on device

The web app keeps the access token in `localStorage`, which the audit flags as an XSS exposure (F9). On the native device the token is kept in Capacitor secure storage, not in web storage. This removes the on device exposure and is one of the concrete gains of the APK over the browser PWA.

### 4.3 What is preserved from the existing model

Existing user identity model, existing role model, existing company and plant scoping, existing machine assignment, existing shift assignment, existing session model, existing token and refresh strategy, existing logout and revocation, and existing audit requirements. Where refresh tokens exist, the secure refresh mechanism is kept. Raw passwords, PINs, and long lived secrets are never stored locally; only a derived offline PIN verifier is (Section 12).

---

## 5. Operator context after login

Immediately after sign in the APK fetches only what the operator needs, in one compact call. It does not preload dashboards, analytics, reports, configuration, or unrelated master data.

```
Operator context
├── operatorId
├── employeeNo
├── employeeName
├── role                (must be OPERATOR)
├── plant / company scope
├── assigned machine(s) and line(s)
├── assigned shift + current shift
├── process access (which of TM/FUR/STP/DRW/SWG this operator may capture)
└── the minimal shopfloor config the consoles need
```

If the existing `/auth/me` plus per process access responses already carry this, compose the context from them rather than adding a new endpoint. Add a single `/operator/context` compact response only if composing from existing endpoints costs extra round trips at startup. Either way the payload is a compact DTO, not the full user, company, and plant object graph.

---

## 6. Build target and app shell

### 6.1 Operator entry and router

Add an operator entry (`operator.html` plus an operator `main` and an `OperatorApp` router) alongside the existing web entry. The operator router keeps only the operator routes: login, the line home redirect, the five capture consoles, the shift handover, and the operator's own shift summary. Every other path resolves to a redirect back to the line home, so an operator can never reach the management surface even by typing a URL.

Reuse the existing providers (auth store, query client, theme, glove mode once added) exactly as the web app wires them. Mount the persistent sync status badge inside the operator shell so the pending and parked counts are always visible.

### 6.2 Operator Vite config and environment driven API base

Add an operator Vite config that builds the operator entry to its own output directory and drops the PWA service worker plugin (Capacitor owns the app shell on the device; the web PWA layer is not used in the APK). Define a compile time flag (for example `__OPERATOR_BUILD__`) so the small number of shared components that must hide cross module navigation can branch without changing web behaviour.

The API base must not be relative in the APK. Inside the WebView a relative `/api` resolves against `https://localhost` and never reaches the server. Make the base environment driven:

- Web build: the API base env is unset, so behaviour is exactly as today (relative `/api`, same origin).
- Operator build: the API base is set to the plant server URL, ideally delivered as MDM managed app configuration or a bootstrap config fetched at first run, so the same signed APK points at the correct plant without a rebuild.

Apply the same environment prefix to any secondary API client the shared services import, so no stray relative call silently fails in the APK.

### 6.3 Build scripts

Add scripts for the operator dev server, the operator production build, the Capacitor sync, and the release APK assembly. Keep them thin wrappers over Vite, Capacitor, and Gradle.

---

## 7. Capacitor shell

### 7.1 Minimal plugin set

Install only what the APK actually uses. Every plugin is a size and maintenance cost.

| Plugin | Why it is needed |
|---|---|
| core, android, cli | the Capacitor runtime and Android platform |
| network | detect connectivity changes to trigger sync and pause polling |
| preferences / secure storage | secure on device token and small state |
| app | lifecycle events, foreground and background transitions |
| splash screen | fast branded launch, short duration |
| a native SQLite plugin | the on device outbox and caches (Section 8) |
| keep awake | line mounted tablet, screen always on during a shift |

Do not add Google Play services, Firebase, analytics, ad SDKs, or a charting or animation library. This is an on prem plant app; it must run with zero Google account and zero internet on the plant LAN.

### 7.2 Config and native bootstrap

Configure the app id, app name, and the operator build output as the web directory, with the HTTPS Android scheme. If the plant server is HTTP only, permit cleartext to that single host through a scoped network security config, never globally; prefer fixing TLS on the server.

The native bootstrap runs before React mounts: open the SQLite database, start the sync engine (timers and network listeners), and on a real device keep the screen awake.

---

## 8. Offline first local storage

Use the lightest reliable native persistence: SQLite on the device. It survives an Android WebView storage eviction and a reboot, which browser storage does not reliably do. On the web dev target the same repository interface falls back to an IndexedDB backed store, so the operator build still runs in a desktop browser during development.

Persist only what the operator needs to execute. Do not replicate the backend database onto the tablet.

Schema (five tables, small and bounded):

```sql
-- write ahead queue for every operator mutation
CREATE TABLE outbox (
  id            TEXT PRIMARY KEY,   -- client generated idempotency UUID
  aggregate_key TEXT NOT NULL,      -- ordering partition, e.g. run:<runId> or shift:<shiftId>
  seq           INTEGER NOT NULL,   -- monotonic within an aggregate
  url           TEXT NOT NULL,
  method        TEXT NOT NULL,      -- POST | PATCH
  payload       TEXT NOT NULL,      -- JSON
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | inflight | synced | parked
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    INTEGER NOT NULL,
  synced_at     INTEGER
);
CREATE INDEX idx_outbox_agg ON outbox (aggregate_key, seq);

-- read only reference data the consoles need offline; server wins
CREATE TABLE master_cache (
  table_name TEXT NOT NULL, row_id TEXT NOT NULL, data TEXT NOT NULL,
  updated_at INTEGER NOT NULL, PRIMARY KEY (table_name, row_id)
);

-- the operator's planned work for the shift
CREATE TABLE work_cache (
  work_key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL
);

-- offline PIN verifier + role/line binding (never the PIN itself)
CREATE TABLE auth_cache (
  user_code TEXT PRIMARY KEY, pin_verifier TEXT NOT NULL,
  display_name TEXT, role TEXT, line_code TEXT, cached_at INTEGER NOT NULL
);

-- sync cursors and small key/value state
CREATE TABLE sync_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
```

Local data set: operator session context, assigned machine, current shift, planned work, the process and checklist templates the five consoles use, the relevant machine configuration, the current execution state, pending transactions, and sync metadata. Retention: keep synced outbox rows for 30 days for on device audit, then prune. Cache tables are bounded by scope (this operator, this line, this shift), so they do not grow without limit.

---

## 9. Outbox and ordered sync engine

Operator actions that modify data are persisted locally before any network attempt, then synced in order with backoff and poison handling. The application must never lose a completed action because the network disappeared, and must never create a duplicate on retry.

The existing outbox is close but has two defects the audit named (F12: stops on the first failure, does not treat a 409 as success) and one on the server (F11: reports every insert error as a duplicate). This build formalises the pattern and fixes those.

### 9.1 The single write choke point

Every operator mutation routes through one function. It writes to the outbox first (write ahead), then triggers an immediate push when online. Client side validation from the shared ruleset runs before enqueue, so a rejected write is caught on the device and a parked server rejection stays rare.

```
submitOrQueue({ url, method, payload, aggregateKey })
      |
enqueue to outbox (status = pending)   <-- always, before any network
      |
trigger syncNow('submit')              <-- push immediately if online
      |
return { queued: !online }             <-- optimistic: UI shows "saved locally"
```

The capture consoles switch their success message from "server accepted" to "saved on this tablet, sync badge shows the rest."

### 9.2 Ordering model

`aggregate_key` partitions the queue by the unit of work, for example the current run or the current shift log. Within an aggregate, actions replay strictly in `seq` order (open, entries, stoppages, defects, submit). Across aggregates, replay is parallel safe. A single writer per line for transactional data (enforced by the device to line binding) means true conflicts do not arise; masters and plan are server wins.

### 9.3 Failure semantics

| Result | Handling |
|---|---|
| 2xx, or 409 duplicate idempotency key | mark synced. A 409 means the server already has it, so the item is done and is removed. This fixes the poisoning defect |
| Network error, 5xx, timeout | bump attempt, retry with exponential backoff (30s, 1m, 5m, 15m cap); the aggregate blocks but other aggregates continue |
| Other 4xx (validation reject) | park the item; the aggregate halts and the badge turns red; a supervisor resolves it with the existing override. A parked item never blocks other aggregates and is never retried automatically |

### 9.4 Sync cadence and visibility

Sync runs on submit, on reconnect (network listener), and on a fixed interval (every 5 minutes). A Zustand backed sync status store drives a badge in the shell: grey when the queue is empty, amber with a pending count, red with a parked count. Tapping the red badge lists the parked actions with the server error text and a supervisor PIN gated discard. This is the mechanism that stops a tablet silently stalling with dozens of unsynced entries.

Add request timeouts and bounded retry on reads too: bare fetch on a weak signal hangs the socket for minutes and blocks the UI. Wrap reads in an abort controller with a short timeout and back off, pausing when offline. This is the single biggest cause of read and write lag in weak signal zones.

---

## 10. Server idempotency

The client sends an idempotency key on every mutation. The server must dedupe so a replay never creates a duplicate production record, session, checklist execution, or transaction.

1. A dedupe table keyed on the idempotency UUID storing the response status and body and a created timestamp.
2. Middleware in front of the operator mutation routes: if the key exists, replay the stored response (or a plain 409 if the body was not stored); otherwise run the handler and store the key and response in the same transaction as the write.
3. Distinguish a genuine duplicate (a unique key violation) from a transient error, so a real failure is not masked as a duplicate (fixes F11).
4. Stamp a server received timestamp on these writes; tablet clocks drift, so the client timestamp is advisory and the server time is authoritative.

Give the dedupe table a retention or cleanup rule so it does not grow without bound over years of operation.

---

## 11. Pull sync (masters and planned work)

The consoles need reference data and the shift plan offline. This is server owned; the tablet is read only and the server always wins.

- **Server:** delta endpoints for master data and for the operator's planned work, filtered by the operator's line and updated since a cursor. If update timestamps are missing on the master tables, fall back to full snapshot responses; at master data scale (hundreds of rows) a snapshot every few minutes is acceptable.
- **Client:** a pull function reads the cursor from `sync_meta`, calls the delta endpoint, upserts into the caches, and stores the returned server time as the new cursor. Operator read paths use a cache first helper: serve from SQLite immediately, refresh from the network when online.
- **Cadence:** on shift open, on the 5 minute engine tick, and on reconnect. A plan changed while the tablet was offline simply appears at the next sync; there is no conflict because the tablet never writes masters or plan.

Only synchronise what the operator needs. Do not send every machine, shift, or plant record to the device.

---

## 12. Offline PIN login

Badge and PIN login must work when the line Wi-Fi is down at shift start.

1. **First online login per operator per device:** after a successful sign in, derive a verifier `scrypt(pin, salt = userCode + deviceId)` on the device and store it in `auth_cache` with the role and line binding. Never store the PIN itself.
2. **Offline login:** if the login call fails with a network error and `auth_cache` has the operator, verify the PIN against the verifier and create a local degraded session marked offline. The protected route treats it as authenticated for operator routes only. The lockout counter applies to offline attempts too.
3. **Attribution and upgrade:** every queued action already carries the operator identity from the session. On reconnect the engine performs a real token refresh or login first, then pushes the outbox, so entries are attributed server side exactly as if the operator had been online.
4. **Expiry:** an offline session is valid for at most one shift plus a margin (about 14 hours); an `auth_cache` entry expires after 30 days without an online login.

---

## 13. API scope

Reuse existing endpoints. Do not blindly create new routes if equivalent ones exist; the client should not call broad management APIs at all.

Before writing anything new, inspect the existing backend for the auth endpoints, the operator and workforce endpoints, the session and context endpoints, the per process capture endpoints (open, entry, stoppage, defect, crew, submit for TM, FUR, STP, DRW, SWG), the master data and planned work reads, and the existing authorization guards. Reuse them.

The operator surface the APK actually calls, mapped to intent:

| Intent | Reuse or add |
|---|---|
| Login, refresh, logout | reuse existing auth (badge plus PIN, SuperTokens) |
| Who am I, operator context | reuse `/auth/me` plus process access, or add one compact `/operator/context` if it saves round trips |
| Current shift, assigned machine | reuse existing shift and machine reads, filtered to the operator |
| Planned work for the shift | reuse the existing queue or planned work read, filtered by line |
| Process templates and checklists | reuse existing; cache locally |
| Open and update a process run, capture entries, stoppages, defects, submit | reuse the existing per process capture endpoints |
| Sync push | the outbox replays to the existing per process endpoints with the idempotency header; no separate push endpoint is required |
| Sync pull | reuse or add the delta reads in Section 11 |

Introduce a new endpoint only where the existing architecture cannot serve the APK cleanly, chiefly the delta reads and the compact context if composing costs extra round trips. Everything else is reuse.

---

## 14. Backend authorization

Frontend restrictions are not sufficient. Every endpoint the APK calls must enforce, server side:

```
Authenticated session
        +
role == OPERATOR
        +
valid company scope
        +
valid plant scope
        +
valid machine assignment
        +
valid shift / session context
        +
ownership of the record being read or written
```

An operator must not reach another operator's data by changing an id in the request. The server validates ownership and assignment on every read and write, not just the presence of a session. The existing per process and per machine access guards already implement rank and ACL checks; the work here is to confirm they are applied on every operator route the APK touches and that they fail closed once Section 3.3 is done.

---

## 15. Machine and shift scoping

Operator data is restricted to the machines and shifts assigned to that operator.

```
Operator
   -> assigned machine(s)
      -> assigned shift
         -> available work for that line and shift
```

The context, the plan, and the caches are all filtered to the operator's assignment. The tablet is bound to a line (Section 22), which reinforces the single writer per line model the sync engine relies on. Nothing broader than the operator's assignment is ever synced to the device.

---

## 16. Lightweight APK strategy

The APK is deliberately optimised for a small footprint. The principles below are applied and then verified with a bundle report and an installed size measurement, not assumed.

Use:

- a minimal dependency set (Section 7.1) and nothing beyond it
- production Vite builds with tree shaking and minification
- route level code splitting on the five capture consoles, so the first paint does not pull every console at once (the current build eagerly imports all pages, some over 2000 lines; this is a measured win)
- compact assets, no large images, no bundled fonts beyond what the brand needs, no icon set that is not used
- cache first reads and incremental delta sync, so the device does the least network work
- compact API payloads and pagination on any list
- debounced and batched requests where a screen fires several reads on mount

Avoid:

- large media, video backgrounds, heavy animations
- unused screens, the excluded role modules, management dashboards
- charting or large UI framework libraries
- a second state management system or a second API client
- Google Play services, Firebase, analytics, ad SDKs

Bundle purity guard in CI: after the operator build, fail the pipeline if the output contains chunks or strings from the excluded surface (the management, planning, analytics, admin, and maintenance trees). This catches an accidental re inclusion that would bloat the bundle and widen the attack surface.

---

## 17. Startup performance

```
Launch
  -> load a minimal shell (splash, short duration)
  -> open SQLite, read the local session
  -> validate the session (or accept the offline degraded session)
  -> render the operator context from cache immediately
  -> sync in the background
  -> workspace usable
```

The APK does not download the full data set at startup. It shows useful cached information at once and refreshes in the background. Code splitting keeps the initial bundle to the login and shell, with each console loaded on demand.

---

## 18. Data payload optimisation

API responses are purpose built for the tablet. Do not return unused fields, management metadata, analytics, audit history, large nested objects, or unrelated master data. Prefer compact DTOs. For example the operator context is a flat object of ids and names, not the full user, company, and plant graph:

```json
{
  "operatorId": "op-123",
  "employeeNo": "GLI-A59-014",
  "name": "Operator Name",
  "role": "OPERATOR",
  "plantCode": "A59",
  "lineCode": "TM-1",
  "shiftId": "shift-B",
  "processAccess": ["TM", "FUR", "STP", "DRW", "SWG"]
}
```

Add ETag or If-None-Match on read endpoints so an unchanged read is a cheap 304, and confirm gzip or brotli compression is on for API JSON at the reverse proxy. These reduce payload and round trips on a weak signal without any client change.

---

## 19. Session recovery

If the APK is closed or the tablet restarts, no active work is lost.

```
Tablet restart
  -> open APK
  -> recover the local session (or offline degraded session)
  -> recover the active operator work from SQLite
  -> recover pending outbox transactions
  -> resume
```

Because the outbox and the execution state live in SQLite, not in WebView memory or evictable browser storage, a kill from recents or a reboot leaves the queue intact and the operator continues where they left off.

---

## 20. Security

- HTTPS to the server where the plant provides a certificate; header based bearer tokens make login work over the plant LAN in the interim (Section 4.1).
- Secure token storage on the device (Section 4.2), which removes the browser storage token exposure.
- Role enforcement server side, company and plant scoping, machine assignment validation, and ownership checks (Section 14).
- Session expiration, logout, and revocation reuse the existing behaviour.
- No plaintext credentials, no PIN, no token, and no secret in logs (Section 24).
- No backend secret, no database credential, and no ERP credential is ever embedded in the APK. The APK talks only to the backend, never to the database and never to the ERP.
- The auth blockers in Section 3.3 are closed before the APK reaches a real operator.
- Production build hardening: the operator build is a production Vite build; the excluded surface is not compiled in; the bundle purity guard runs in CI.

---

## 21. Kiosk and device behaviour

The tablets are company owned and dedicated to one line, so the APK runs as a single app kiosk the operator cannot leave.

- **Device owner lock task (COSU):** on launch, if the app is the device owner, whitelist itself for lock task and start it. The operator cannot reach Home, Recents, the notification shade, or the power menu. Immersive sticky fullscreen hides the status and navigation bars. Landscape orientation, screen on, show when locked.
- **Maintenance exit:** a hidden gesture (for example five taps on the shell logo) plus a supervisor PIN calls stop lock task, exposed as a small native method invoked only after the web layer verifies the PIN.
- **Without device owner:** lock task degrades to screen pinning, which is escapable and is acceptable for bench testing only. Do not treat that as production kiosk.
- **Fleet management (MDM):** an MDM owns enrollment, APK install and update, kiosk policy, Wi-Fi config, compliance, remote wipe, and last seen monitoring. The device to line binding stays in the app (Section 22). Keep kiosk configurable rather than hardcoded, so a device can be taken out of kiosk for service.

Device concerns to handle: orientation lock, screen size variation across tablets, the Android versions in the fleet (TBD), network loss, app restart, background and foreground transitions, battery and storage use, clock and timezone consistency (stamp server received time), device sleep (keep awake during a shift), and accidental navigation away (kiosk prevents it).

The MDM manages the device; the backend manages the application. The device id from the enrolled tablet is recorded by the backend against captures for traceability, but wipe, restrict, and update are the MDM's job, not the app's.

---

## 22. Device registration and line binding

If the platform supports device registration or pairing, reuse it; do not embed static device credentials in the APK.

At first launch, a setup step binds the tablet to its plant, line, and device record, reusing the existing device registration flow. That binding is what enforces the single writer per line model the sync engine depends on, and it is what stamps the device id onto every capture for traceability. The MDM can deliver the plant server URL as app configuration at the same time, so the same signed APK works on any line without a rebuild.

---

## 23. Error handling and operator UX

Errors are understandable to an operator. Technical detail goes to the logs, not the screen.

| Situation | What the operator sees |
|---|---|
| Sync cannot reach the server | "Unable to sync right now. Your work is saved on this tablet and will sync automatically when the connection returns." |
| Wrong badge or PIN | "Invalid operator ID or PIN." |
| Non operator account | "This account is not permitted to use this application." |
| A write parked on a server rule | a clear message plus a supervisor resolve path; never a raw HTTP status or stack trace |

Never surface HTTP 500, a null reference, a database error, or a token validation message.

Reliability and touch fixes the audit named, folded into this build:

- **Root error boundary (F8):** a render fault must not blank the operator console mid shift. Add a boundary with a "reload, your offline data is safe" fallback and an offline banner.
- **Glove mode touch targets (F35):** the operator surfaces need 44 to 56px hit targets for gloved use; the current buttons are about 36px. Raise the operator surface control minimum height and apply it on the five consoles. This is the single most material UX gap for the actual use context.
- **Input label association and loading states (F25):** associate every input with its label in the shared input component, and add skeletons on the capture and dashboard fetches so views do not flash blank.
- **Demo credentials off in production (F36):** the login screen must not advertise working demo badges and a default PIN outside development.
- **Positive confirmation (F38):** a lightweight success toast on save and submit, so an operator on a noisy floor knows a write landed.

The information architecture, action rail, status visibility, and offline handling in the existing operator shell are strong and are preserved; these are refinements to a sound system.

---

## 24. Logging and diagnostics

Lightweight structured diagnostics that help troubleshooting without bloating the APK or the device storage.

Log (structured, on the device and to the server where reachable): login success and failure, sync started and completed, sync failures, API failures, outbox state (pending, parked counts), application errors caught by the boundary, and device registration state. Carry a request id and the device id so a tablet's trouble ("tablet 17 failed to sync at 3:20 pm") is traceable end to end through the server logs.

Never log: passwords, PINs, tokens, the auth key, the ERP credential, or any secret. Configure redaction so a token or credential inside an object is stripped before it is written.

---

## 25. Phased implementation plan

Each phase is independently testable on a real tablet. The auth hardening in Phase 0 is a prerequisite for a real deployment and can proceed in parallel with the APK build phases, but the APK does not reach a real operator until it is done.

| Phase | Deliverable | Sections |
|---|---|---|
| **P0 Prerequisites** | Close the auth blockers so the deployed app fails closed; harden the outbox and idempotency defects; add the root error boundary | 3.3, 9.3, 10, 23 |
| **P1 Existing architecture audit** | Document the current mobile and offline architecture, framework, build, auth, API client, state, local storage, sync, and current APK size and startup, before writing new code | 0, this plan |
| **P2 Operator scope definition** | Lock the capability matrix; wire the operator entry, router, Vite config, environment driven API base, and the compile time flag | 1, 6 |
| **P3 Backend and API layer** | Confirm and reuse the operator endpoints; close the auth enforcement; add the idempotency dedupe and any delta reads; confirm authorization and ownership on every operator route | 4, 10, 13, 14 |
| **P4 Capacitor shell online** | The APK builds, installs, and runs online against the plant server; header based auth works; an operator captures and submits online | 4, 6, 7 |
| **P5 Offline and sync** | SQLite storage, the ordered outbox and sync engine, cache first pull, offline PIN, sync badge, session recovery | 8, 9, 11, 12, 19 |
| **P6 Optimisation** | Code splitting, payload trimming, the bundle purity guard, timeouts and retry on reads; measure APK size, startup, memory, request count, and payloads | 16, 17, 18 |
| **P7 Kiosk and release** | Device owner lock task, MDM enrollment, device to line binding, signed release, versioning and forced update floor | 20, 21, 22 |
| **P8 Security testing and UAT** | Verify the security matrix; deploy to a controlled environment that mirrors production; test on real tablet hardware across a full shift | 26 |

### P5 offline drill (the acceptance test that matters most)

1. Airplane mode on: badge and PIN login succeeds for a previously cached operator.
2. Open a run, capture entries on a process form plus a stoppage plus a defect: all saved, badge shows the pending count.
3. Kill the app from recents, relaunch: the queue is intact (SQLite, not WebView storage).
4. Airplane mode off: within seconds the badge drains to synced; the server shows each record once, in order, correctly attributed, with a server received timestamp.
5. Force a mid queue server failure, then recover: replay resumes without duplicates (idempotency).
6. Submit a record that violates a server only rule: it parks, the badge turns red, other lines keep syncing, and the supervisor PIN discard works.
7. Change the plan on the server while the tablet is offline: after reconnect the work queue shows the update.

---

## 26. Definition of done

The build is complete only when all of the following hold:

- Only operator accounts can log in; the other roles are blocked at the backend, not just hidden.
- Auth fails closed on every operator route; the header role path, the deterministic password, the null hash PIN, and default secrets are gone.
- Operator data is scoped to the operator; machine and shift assignment and record ownership are enforced server side.
- Existing business logic, validation rules, and the data model are reused, not duplicated.
- Offline capture works; a completed action survives a network loss, an app kill, and a tablet reboot.
- The outbox syncs reliably in order with backoff and visible parking; a 409 is treated as success and one stuck item never blocks the queue.
- Retries cannot create duplicate records; server idempotency is proven.
- The APK is lightweight: measured APK, download, and installed size are recorded; the excluded surface is not in the bundle and CI proves it.
- Startup is fast and shows cached data immediately.
- API payloads are compact; code splitting and delta sync are in place.
- Tokens are in secure device storage; no secret is embedded in the APK; no secret is logged.
- Kiosk lock task holds; the maintenance exit works; the MDM can push a version and roll one back.
- UAT passes on the target tablet hardware across a full shift, including the offline drill.
- The production APK can be built reproducibly and signed from a securely stored, backed up keystore.

---

## Appendix A. New code (thin native and offline layer)

```
client (operator build)
├── operator entry (html + main + OperatorApp router)
├── operator Vite config (no PWA plugin, own output dir, __OPERATOR_BUILD__)
├── environment file with the plant API base (or MDM app config at runtime)
├── native bootstrap (open db, start sync, keep awake)
├── db: sqlite open + the outbox repository (idb fallback for web dev)
├── sync: engine, pull, submitOrQueue choke point, sync status store, sync badge
└── android project (kiosk activity, device admin receiver, exit method)

server
├── idempotency dedupe table + middleware on operator mutation routes
├── delta read endpoints for masters and planned work (if not already present)
└── (optional) one compact /operator/context response
```

## Appendix B. Edits to existing code

| Area | Edit |
|---|---|
| Client API client | environment driven API base; version header; a raw request variant the sync engine can call |
| Client auth init | header based token transfer; degraded offline session accepted for operator routes |
| Client secure storage | token to Capacitor secure storage on native, not web storage |
| Operator mutation call sites | route through the submitOrQueue choke point |
| Operator read paths | cache first via the pull helper |
| Server CORS | allow the version header; include the WebView origins |
| Server SuperTokens session | force header transfer |
| Server auth config | fail closed in production; remove the header role path, the deterministic password, and the null hash PIN |
| Server outbox and idempotency | treat 409 as success, do not block the queue; distinguish a real error from a duplicate; stamp server received time |
| Shared UI | root error boundary; glove sized touch targets; input label association; demo credentials gated to dev; success toast |

## Appendix C. Locked decisions

1. The APK is a second build target of the existing operator client, not a fork. Web and APK share one codebase, one API, one data model.
2. Capacitor WebView shell. No React Native, no second UI framework, no TWA.
3. SQLite for the on device outbox and caches; an IndexedDB fallback for the web dev target only. 30 day retention of synced rows.
4. Header based bearer tokens for the cross origin APK; secure device storage for the token; TLS on the plant server as the follow up.
5. Conflict model: single writer per line for transactional data (device to line binding), server wins for masters and plan, no merge engine.
6. Sync cadence: on submit, on reconnect, every 5 minutes. Backoff 30s, 1m, 5m, 15m cap. 4xx validation parks and halts its aggregate only.
7. Kiosk is device owner lock task, managed by an MDM at fleet scale, configurable rather than hardcoded.
8. No Google Play services, Firebase, analytics, or ad SDKs. The APK runs on the plant LAN with zero Google account and zero internet.
9. Auth must fail closed before the APK reaches a real operator. This is a hard prerequisite, not a later hardening step.

## Appendix D. Open items to confirm

Windows Server version; the number of tablets on A-59 and the concurrency at shift change; whether tablets are on the plant LAN or reach the server across the internet; the MDM platform; whether the plant server has a certificate for HTTPS; the Android versions in the fleet; and whether the existing device registration flow covers the tablet to line binding or needs a small addition. None of these change the architecture above; they size and configure it.
