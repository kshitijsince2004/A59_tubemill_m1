# ZEDRAL Shift Handover, Health Assessment and Fix Plan

Audience: dev team and IDE. Scope: the shift handover subsystem in `zedral_test-share-the-code`, checked end to end, with a targeted fix and A59 build plan. This document is standalone: every method, route, table and file is named with its path.

## 0. Verdict

Shift handover is fundamentally working and mature. The core lifecycle is well guarded, transactional, idempotent, and has an automatic safety net for forgotten handovers plus a self healing sweep for stranded coils. It has clearly been hardened over time (a run of fix migrations for status priority, boundary uniqueness, auto complete status, and tenant row level security).

It is not perfect. There is one defect that should be removed before the next deploy, one real gap for the Goodluck A59 processes, and a few smaller items. None of these break the CRM and process lines that exist today, but the A59 gap must be closed before Furnace, STP and Draw Bench go live.

| Item | Type | Priority |
|---|---|---|
| Debug telemetry beacon shipped in `journeyHandoff.ts` | defect | fix now |
| A59 processes have no process shaped outgoing handover page | gap for A59 | before A59 go live |
| A59 process codes not registered in the handover route ACL set | gap for A59 | before A59 go live |
| Journey self heal does not cover A59 processes | note | Phase 2, only if A59 joins the journey engine |
| `getHandoverOverview` still references the SUPERVISOR role | consistency | folds into the role consolidation |
| Stale comment on `HandoverAcceptGate` | cosmetic | optional |

## 1. How handover works today

### 1.1 The two sides

Handover has an outgoing side (the operator leaving) and an incoming side (the operator arriving). The record lives in `txn.machine_handover`. The operator session lives in `txn.machine_shift_session`.

States on `txn.machine_handover.status`: `DRAFT`, `PENDING`, `ACCEPTED`, `CLARIFICATION_REQUESTED`, `AUTO_COMPLETED`.

```
Outgoing operator                         Incoming operator
------------------                        ------------------
buildOutgoingPreview  (read live state)
saveDraftHandover     -> DRAFT
createOutgoingHandover-> PENDING  ....... getPendingForMachine
   closes ACTIVE session                  acceptHandover -> ACCEPTED
   validates shift log                        closes old session
   20 char remarks minimum                    opens new session for incoming op
   cannot submit before shift end             carry forward of open work
                                            or requestClarification -> CLARIFICATION_REQUESTED
```

### 1.2 Server surface

`packages/server/src/services/MachineHandoverService.ts` (about 1140 lines) and `packages/server/src/routes/machineHandoverRoutes.ts`, mounted at `/machines/handover`, rate limited to 60 requests per minute.

| Method | Route | What it does |
|---|---|---|
| `buildOutgoingPreview` | `GET /:machineCode/preview` | assembles live shift, active order, production summary, open stoppages, utilization, crew snapshot and roster, queue snapshot |
| `saveDraftHandover` | `POST /:machineCode/draft` | upsert of a DRAFT for this operator and machine |
| `createOutgoingHandover` | `POST /:machineCode/outgoing` | promotes DRAFT to PENDING inside a transaction, closes the ACTIVE session, writes a `HANDOVER_CREATED` audit row, finalizes shift summary, publishes `shift.closed` |
| `acceptHandover` | `POST /accept/:handoverId` | PENDING to ACCEPTED in a transaction, closes old session, opens the incoming session with its shift log, carries forward open work, idempotent on retry |
| `requestClarification` | `POST /clarification/:handoverId` | PENDING to CLARIFICATION_REQUESTED with notes, idempotent |
| `ensureActiveSession` | `POST /:machineCode/session` | starts or resumes a session on login, blocks when a pending handover is unaccepted, guards against a second operator with `ACTIVE_SESSION_CONFLICT` |
| `getHandoverOverview` | `GET /overview` | Machine Head and Plant Head queue view, pending and recent, filtered to machine scope |
| `listPendingForMachines`, `getPendingForMachine`, `getDraftForMachine` | `GET /pending`, `GET /:machineCode/pending`, `GET /:machineCode/draft` | list and detail reads |
| `assertProductionAllowed` | called by capture paths | blocks production writes until the incoming operator accepts the pending handover |

Access control: process lines (`HRS`, `PKL`, `ANN`, `RWD`, `CRS`, `CTL`) use line ACL via `assertLineOperation`, CRM mills use machine ACL via `assertMachineAccess`. See `PROCESS_HANDOVER_CODES` in `machineHandoverRoutes.ts`.

