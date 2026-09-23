# ZEDRAL — Profile Consolidation to 4 Roles · Self-Contained Implementation Plan

**Objective:** reduce the role model to **four profiles — Operator, Machine Head, Plant Head, Admin** — by folding **Supervisor** and **Quality** into **Machine Head**, all functions preserved and machine-scoped. **Audience:** dev team / IDE.

**This document is standalone.** It inlines everything from the two prior specs it used to reference — `SUPERVISOR_REMOVAL_SPEC.md` and the role-relevant parts of `CONSOLIDATION_PLAN.md` / `DB_AUDIT.md` — so no other repo file is needed to execute it. Every file to touch is named with its path (and line number where known). Grounded in `zedral_test-share-the-code`.

---

## 0. Two findings you must read first

**Finding 1 — there are SIX roles today, not five.** `packages/shared-validation/src/types/roles.ts` currently declares `OPERATOR, SUPERVISOR, MACHINE_HEAD, QUALITY, PLANT_HEAD, ADMIN` (ranks 0,0,1,2,3,4). Merging *only* Supervisor leaves **five** roles. To reach the exact four you named, **Quality must also fold into Machine Head.** Quality is small (~9 files) and its function (quality spec sheets + inspection review) is a natural Machine-Head responsibility. This plan folds **both** Supervisor and Quality into Machine Head → clean 4. (If you'd rather keep Quality as a 5th role, drop §5 and the Quality rows in §6; you then have 5.)

**Finding 2 — the destructive landmine.** Two unrelated things contain the word "supervisor". **Only the role is removed; the override-PIN mechanism is kept** (see §2). Deleting the mechanism breaks the offline APK kiosk.

Final target enum: `OPERATOR:0, MACHINE_HEAD:1, PLANT_HEAD:2, ADMIN:3`.

---

## 1. Scope, footprint, sequencing

- **Footprint:** ~185 SUPERVISOR references across ~65 files (full inventory §9) + ~9 QUALITY files (§5). Cross-cutting — do it as **one coordinated branch** (`refactor/roles-to-four`) with the phases in §10, not piecemeal.
- **Out of scope:** the broader Gen-A/Gen-B table consolidation (that is a separate program; its role-relevant guardrails and the machine-identity dependency are inlined in Appendix A). Plant Head is otherwise left as-is except that its approve/reject actions move to Machine Head.
- **Do this refactor first**, get it green, before any table-consolidation work — it shares `packages/server/src/routes/shiftLogRoutes.ts`, `packages/server/src/routes/reportRoutes.ts`, and `packages/server/src/services/ReportingService.ts` with that program and establishes the 4-role model those phases assume.

---

## 2. CRITICAL DISTINCTION — keep the override-PIN mechanism

> Two unrelated things contain the word "supervisor". Only the **role** is being removed.
>
> - **The SUPERVISOR *role*** (`UserRole.SUPERVISOR`, `role_name='SUPERVISOR'`, any `SupervisorRoute` guard, DB `role_id=2`) → **REMOVE.** This is the objective.
> - **The "supervisor override PIN" *mechanism*** (`verifySupervisorOverridePin`, `POST /auth/supervisor-override` in `packages/server/src/routes/authRoutes.ts`, client `authApi.supervisorOverride` in `packages/client/src/lib/authApi.ts`) → **KEEP — DO NOT DELETE OR RENAME.** It is role-agnostic: `OVERRIDE_ROLES` already accepts ADMIN / PLANT_HEAD / **MACHINE_HEAD**, so it keeps working after the role is gone. It powers field-level overrides (`packages/client/src/components/forms/FieldWrapper.tsx`), the APK "discard parked action" (`packages/client/src/operator/sync/SyncStatusBadge.tsx`), and **kiosk exit** (see `M1-10_Operator_APK_Conversion.md`, `AGENTS_for_android_folder.md`). Deleting it **breaks the offline APK kiosk flow.**
>
> The **only** change to the override-PIN mechanism is dropping the string `'SUPERVISOR'` from the `OVERRIDE_ROLES` array in `packages/server/src/services/authService.ts` (§4). The function, endpoint and client helper names stay as-is. The same principle applies to any "quality" utility that is not the role.

---

## 3. Machine-wise approval — the core design (from the merge)

Supervisor approval today is **line-scoped** (`security.line_access` with an `APPROVE` level). Machine Head is **machine-scoped** (`security.machine_access`). The bridge is that **`master.machine` carries `process_id` / `process_code`**, so a machine head's machines map cleanly to the processes/lines they may act on.

**Rule (DECIDED: machine-wise only):** a MACHINE_HEAD may approve / reject / reopen / override a shift log **iff every machine that shift actually ran on is in their `machineAccess`.** Scope is the *machine*, not the whole process — a 4HI-only head must **not** approve 6HI or 2HI work even though they share a process.

`txn.shift_log` has **no** `machine_code` column (only `process_id` + `mill_type`), so resolve the shift's machine(s) in this priority order, in `packages/server/src/auth/machineAccessPolicy.ts`:
```
resolveShiftLogMachines(shiftLog): Promise<string[]>
  1. txn.machine_shift_session.machine_code WHERE shift_log_id = X   (machine-centric lines)
  2. txn.crm6_order.machine_code            WHERE shift_log_id = X   (6HI orders)
  3. shift_log.mill_type → machine_code                              (CRM mills: 2HI/4HI/6HI)
  4. fallback: master.machine.machine_code WHERE process_id = shift_log.process_id
              (classic single-machine lines — machine-wise when 1 machine/process)

assertShiftLogApproval(user, shiftLog)                               // machineAccessPolicy.ts
  = ADMIN / PLANT_HEAD → allow (existing carve-outs)
  = else: throw unless resolveShiftLogMachines(shiftLog) ⊆ user.machineAccess
```
**Note:** exact per-machine granularity depends on the shift carrying a machine identity (paths 1–3). That is true for 6HI today and for every line after the machine-identity work in Appendix A; until then, classic single-machine lines use path 4 (machine-wise wherever a process has exactly one machine).

---

## 4. Enum + backend changes (files named explicitly)

### 4.1 Enum / rank / labels — `packages/shared-validation/src/types/roles.ts`
Remove **both** `SUPERVISOR` and `QUALITY`; renumber to close the gaps:
```ts
export enum UserRole { OPERATOR='OPERATOR', MACHINE_HEAD='MACHINE_HEAD', PLANT_HEAD='PLANT_HEAD', ADMIN='ADMIN' }
export const ROLE_RANK   = { OPERATOR:0, MACHINE_HEAD:1, PLANT_HEAD:2, ADMIN:3 };
export const ROLE_LABELS = { OPERATOR:'Operator', MACHINE_HEAD:'Machine head', PLANT_HEAD:'Plant head', ADMIN:'Admin' };
```
`ROLE_RANK` is consumed by the client `RoleRoute` (rank ≥ comparison) and hard-coded in tests. Any route using `minRole="SUPERVISOR"` or `minRole="QUALITY"` becomes `minRole="MACHINE_HEAD"`. Update `packages/shared-validation/tests/roles.test.ts`, `packages/client/tests/route-guard.property.test.ts`, `packages/client/tests/roleHome.test.ts`.

### 4.2 Backend change table
| Area | File | Change |
|---|---|---|
| Override authority | `packages/shared-validation/src/rules/overrides.ts` | `canOverride`: `SUPERVISOR‖ADMIN` → `MACHINE_HEAD‖ADMIN` (already partly done — verify). |
| Override roles | `packages/server/src/services/authService.ts` | `OVERRIDE_ROLES`: drop **only** the string `'SUPERVISOR'` (keeps `MACHINE_HEAD, ADMIN, PLANT_HEAD`). **Do NOT touch** `verifySupervisorOverridePin` or `POST /auth/supervisor-override` in `routes/authRoutes.ts` (see §2). |
| Line/approve policy | `packages/server/src/auth/lineAccessPolicy.ts` | Remove the 3 SUPERVISOR branches; grant APPROVE/WRITE scoped to MACHINE_HEAD via machine→process (§3). Update `ensureLineScopes` default level for MACHINE_HEAD. |
| Approve/reject/reopen | `packages/server/src/routes/shiftLogRoutes.ts` (~L309 / L320 / L331) | `requireRole([SUPERVISOR, PLANT_HEAD])` → `requireRole([MACHINE_HEAD, PLANT_HEAD])`; add `await assertShiftLogApproval(user, shiftLog)` inside each handler (§3). ADMIN/PLANT_HEAD skip the machine check via existing carve-outs. |
| Export authz | `packages/server/src/export/auth/exportAuthz.ts` + `routes/exportRoutes.ts` | Drop `SUPERVISOR` **and** `QUALITY` (MACHINE_HEAD already permitted). |
| Device registration | `packages/server/src/routes/deviceRoutes.ts` | `[ADMIN, SUPERVISOR]` → `[ADMIN, MACHINE_HEAD]`. |
| Traceability | `packages/server/src/routes/traceabilityRoutes.ts` | replace `SUPERVISOR` with `MACHINE_HEAD` in both role lists. |
| Shift audit | `packages/server/src/routes/shiftRoutes.ts` (~L97) | replace `SUPERVISOR` with `MACHINE_HEAD`. |
| Live board | `packages/server/src/routes/liveRoutes.ts` | drop/replace `SUPERVISOR`. |
| Machine access `/me` | `packages/server/src/routes/machineAccessRoutes.ts` (~L19) | drop `SUPERVISOR`. |
| Reports | `packages/server/src/routes/reportRoutes.ts` | `/supervisor` (~L22) → `/machine-head`; replace `SUPERVISOR` in `/drilldown`, `/daily`, `/coil-traceability`, `/handover`, `/plant-head*`. |
| Reporting services | `packages/server/src/services/ReportingService.ts`, `services/reporting/DashboardReportingService.ts` | rename `getSupervisorDashboard` → `getMachineHeadDashboard`; scope its query by machine→process, not line. |
| Validation gate ctx | `packages/server/src/services/shiftLogValidationService.ts` | any `UserRole.SUPERVISOR` checks → `MACHINE_HEAD`. |
| Shift override reason | `packages/server/src/services/ShiftDetectionService.ts` + `routes/shiftRoutes.ts` | rename `'SUPERVISOR_INSTRUCTION'` → `'MACHINE_HEAD_INSTRUCTION'` in `ShiftOverrideReason` + `validReasons` (needs the CHECK-constraint + backfill migration §7). |
| 6HI | `packages/server/src/services/SixHiService.ts` | replace `SUPERVISOR` role checks with `MACHINE_HEAD`. |

---

## 5. Quality → Machine Head (the second merge)

~9 files. Same pattern as §4.
| File | Change |
|---|---|
| `packages/shared-validation/src/types/roles.ts` | remove `QUALITY` enum value, rank, label (done in §4.1). |
| `packages/client/src/components/RoleRoute.tsx` | drop any `QualityRoute` guard. |
| `packages/client/src/lib/roleHome.ts`, `packages/client/src/lib/userScope.ts` | delete the `QUALITY` case; quality users home to the machine-head dashboard. |
| `packages/client/src/components/layout/quality/QualityShell.tsx`, `packages/client/src/pages/quality/QualitySpecsPage.tsx`, `pages/quality/QualitySpecEditorPage.tsx` | **keep the screens**; route them under the Machine-Head navigation, guarded by `MachineHeadRoute`. The machine head now owns quality spec-sheet (QSS) review and inspection disposition. |
| `packages/server/src/routes/qualityRoutes.ts` | `requireRole([QUALITY, …])` → `[MACHINE_HEAD, …]` (ADMIN keeps master edit). |
| `packages/server/src/export/auth/exportAuthz.ts` | replace `QUALITY` with `MACHINE_HEAD`. |
| `packages/server/scripts/seed-quality.mjs` | convert the seeded quality persona to MACHINE_HEAD, or drop if redundant. |
| tests: `packages/shared-validation/tests/roles.test.ts`, `packages/client/tests/roleHome.test.ts`, `packages/server/tests/rewindingOrderLifecycle.test.ts` | drop QUALITY actor; renumbered ranks. |

**[dev-decision]:** quality-spec *authoring* (masters) may sit with **Admin** (it lives beside `AnnSpecAdmin`/`PklSpecAdmin`/`ValidationRulesAdmin`); default split = Machine Head views/applies specs and does inspection disposition, Admin authors them.

---

## 6. Client changes (files named explicitly)

| File | Change |
|---|---|
| `packages/client/src/components/RoleRoute.tsx` | remove `SupervisorRoute` / `QualityRoute` exports/guards; keep rank logic (renumbered). |
| `packages/client/src/lib/roleHome.ts` | delete the `SUPERVISOR` and `QUALITY` cases (machine head routes to `/machine-head-dashboard`). |
| `packages/client/src/lib/authStore.ts`, `lib/userScope.ts`, `lib/machineRouting.ts`, `lib/reportingService.ts`, `lib/authApi.ts`, `lib/accessOptions.ts`, `lib/sessionRoleUtils.ts` | strip `SUPERVISOR`/`QUALITY` branches; route former behavior through MACHINE_HEAD. |
| `packages/client/src/pages/plant/PlantShiftReviewPage.tsx` | **KEEP functional; move under the Machine-Head area, guard with `MachineHeadRoute`, and filter the shift-log list to only the machines in the user's `machineAccess`** (machine-wise, §3). This is the machine head's primary approval surface. |
| `packages/client/src/components/layout/machinehead/MachineHeadNav.tsx`, `App.tsx` | add the shift-review + quality-spec routes into the machine-head nav. |
| `packages/client/src/pages/admin/UsersAdmin.tsx` | remove the `SUPERVISOR` and `QUALITY` `<option>`s from the role dropdown + their badge-colour cases (dropdown becomes 4 options). |
| `packages/client/src/pages/admin/SystemAdmin.tsx`, `pages/Login.tsx`, `pages/MachineComingSoon.tsx`, `pages/sixHi/HandoverAcceptPage.tsx`, `components/sixHi/SixHiManualOrderModal.tsx`, `pages/admin/PklSpecAdmin.tsx`, `pages/admin/AnnSpecAdmin.tsx`, `pages/live/MachineHeadDashboard.tsx`, `pages/machinehead/LineMhImportPage.tsx`, `pages/import/RollingImportPage.tsx` | remove `SUPERVISOR`/`QUALITY` **role** conditionals; fold into MACHINE_HEAD where the behavior should persist. |
| ⚠️ `packages/client/src/components/forms/FieldWrapper.tsx`, `operator/sync/SyncStatusBadge.tsx`, `lib/authApi.ts` | **KEEP the `authApi.supervisorOverride(...)` calls — override-PIN mechanism, not the role** (§2). Only remove a literal `UserRole.SUPERVISOR` role branch if present. |

---

## 7. Data migration — `migrations/19xx_consolidate_roles_to_four.js` (reversible)

```sql
-- up
-- 1. Re-point SUPERVISOR and QUALITY users to MACHINE_HEAD
UPDATE security.user_role ur
   SET role_id = (SELECT role_id FROM security.role WHERE role_name='MACHINE_HEAD')
 WHERE role_id IN (SELECT role_id FROM security.role WHERE role_name IN ('SUPERVISOR','QUALITY'));

-- 2. Convert former supervisors' line scope → machine scope (machine-wise):
--    grant every machine whose process is a line they could act on
INSERT INTO security.machine_access (user_id, machine_code)
SELECT DISTINCT la.user_id, m.machine_code
  FROM security.line_access la JOIN master.machine m ON m.process_id = la.process_id
 WHERE la.user_id IN (/* the reassigned user_ids — snapshot these in a comment */)
ON CONFLICT DO NOTHING;

-- 3. Rename the override reason code + CHECK constraint (backfill existing rows first)
UPDATE txn.shift_override_audit SET reason_code='MACHINE_HEAD_INSTRUCTION' WHERE reason_code='SUPERVISOR_INSTRUCTION';
ALTER TABLE txn.shift_override_audit DROP CONSTRAINT IF EXISTS shift_override_audit_reason_code_check;
ALTER TABLE txn.shift_override_audit ADD  CONSTRAINT shift_override_audit_reason_code_check
  CHECK (reason_code IN ('OVERTIME','PREV_SHIFT_CONTINUATION','MACHINE_HEAD_INSTRUCTION','SHIFT_CORRECTION','OTHER'));

-- 4. Remove the now-unreferenced role rows
DELETE FROM security.role WHERE role_name IN ('SUPERVISOR','QUALITY');
```
`down`: re-insert the SUPERVISOR role row (id 2 — role_id is a smallint; never `gen_random_uuid()`) and the QUALITY role row, restore the old reason code + constraint. User re-assignment is **not** auto-reversible — **snapshot the affected `user_id`s in the migration comment** for manual rollback. **Gate:** run only after §4–§6 code no longer reads the removed role_ids; run the FK + row-count checks (Appendix B, `DB_AUDIT.md` §6) on `security.role` against a production-like DB first.

---

## 8. Seeds & fixtures (files named explicitly)

Convert the seeded supervisor/quality personas to machine head (or delete if redundant with the machine-head seed):
- `packages/server/scripts/seed-pilot-users.mjs` — the `{ username:'supervisor', role_id:2, lines:[…] }` row → `role_id: MACHINE_HEAD`, replace `lines` with `machines`.
- `packages/server/scripts/seed-admin.mjs`, `seed-login-profiles.mjs`, `seed-pilot.mjs`, `seed-zedral-demo.mjs`, `seed-quality.mjs` — drop/convert supervisor + quality console lines and role inserts.
- `packages/server/seed.sql`, `packages/server/seed_security.sql` — remove the `SUPERVISOR` and `QUALITY` role inserts.
- `packages/server/scripts/apply-machine-shift-migration.sql`, `scripts/migrate_phase11.ts` — strip supervisor refs.
- Rename `npm run smoke:supervisor` (`scripts/smoke-supervisor.mjs`) → `smoke:machine-head`.

---

## 9. Full file inventory (65 files touching SUPERVISOR + 9 for QUALITY)

**shared-validation (6):** `types/roles.ts`, `rules/overrides.ts`, `rules/shiftLogRules.ts`, `tests/roles.test.ts`, `tests/properties/warnOverride.property.test.ts`, `tests/properties/validations.test.ts`

**server/src (≈18):** `auth/lineAccessPolicy.ts`, `auth/machineAccessPolicy.ts`, `export/auth/exportAuthz.ts`, `routes/authRoutes.ts` (KEEP override), `routes/deviceRoutes.ts`, `routes/exportRoutes.ts`, `routes/liveRoutes.ts`, `routes/machineAccessRoutes.ts`, `routes/reportRoutes.ts`, `routes/shiftLogRoutes.ts`, `routes/shiftRoutes.ts`, `routes/traceabilityRoutes.ts`, `routes/qualityRoutes.ts`, `services/ReportingService.ts`, `services/reporting/DashboardReportingService.ts`, `services/ShiftDetectionService.ts`, `services/SixHiService.ts`, `services/authService.ts`, `services/shiftLogService.ts`, `services/shiftLogValidationService.ts`

**server tests (≈10):** `tests/integration/supervisorLifecycle.integration.test.ts` (→ rename `machineHeadLifecycle…`), `tests/rbac.test.ts`, `tests/reportRoutes.test.ts`, `tests/exportRoutes.test.ts`, `tests/userRoutes.test.ts`, `tests/auth/lineAccessPolicy.test.ts`, `tests/properties/security.test.ts`, `tests/shiftLogValidation.test.ts`, `tests/export/exportPhase7.test.ts`, `tests/integration/validationConfigService.integration.test.ts`, `tests/rewindingOrderLifecycle.test.ts` (QUALITY)

**server scripts/seeds (≈9):** see §8.

**client (≈19):** `components/RoleRoute.tsx`, `components/forms/FieldWrapper.tsx` (KEEP override), `components/sixHi/SixHiManualOrderModal.tsx`, `components/layout/machinehead/MachineHeadNav.tsx`, `components/layout/quality/QualityShell.tsx`, `lib/authApi.ts` (KEEP override), `lib/authStore.ts`, `lib/machineRouting.ts`, `lib/reportingService.ts`, `lib/roleHome.ts`, `lib/userScope.ts`, `lib/accessOptions.ts`, `lib/sessionRoleUtils.ts`, `operator/sync/SyncStatusBadge.tsx` (KEEP override), `pages/Login.tsx`, `pages/MachineComingSoon.tsx`, `pages/admin/SystemAdmin.tsx`, `pages/admin/UsersAdmin.tsx`, `pages/admin/PklSpecAdmin.tsx`, `pages/admin/AnnSpecAdmin.tsx`, `pages/plant/PlantShiftReviewPage.tsx`, `pages/live/MachineHeadDashboard.tsx`, `pages/machinehead/LineMhImportPage.tsx`, `pages/import/RollingImportPage.tsx`, `pages/sixHi/HandoverAcceptPage.tsx`, `pages/quality/QualitySpecsPage.tsx`, `pages/quality/QualitySpecEditorPage.tsx` + client tests `tests/roleHome.test.ts`, `tests/route-guard.property.test.ts`, `tests/userScope.test.ts`

> **KEEP-not-remove within this list** (override-PIN mechanism, not the role): `routes/authRoutes.ts` (`/auth/supervisor-override`), client `lib/authApi.ts` (`supervisorOverride`), `components/forms/FieldWrapper.tsx`, `operator/sync/SyncStatusBadge.tsx`. Do **not** edit `M1-10_Operator_APK_Conversion.md` / `AGENTS_for_android_folder.md` — their "supervisor PIN" references are the mechanism.

**Delete outright:** the `SUPERVISOR` and `QUALITY` enum values / ranks / labels / DB role rows; the `/reports/supervisor` endpoint name (rename to machine-head); any `SupervisorRoute`/`QualityRoute` guard; the seeded supervisor/quality demo users (convert or delete); doc references to nonexistent supervisor pages (`ReviewQueue`, `CorrectionQueue`, `SupervisorDashboard`) — scrub from `PROJECT_STRUCTURE.md`.

---

## 10. Execution order

1. **`shared-validation`** enum/rank/labels + override authority — remove SUPERVISOR **and** QUALITY (§4.1, §4.2 override rows); regenerate downstream.
2. **Server policy + helpers** — add `resolveShiftLogMachines` / `assertShiftLogApproval` (machine-wise, §3) in `auth/machineAccessPolicy.ts`; update route role lists (§4.2, §5) — both roles → MACHINE_HEAD.
3. **Server reports/services** rename + machine-scoping (§4.2); quality routes (§5).
4. **Client** guards/pages/libs (§6) — route `PlantShiftReviewPage` and the Quality screens under Machine-Head.
5. **Data migration** (§7) — **after** code no longer reads the removed role_ids.
6. **Seeds + tests** (§8, §9).
7. **Completion gate — role-scoped, NOT a blanket grep:** confirm no `UserRole.SUPERVISOR` / `UserRole.QUALITY` remain and the override-PIN mechanism is intact (search for `verifySupervisorOverridePin`, `supervisorOverride` — these must still exist).

---

## 11. The four profiles — properties and functionality

Access is **role + scope**: role sets *what*, `security.machine_access` (or legacy `security.line_access`) sets *which machines*. Auth: SuperTokens sessions (upper tiers) + **PIN** (operator tier); override-PIN retained. Every capability is enforced backend-side (RLS + `requireRole` + `assertShiftLogApproval`), never frontend-only.

**OPERATOR (rank 0)** — own assigned machine/process only. ORDERS (`ProcessHub`) → CAPTURE (`CaptureWorkspace` process body) → HISTORY (own records); enters readings, DRAFT→SUBMITTED; PIN login, offline PWA/APK. Per process: Tube Mill setup + hourly params + daily production; Furnace 6-zone reading; STP bath readings; Draw FROM/TO dims + inspection. No approve, no masters.

**MACHINE HEAD (rank 1) — merged Supervisor + Quality; machine-scoped.**
- *Review & approve (Supervisor):* the shift-review screen (`PlantShiftReviewPage`, moved here, filtered to `machineAccess`) — approve / reject / reopen shift logs, machine-wise; owns the gates (Tube Mill first-off PASS/FAIL, Furnace/Draw disposition, STP sign-off).
- *Quality (Quality role):* QSS quality spec-sheet screens (`QualitySpecsPage`/`Editor` via `QualityShell`), inspection review + disposition, quality routes.
- *Monitoring (existing MH):* live dashboards (`MachineHeadDashboard`, per-process `ann/hrs/pkl/rwd` MH pages), crew (`MachineHeadCrewPage`), import (`LineMhImportPage`), traceability, machine assignment, device registration.
- *Export:* all reports for their machines. *Override:* holds the override-PIN authority.

**PLANT HEAD (rank 2) — read-only, plant-wide.** All processes/machines; plant dashboards, OEE / yield / loss, drill Plant→Process→Machine→Shift→Record, plant export, `getPlantHeadDashboard`. Sees but does not action shift logs (approve moved to Machine Head). No capture, no masters.

**ADMIN (rank 3) — masters, users, config.** `MachineMasterAdmin`, `MachineSpecAdmin`, `MachineAssignmentPage`, `MasterDataAdmin`, `PlanningAdmin`, `ValidationRulesAdmin`, spec admins (`AnnSpecAdmin`/`PklSpecAdmin`/quality specs authoring), `UsersAdmin` (now 4-option dropdown + machine-access assignment), `SystemAdmin` (integration/ERP/config). Full override authority.

**Per-process capability matrix (TM / FUR / STP / DB):**
| Capability | Operator | Machine Head | Plant Head | Admin |
|---|---|---|---|---|
| Capture / submit | ✅ own machine | ✖ | ✖ | ✖ |
| Approve/reject/reopen · gates | ✖ | ✅ machine-scoped | 👁 read-only | ✅ |
| Quality spec / inspection disposition | ✖ | ✅ | 👁 | ✅ (authors specs) |
| Import / traceability / assignment / crew | ✖ | ✅ | 👁 | ✅ |
| Live dashboards / export | own | ✅ machines | ✅ plant | ✅ |
| Masters / machine spec / validation rules / users | ✖ | ✖ | ✖ | ✅ |

---

## 12. Testing, rollback, guardrails

**Testing (their harness):** `npm run test -w @m1/server` (rbac, `machineHeadLifecycle` — machine-scoped approve/reject/reopen, reportRoutes, exportRoutes, quality); `shared-validation` role tests (new ranks + override authority = MACHINE_HEAD); client route-guard/roleHome/userScope tests; `npm run smoke:api`, `smoke:machine-head`; `seed:pilot`/`seed:profiles` produce only 4 roles. Manual: former supervisor logs in as machine head and can approve **only** their machines; a non-assigned machine's shift is refused; quality spec screens open under machine head; **APK kiosk exit (override PIN) still works**; plant head is read-only; admin sees a 4-option role dropdown.

**Rollback / guardrails:** one branch `refactor/roles-to-four`; one logical change per commit (enum → server → client → migration → seeds/tests); keep `main` stable; every migration reversible (`down` restores both role rows); snapshot reassigned users; regenerate `db-types.ts` (`kysely-codegen`) after the migration and commit separately; green gates before merge (`npm run build`, `npm test`, `npm run arch:check`, `smoke:api`). The one true landmine is the override-PIN mechanism (§2) — a green build that broke the APK kiosk is a failed migration.

---

## 13. Confirm before starting
- Fold Quality into Machine Head (this plan) vs keep as a 5th role.
- Quality-spec authoring: Admin authors, Machine Head applies/reviews (default) — or all to Machine Head.
- Machine-wise approval is exact only where the shift carries a machine identity; classic single-machine lines use the `process_id` fallback (path 4) until every line has a machine identity (Appendix A).

---

## Appendix A — inlined dependency from `CONSOLIDATION_PLAN.md` (role-relevant only)

**Sequencing:** this role refactor runs **before** the table-consolidation program; it shares `routes/shiftLogRoutes.ts`, `routes/reportRoutes.ts`, `services/ReportingService.ts` and establishes the 4-role model that program assumes.

**Guardrails (apply to every task here):** (1) one logical change per commit/PR — never mix a refactor with a destructive migration; (2) every migration reversible (`down` implemented and tested); (3) every table/row drop gated by the FK + row-count checks (Appendix B) against a production-like DB; (4) `txn.shift_log` stays the universal anchor — do not remove; (5) regenerate `db-types.ts` after any schema change, commit the regen separately; (6) green gates before merge (`build`, `test`, `arch:check`, `smoke:api`); (7) expand → migrate → contract for any table merge; (8) feature-flag risky cutovers where possible.

**Machine identity for every line (the dependency behind path-4 fallback in §3):** ensure each of the processes maps to a `master.machine` row, or make `machine_code` fall back to the process/line code (the code already sets `process_code = machineCode` in places). Until this lands, machine-wise approval is exact only for lines with a single machine per process. This is the only piece of the consolidation program this refactor depends on; the rest (Gen-A/Gen-B table merges, handover Model A/B, canonical pruning) is out of scope here.

## Appendix B — inlined pre-drop gate from `DB_AUDIT.md` §6 (role-relevant only)

Before dropping the `SUPERVISOR` / `QUALITY` rows from `security.role`, run against a production-like DB: confirm **no inbound FK references** the role_ids being removed (a role row is a common FK target for `security.user_role` — step 1 of the migration repoints those first), and confirm **zero remaining `user_role` rows** carry the removed role_ids. A role row with no inbound references after the repoint is safe to delete; anything else means a code path still reads it — stop and fix §4–§6 first. `security.role` role_id is a smallint (SUPERVISOR was 2); the `down` re-inserts by explicit id, never `gen_random_uuid()`.

---

## Bottom line

Reaching the four profiles means merging **Supervisor and Quality** into **Machine Head**. This document inlines the complete change set (enum, ~18 server files, ~19 client files, seeds, tests, the reversible migration), the machine-wise approval design, the full four-profile functionality, and the two inlined dependencies (machine identity, the pre-drop DB gate) — so no other repo doc is needed. Machine Head becomes the machine-scoped operational owner; Plant Head stays read-only plant-wide; Admin keeps masters/users/config; Operator keeps capture. The single non-negotiable guardrail: preserve the supervisor-override-PIN mechanism (kiosk/field overrides) while deleting only the role.

*Grounded in `zedral_test-share-the-code` — `packages/shared-validation/src/types/roles.ts`, the SUPERVISOR/QUALITY reference sites, and the content of `SUPERVISOR_REMOVAL_SPEC.md`, `CONSOLIDATION_PLAN.md`, `DB_AUDIT.md` (all inlined above).*
