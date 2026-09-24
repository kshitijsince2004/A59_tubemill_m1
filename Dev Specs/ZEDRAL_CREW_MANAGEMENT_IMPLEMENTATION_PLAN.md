# ZEDRAL Crew Management, Implementation Plan

Audience: dev team and IDE. Scope: crew management for Zedral M1 on the Goodluck A59 line (Tube Mill, Furnace, STP, Draw Bench). Grounded in `zedral_test-share-the-code`. This document is standalone: every screen, route, service, table and guard is named with its path.

## 1. What crew management is

Crew management in the codebase is two layers, not one. Keep them distinct.

1. Machine crew roster (master data). The standing list of people who work a machine, held in `master.machine_crew_roster`. One row per person per machine, with a display name and a role label. This is a register the Machine Head maintains.
2. Session crew attribution (transaction data). Who actually worked a given shift session, held in `txn.session_crew`, one row per roster member attached to one `txn.machine_shift_session`. This is captured at operator login and flows into shift review and the DPR exports.

The roster answers "who can work this machine". The session crew answers "who was on this shift". The link between them is `crew_id`: a session crew row points at a roster row.

## 2. Data model

| Table | Purpose | Key columns |
|---|---|---|
| `master.machine_crew_roster` | standing roster per machine | `crew_id`, `machine_code`, `member_name`, `role_label`, `is_active`, `updated_at` |
| `txn.session_crew` | crew attached to a session | `session_crew_id`, `session_id`, `crew_id` |
| `txn.machine_shift_session` | the shift session crew attaches to | `session_id`, `machine_code`, `shift_code`, `prod_date`, `operator_user_id`, `shift_log_id`, `status` |

Migrations already in the repo: `1911000000000_machine_crew_roster.js` (creates the roster), `1922000000000_unify_crew.js` (unifies the crew model), `1929000000000_fix_crew_tenant_guc.js` (fixes the tenant GUC for row level security on crew). Soft delete is by `is_active = false`, never a hard delete (see `MachineCrewService.remove`).

## 3. Backend

### 3.1 Roster service and route

`packages/server/src/services/MachineCrewService.ts`

| Method | Behaviour |
|---|---|
| `list(machineCode)` | active roster for a machine, ordered by name |
| `create({machineCode, memberName, roleLabel})` | inserts a roster row, trims and validates name and role |
| `update(crewId, {...})` | updates name or role on an active row for that machine |
| `remove(crewId, machineCode)` | soft delete, sets `is_active = false` |
| `getOperatorName(machineCode)` and `getOperatorNames(machineCodes[])` | resolve the operator display name from the roster as a fallback when an order has no `logged_in_user_id`. Batched with a 60 second in process cache to avoid N+1 on live order lists |

`packages/server/src/routes/machineCrewRoutes.ts`, mounted at `/machine-crew`.

| Verb and path | Roles | Notes |
|---|---|---|
| `GET /` | OPERATOR, MACHINE_HEAD, ADMIN, PLANT_HEAD | `?machineCode=` required |
| `POST /` | MACHINE_HEAD, ADMIN, PLANT_HEAD | body: machineCode, memberName, roleLabel |
| `PUT /:crewId` | MACHINE_HEAD, ADMIN, PLANT_HEAD | |
| `DELETE /:crewId` | MACHINE_HEAD, ADMIN, PLANT_HEAD | `?machineCode=` required |

Scope is enforced by `assertMachineScope(userId, roles, machineCode)`, which calls `LiveDashboardService.getMachineScope`. Machine Head can only touch machines in scope. The route also detects a missing roster table and returns 503 with a clear "run migrations" message, which is a nice operability touch to keep.

### 3.2 Session crew service and route

`CrewService` in `packages/server/src/services/ancillaryServices.ts`.

| Method | Behaviour |
|---|---|
| `listByShiftLog(shiftLogId)` | joins `txn.session_crew` to the roster for a shift log |
| `listBySession(sessionId)` | same, keyed by session, adds `crewId` for roster preselect |
| `sessionNeedsCrew(sessionId)` | true when a session still has no `session_crew` rows (soft mandatory crew, SPEC2 section 11) |
| `create({shiftLogId, operatorId, roleCode})` | resolves or creates a roster entry for the operator, then inserts a `session_crew` row. Valid role codes: OPERATOR, ASST, HELPER, CRANE, MTL, SHIFT_INCHARGE, SHIFT_MANAGER |
| `attachRosterToSession(sessionId, crewIds[])` | attaches roster members to a session at login, idempotent on `crew_id` |

`packages/server/src/routes/crewRoutes.ts`, mounted at `/crew`.

| Verb and path | Access | Notes |
|---|---|---|
| `GET /?shiftLogId=` | `assertShiftLogAccess(READ)` | list crew for a shift log |
| `POST /` | `assertShiftLogAccess(WRITE)` | create a session crew row |
| `POST /attach` | authenticated | attach roster crew_ids to the active session (crew at login) |

## 4. Client