### 1.3 Automatic boundary safety net

`packages/server/src/services/ShiftBoundaryService.ts` plus `packages/server/src/jobs/ShiftBoundaryScheduler.ts`. Every 60 seconds (`SHIFT_STALE_SWEEP_MS`) the scheduler runs `processStaleSessions`. When a session is past shift end plus the overtime grace and no operator submitted a handover, it closes the session and, when `AUTO_BOUNDARY_HANDOVER` is `shadow` or `on`, writes an `AUTO_COMPLETED` handover with `created_by_boundary = true`, carries forward open work, and publishes `shift.closed`. A `PENDING_RACE` guard prevents a double write when an operator submits at the same moment. Live overtime sessions inside the grace window stay open. This is the safety net that stops a forgotten handover from stranding a shift.

### 1.4 Self heal for stranded coils

`packages/server/src/services/journeyHandoff.ts` plus `packages/server/src/jobs/JourneyHandoffScheduler.ts`. Every 60 seconds it reconciles coils whose next journey step was never enqueued after a completed order (lost `production.captured` on an in memory bus or a restart). It also backfills INV-1 violations (an active queue backed step with a null `queue_batch_id`). Counters live in `handoffMetrics.ts`.

### 1.5 Client surface

| Concern | File |
|---|---|
| Outgoing page selection | `classifyHandoverBranch.ts` chooses ann, pkl, hrs, rwd, crm or process fallback; `ScopeHandoverRoute.tsx` mounts it |
| Incoming accept gate | `HandoverAcceptGate.tsx`, mounted in both `components/process/ProcessLayout.tsx` and `components/sixHi/SixHiLayout.tsx` |
| Accept page | `pages/sixHi/HandoverAcceptPage.tsx` calls `machineHandoverService.accept` |
| State hooks | `hooks/useHandoverState.ts` (SWR pending, preview, draft with 8 second dedupe) |
| API client | `services/machineHandoverService.ts` |

### 1.6 What is fine (do not touch)

The transactional session close and reopen, the idempotent accept and clarification with version conflict handling, the production block until accept, the 20 character remarks minimum, the cannot submit before shift end rule, the shift log validation gate before submit (`ShiftLogValidationService.assertValid`), the auto boundary sweep with the race guard, the carry forward of open work (`reparentOpenWork`), the self heal sweep, and the accept gate on both layouts. This is a solid core. The fixes below are surgical and must not regress any of it.

## 2. Issues and fixes

### 2.1 Defect: debug telemetry beacon shipped in production

`packages/server/src/services/journeyHandoff.ts`, inside `assertCompletedHrsPklProd`, there is a block marked `// #region agent log` that fires an HTTP POST on every HRS and PKL order end:

```
fetch('http://127.0.0.1:7577/ingest/58d95c05-...', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'beb2a9' },
  body: JSON.stringify({ sessionId: 'beb2a9', ... hypothesisId: 'D' ... }),
}).catch(() => undefined);
```

This is leftover agent debugging. It runs on a hot path (every order end), makes a network call to a hard coded localhost port, and embeds debug session identifiers. In production the call fails and is swallowed, so it is not visible, but it is dead code that should never have shipped.

Fix: delete the entire `#region agent log` to `#endregion` block. No replacement. Then grep the repo for the same pattern and remove any sibling beacons:

```
grep -rn "127.0.0.1:7577\|X-Debug-Session-Id\|#region agent log\|hypothesisId" packages
```

This is the one change to make before the next deploy.

### 2.2 Gap for A59: process shaped outgoing handover page missing

`packages/client/src/pages/process/ProcessHandoverPage.tsx` is a stub:

```
export { CrmOutgoingHandoverPage as ProcessHandoverPage } from '../sixHi/CrmOutgoingHandoverPage';
```

Its own comment describes it as the fallback process handover for CRS, RWD and CTL, "still CRM shaped until forked".

`classifyHandoverBranch.ts` only maps `ANN`, `PKL`, `HRS`, `RWD`, `CRM`. Every other process code, which includes the A59 Furnace, STP and Draw Bench, falls to `process-fallback` and renders the CRM shaped page. So the A59 processes have no outgoing handover UI that matches their reports.

Fix, following the existing `AnnOutgoingHandoverPage` pattern:

1. Add `FUR`, `STP`, `DB` branches to `classifyHandoverBranch.ts` and the `HandoverBranch` type.
2. Create `FurOutgoingHandoverPage.tsx`, `StpOutgoingHandoverPage.tsx`, `DbOutgoingHandoverPage.tsx` under `packages/client/src/pages/process/`, each rendering the process appropriate outgoing fields (Furnace zone status, STP bath sign off, Draw Bench tooling and pass state) on top of the shared handover submit payload.
3. Mount them in `ScopeHandoverRoute.tsx`.

The server payload already carries generic fields (machine status, condition, remarks, downtime, scrap, shift remarks, order snapshot, selected crew), so no server change is needed for the fields, only the client pages.

### 2.3 Gap for A59: process codes not registered in the route ACL set

`PROCESS_HANDOVER_CODES` in `packages/server/src/routes/machineHandoverRoutes.ts` is `{ HRS, PKL, ANN, RWD, CRS, CTL }`. The A59 codes (`FUR`, `STP`, `DB`, and Tube Mill's code) are not in it, so those handovers fall to machine ACL rather than line ACL in `assertHandoverCodeAccess`.

Fix: decide the ACL model for A59. If A59 handover should be line scoped like the other process lines, add `FUR`, `STP`, `DB` and the Tube Mill code to `PROCESS_HANDOVER_CODES`. If A59 is purely machine scoped in Phase 1, leave it and confirm the machine ACL path is correct for these machines. Either way, make the choice explicit rather than inheriting the fallback.

### 2.4 Note: journey self heal does not cover A59

`ADVANCE_PROCESSES` and the stranded coil query in `journeyHandoff.ts` are `HRS`, `PKL`, `RWD`, `CRS`, `CTL`. The A59 processes are not in the self heal. This is acceptable for A59 Phase 1, which is manual digitization and not yet on the journey queue engine. When A59 joins the journey engine in a later phase, extend `ADVANCE_PROCESSES`, `PROD_TABLE` and the stranded and INV-1 queries to include the A59 processes. Track it, do not fix it now.

### 2.5 Consistency: SUPERVISOR reference in the overview

`getHandoverOverview` treats `SUPERVISOR` as an all machines role alongside `PLANT_HEAD` and `ADMIN`. This is consistent with the role consolidation being in progress and will be resolved by the profile consolidation plan (SUPERVISOR folds into MACHINE_HEAD). No separate action here beyond making sure the consolidation touches this line: replace the `SUPERVISOR` check so the all machines view is `PLANT_HEAD` or `ADMIN`, and Machine Head stays scoped to its machines.

### 2.6 Cosmetic: stale comment

`HandoverAcceptGate.tsx` says it "Blocks CRM workspace", but it is mounted for process lines too (`ProcessLayout.tsx`). Update the comment so the next reader is not misled. No behaviour change.

## 3. Execution order

1. Remove the debug beacon (2.1). One commit, deploy safe on its own.
2. Decide and set the A59 ACL model (2.3).
3. Build the A59 outgoing handover pages and branches (2.2).
4. Fold the SUPERVISOR overview line into the role consolidation (2.5).
5. Comment and note cleanups (2.4 tracked, 2.6 optional).

## 4. QA and acceptance

- After 2.1, `grep -rn "127.0.0.1:7577" packages` returns nothing, and an HRS or PKL order end makes no outbound localhost call.
- An A59 Furnace, STP or Draw Bench operator opening `/handover` sees a process appropriate outgoing page, not the CRM shaped fallback.
- A59 handover access is enforced by the chosen ACL (line or machine) and an out of scope user is refused.
- Regression: CRM and existing process lines still submit, accept, request clarification and auto complete at boundary exactly as before. Run `npm run test -w @m1/server` for handover, boundary and journey handoff suites, plus the client handover route tests.
- The auto boundary sweep still writes `AUTO_COMPLETED` handovers for forgotten shifts, and the self heal sweep still reconciles stranded coils.

## 5. Bottom line

Handover works, and the engineering is careful: guarded lifecycle, transactional session handoff, idempotent accept, an auto boundary safety net, and a self heal sweep. The must do is removing the shipped debug beacon in `journeyHandoff.ts`. The must do before A59 go live is building the Furnace, STP and Draw Bench outgoing pages and deciding their ACL, because today those processes render a CRM shaped fallback. Everything else is small and can ride along with the role consolidation.

Grounded in `zedral_test-share-the-code`.