| Surface | Path | Role |
|---|---|---|
| Roster admin screen | `packages/client/src/pages/machinehead/MachineHeadCrewPage.tsx`, route `/machine-head/crew` under `MachineHeadRoute` | Machine Head maintains the roster |
| Roster API client (offline aware) | `packages/client/src/lib/machineCrewService.ts` | uses `postQueued`, `putQueued`, `deleteQueued` so roster edits survive offline and replay on reconnect |
| Login crew capture | `packages/client/src/components/sixHi/CrewCaptureModal.tsx` | operator selects who is on shift, calls `/crew/attach` |
| Crew snapshot in handover | `MachineHandoverService.buildOutgoingPreview` returns `crewSnapshot` and `machineCrewRoster` | shown on the outgoing handover screen |

The roster client is offline first: create, update and delete go through the sync queue keyed `crew:<machineCode>`, so a Machine Head editing the roster on a shopfloor tablet does not lose edits when the network drops.

## 5. Roles and scope in the 4 role model

Align crew management with the consolidated 4 roles (Operator, Machine Head, Plant Head, Admin).

| Capability | Operator | Machine Head | Plant Head | Admin |
|---|---|---|---|---|
| Read roster | yes, own machine | yes, in scope | yes | yes |
| Add, edit, remove roster | no | yes, in scope | yes | yes |
| Capture session crew at login | yes | n/a | n/a | n/a |
| See crew on shift review and DPR | own | in scope | plant wide | all |

Session crew is soft mandatory (SPEC2 section 11): the operator is re-prompted on login and on resume until at least one `session_crew` row exists, but capture is not hard blocked. `ensureActiveSession` returns `needsCrew: true` on a fresh session, which the client uses to raise the crew popup.

## 6. Crew to shift attribution flow

```
Operator login on machine
  -> ensureActiveSession creates or resumes txn.machine_shift_session
     -> needsCrew true when no session_crew rows
        -> CrewCaptureModal -> POST /crew/attach (crewIds from roster)
           -> txn.session_crew rows created
              -> CrewService.listByShiftLog feeds shift review and DPR export
```

Crew is therefore attributed to the shift log through the session, not entered free form on the report. Shift review and the DPR line log read crew via `CrewService.listByShiftLog(shiftLogId)`.

## 7. A59 specifics

For the Goodluck A59 line, crew management needs the following, most of which is configuration on top of the existing engine.

1. Roster seeded per A59 machine. Admin creates each machine (Tube Mill, Furnace, STP, Draw Bench) in `master.machine` with its `process_code`, then the Machine Head builds the roster per machine in `MachineHeadCrewPage`. No new code, this is data entry once the machines exist.
2. Role label vocabulary. `CrewService.create` accepts OPERATOR, ASST, HELPER, CRANE, MTL, SHIFT_INCHARGE, SHIFT_MANAGER. Confirm this covers A59 shopfloor roles (for example furnace operator, draw bench operator, helper). If A59 uses different role names, extend the `validRoles` list in `ancillaryServices.ts` and the role picker in `CrewCaptureModal`. Keep the roster `role_label` free text as it is today so the plant can use its own labels.
3. Crew on the A59 DPR. When the FUR, STP and DB export layouts are built (see the process build specs), bind the crew block to `CrewService.listByShiftLog` so each process DPR shows who ran the shift, matching the plant formats.

## 8. Gaps and cleanups

Small items to align crew management with the rest of the build.

1. Roster read scope for operators. `assertMachineScope` returns early for OPERATOR, so an operator GET can read any machine roster. Low risk (names only), but if you want strict scope, pass operators through the same `getMachineScope` check on read.
2. Role label consistency. `CrewService.create` writes the role code into `role_label`, while `MachineCrewService` treats `role_label` as a free text display label and infers the operator with an `/operator/i` match. This works but mixes code and label. Decide one convention and apply it in both services.
3. Plant Head write access. Roster CRUD currently allows PLANT_HEAD. If the Plant Head profile is settled as read only (see the Plant Head profile plan, section 6), drop PLANT_HEAD from the `POST`, `PUT`, `DELETE` role lists in `machineCrewRoutes.ts`.

## 9. QA and acceptance

- Machine Head can add, edit and soft delete roster members only for machines in scope, and an out of scope machine returns 403.
- Roster edits made offline replay correctly on reconnect (sync queue keyed `crew:<machineCode>`).
- A fresh session raises the crew popup (`needsCrew: true`) and `/crew/attach` writes `txn.session_crew` rows, idempotent on repeat.
- Shift review and the A59 process DPR show the attributed crew via `listByShiftLog`.
- With the roster table absent, the route returns 503 with the migration hint rather than a 500.
- Tests: `npm run test -w @m1/server` (crew routes and services), client roster service queueing.

## 10. Bottom line

Crew management is already built and sound: a machine roster in `master.machine_crew_roster` maintained by the Machine Head, and per session attribution in `txn.session_crew` captured at operator login, joined into shift review and DPR by shift log. For A59 the work is configuration (seed the roster per Tube Mill, Furnace, STP and Draw Bench machine, confirm the role vocabulary) plus binding the crew block into the new FUR, STP and DB export layouts. The only code decisions are the three small cleanups in section 8.

Grounded in `zedral_test-share-the-code`.
