# ZEDRAL — ADMIN Profile · Detailed Implementation Plan

**Audience:** dev team / IDE. **Scope:** the complete Admin profile for Zedral M1 on the Goodluck A‑59 line (Tube Mill → Furnace → STP → Draw Bench). **Grounded in** `zedral_test-share-the-code`. This document is **standalone** — every screen, route, service and guard is named with its path.

> Companion plans cover **Machine Head** and **Plant Head**. Model: **Operator (0) → Machine Head (1) → Plant Head (2) → Admin (3)**.

---

## 1. What Admin IS

Admin is the **system‑of‑record owner** — the profile that defines the plant's masters, the people and their access, the validation rules that gate every operator entry, and the platform/ERP configuration. Admin does **not** run day‑to‑day shopfloor operations (that's Machine Head) and does **not** live in the plant dashboards (that's Plant Head); Admin makes the world that those two operate inside. Admin holds **full override authority** and is the top rank.

| Property | Value |
|---|---|
| Enum | `UserRole.ADMIN` — `packages/shared-validation/src/types/roles.ts` |
| Rank | `ROLE_RANK.ADMIN = 3` (highest) |
| Route guard | `AdminRoute` — `packages/client/src/components/RoleRoute.tsx` (`minRole=ADMIN`) |
| Data scope | **unrestricted** — all tenants' masters within the tenant; skips machine/line carve‑outs |
| Auth | SuperTokens session (staff tier); full override‑PIN authority (`OVERRIDE_ROLES` includes `ADMIN`) |
| Home | `/admin/*` screens |
| Backend | `requireRole([UserRole.ADMIN])` on all mutating master/config endpoints |

There is **no single `adminRoutes.ts`** — Admin authority is spread across the master/config route files below. That's intentional; each master domain owns its route.

---

## 2. Complete functionality inventory

Admin has five domains: **Masters**, **Users & Access**, **Validation Rules**, **Planning/Orders**, **System/ERP**. Every screen already exists unless marked **[new]**/**[wire]**.

### 2.1 Masters

| Screen | Route | Component (`pages/admin/…`) | Backend | Guard |
|---|---|---|---|---|
| Machine master (CRUD machines) | `/admin/machines` | `MachineMasterAdmin.tsx` | `machineRoutes` POST/PUT/activate | `AdminRoute` / `requireRole([ADMIN])` |
| Master data (7 entity types) | `/admin/master-data` | `MasterDataAdmin.tsx` | `masterDataRoutes` (grade‑specs + generic entity CRUD) | `AdminRoute` / `[ADMIN]` |
| Machine assignment | `/admin/machine-assignment` | `MachineAssignmentPage.tsx` | `MachineAccessService` / `machineRoutes` | `AdminRoute` |
| Machine specs | `/admin/machine-specs` | `MachineSpecAdmin.tsx` | `machineRoutes` `/specs` | **`MachineHeadRoute`** (see §3) |
| ANN specs | `/admin/ann-specs` | `AnnSpecAdmin.tsx` | `masterDataRoutes` grade‑specs | **`MachineHeadRoute`** |
| PKL specs | `/machine-head/pkl/specs` (redirect from `/admin/pkl-specs`) | `PklSpecAdmin.tsx` | quality/spec services | **`MachineHeadRoute`** |

`MasterDataAdmin` does "CRUD for all seven master‑data entity types" (its own header), with `defect_code` and `stoppage_code` carrying machine classification. Generic entity CRUD routes: `POST /master-data/:entityType`, `PUT /:entityType/:id`, `DELETE /:entityType/:id`, all `requireRole([ADMIN])`; reads (`GET /:entityType`) are open to any authenticated user (operators need the code lists).

### 2.2 Users & Access

| Screen | Route | Component | Backend | Guard |
|---|---|---|---|---|
| Users admin | `/admin/users` (+ `/plant/users` embedded) | `pages/admin/UsersAdmin.tsx` | `userRoutes` (`requireRole([ADMIN, PLANT_HEAD])`) | `AdminRoute` |
| Machine‑access assignment | inside UsersAdmin (`lib/accessOptions.ts`, `MACHINE_OPTIONS`, `resolveMachineAccess`) | — | `machineAccessRoutes` GET `/`, PUT `/:userId` (`[PLANT_HEAD, ADMIN]`) | — |

**Role dropdown → becomes 4 options.** Today `UsersAdmin` builds its role list from `UserRole.{OPERATOR, SUPERVISOR, PLANNER, MACHINE_HEAD, QUALITY, PLANT_HEAD, ADMIN}` (the `STAFF_ROLES` / options array). **[wire]** After consolidation it renders exactly **Operator, Machine Head, Plant Head, Admin** — remove the `SUPERVISOR`, `QUALITY` (and, per §4, `PLANNER`) `<option>`s and their badge‑tone cases. When Admin sets a user to Machine Head, the form must expose the **machine‑access** picker (machine‑scoped, `machine_access`); Operator gets a single assigned machine; Plant Head/Admin get implicit‑all (`hasImplicitAllMachines`).

### 2.3 Validation Rules

| Screen | Route | Component | Backend | Guard |
|---|---|---|---|---|
| Validation rules editor | `/admin/validation-rules` | `pages/admin/ValidationRulesAdmin.tsx` | `validationRulesRoutes` — `GET /` + `GET /version` (auth), `POST /` + `DELETE /:ruleId` (`[ADMIN]`) | `AdminRoute` |

This is where Admin authors the **declarative validation engine** rules (required / range / toleranceVsSpec / oneOf / lessThan / sumEquals) that run **both client and server** via `@m1/shared-validation`. For A‑59 this is where the Furnace zone bands (ANN‑FT‑01), STP bath spec limits (STP‑FT‑01A), and Draw Bench dimensional tolerances (DB‑FT‑01) are configured as rules, so operator entries are gated at capture time. Backed by `ValidationConfigService.ts`.

### 2.4 Planning & Orders

| Screen | Route | Component | Backend | Guard |
|---|---|---|---|---|
| Planning admin | `/admin/planning` | `pages/admin/PlanningAdmin.tsx` | `plannedCoilRoutes` / `PlannedCoilService` | `AdminRoute` |
| Plan import hub | `/planning/import` | `pages/planning/PlanningImportHub.tsx` | `importRoutes` (`[ADMIN, PLANNER]`) | `RoleRoute minRole=ADMIN allow=[PLANNER]` |

Planning is the order/plan feed for the line (the `planning.order_journey` spine). In the current code a separate **PLANNER** capability‑role shares these; §4 folds it into Admin.

### 2.5 System & ERP

| Screen | Route | Component | Backend | Guard |
|---|---|---|---|---|
| System health / integrations | `/admin/system` | `pages/admin/SystemAdmin.tsx` | `configService` / health endpoints | `AdminRoute` |
| Audit trail | `/admin/audit` (AdminShell) | `pages/audit/AuditTrailView.tsx` | `auditRoutes` (`[PLANT_HEAD, ADMIN]`) | `AdminRoute` |
| Shift windows / override | — | — | `shiftRoutes` `/override`, `/windows` (`[ADMIN]`) | server‑only |
| Tenant flags | — | — | `tenantFlagsRoutes` | server‑only |

`SystemAdmin` today shows service status ("Integration endpoints and platform status"), DB health, and application info via `AdminShell`/`AdminPanel`. **[new/extend]** The **Dynamics 365 Business Central** connector configuration from the ERP integration plan lands here — connection/health, field‑mapping status, and last‑sync — using the Manifold connector framework (`@zedral/connectors`). Admin is the only role that configures ERP writeback.

---

## 3. Master authority split — who authors what (grounded, important)

The code already draws a clean line, and it is **not** "Admin authors every spec." Keep it:

| Master | Owner | Guard in code |
|---|---|---|
| Machine master (add/edit machines, `process_code`) | **Admin** | `AdminRoute` / `machineRoutes` `[ADMIN]` |
| Master data — grades, defect/stoppage codes, 7 entities | **Admin** | `AdminRoute` / `masterDataRoutes` `[ADMIN]` |
| Validation rules | **Admin** | `AdminRoute` / `validationRulesRoutes` `[ADMIN]` |
| Planning / orders | **Admin** (+PLANNER folded) | `AdminRoute` |
| Users & machine‑access | **Admin** (+Plant Head today) | `[ADMIN, PLANT_HEAD]` |
| Machine specs (`MachineSpecAdmin`) | **Machine Head** | `MachineHeadRoute` / `machineRoutes /specs` `[ADMIN, MACHINE_HEAD]` |
| Process spec sheets — ANN / PKL (`AnnSpecAdmin`, `PklSpecAdmin`) | **Machine Head** | `MachineHeadRoute` |

So **process spec authoring sits with Machine Head; grade/master/validation/machine‑master authoring sits with Admin.** Admin can still reach the machine‑spec endpoints (they list `[ADMIN, MACHINE_HEAD]`), but the *screens* are Machine‑Head‑guarded — Admin is the fallback authority, Machine Head the day‑to‑day author. Document this so a dev doesn't "promote" the spec screens to `AdminRoute` and break Machine Head's workflow.

---

## 4. The PLANNER fold (reaching exactly 4)

The current code carries a capability‑scoped **PLANNER** role (`UserRole.PLANNER`), referenced in `UsersAdmin` options, `App.tsx` (`/planning/import` `allow=[PLANNER]`), `importRoutes` (`[ADMIN, SUPERVISOR, PLANNER]`), and `sixHiRoutes` PPC preview/commit (`allow` PLANNER). To reach the exact four profiles you named, **PLANNER folds into Admin** — its only function is plan/order import, an Admin master activity.

| File | Change |
|---|---|
| `client/src/pages/admin/UsersAdmin.tsx` | remove `PLANNER` from the options + `isStaffFormRole` |
| `client/src/App.tsx` | `/planning/import` → plain `AdminRoute` (drop `allow=[PLANNER]`) |
| `server/src/routes/importRoutes.ts` | `[ADMIN, SUPERVISOR, PLANNER]` → `[ADMIN]` (SUPERVISOR already retiring) |
| `server/src/routes/sixHiRoutes.ts` | drop `PLANNER` + `SUPERVISOR` from PPC `requireRole`; keep `[ADMIN, MACHINE_HEAD]` |
| migration | repoint any `PLANNER` users → `ADMIN` (or `MACHINE_HEAD` if they only assign orders on the floor) |

**[dev-decision]:** if any Goodluck planner should NOT have full Admin master rights, keep their plan‑import capability on **Machine Head** (machine‑scoped order assignment already lives there via `/order-assignment`) rather than Admin. Default: fold to Admin.

---

## 5. Admin on the Goodluck A‑59 processes

Admin doesn't operate the processes — it **defines** them. For A‑59 bring‑up, Admin's setup sequence is the plant's day‑zero:

1. **Machine master** (`MachineMasterAdmin`) — create the Tube Mill(s), Furnace (RHF), STP line, and Draw Bench(es) as `master.machine` rows, each with its `process_id`/`process_code` so machine‑wise scoping and approvals resolve.
2. **Master data** (`MasterDataAdmin`) — grades, defect codes, stoppage codes per process (defect/stoppage codes carry machine classification).
3. **Validation rules** (`ValidationRulesAdmin`) — encode the A‑59 gates: Furnace 6‑zone min/max bands (ANN‑FT‑01), STP bath spec limits (STP‑FT‑01A), Draw Bench FROM/TO tolerances (DB‑FT‑01). These run at operator capture and at server submit.
4. **Users & access** (`UsersAdmin`) — create the Operators (one machine each), Machine Heads (machine‑access sets), Plant Head, Admin.
5. **Planning** (`PlanningAdmin` / `/planning/import`) — feed the order/plan journey.
6. **System/ERP** (`SystemAdmin`) — configure the D365 BC connector for order pull + production writeback.

Once Admin has done this, Operators capture, Machine Heads approve machine‑wise, Plant Head watches the plant. Admin then only touches masters/users/config on change.

---

## 6. Scope & authority

1. **Guard:** `AdminRoute` (client) + `requireRole([ADMIN])` (server) on all mutating master/config endpoints.
2. **Unrestricted scope:** Admin skips machine/line carve‑outs — `assertShiftLogApproval` allows ADMIN through; master reads/writes are tenant‑wide (still RLS‑bounded by `tenant_id`).
3. **Override:** full override‑PIN authority (`OVERRIDE_ROLES` includes `ADMIN`) — the mechanism itself (`verifySupervisorOverridePin`, `/auth/supervisor-override`) is **kept, never deleted** (it powers the APK kiosk).
4. **Shift administration:** only Admin may set shift windows / force shift override (`shiftRoutes` `/windows`, `/override`, `[ADMIN]`).

---

## 7. Change set (delta from current code)

| # | File | Change |
|---|---|---|
| 1 | `shared-validation/src/types/roles.ts` | `ADMIN` rank → `3`; remove `SUPERVISOR`, `QUALITY` (and, §4, `PLANNER` if folding) |
| 2 | `client/src/pages/admin/UsersAdmin.tsx` | role dropdown → 4 options; remove `SUPERVISOR`/`QUALITY`/`PLANNER` options + badge tones; keep machine‑access picker for Machine Head |
| 3 | `client/src/App.tsx` | `/planning/import` → `AdminRoute`; do **not** move `MachineSpecAdmin`/`AnnSpecAdmin`/`PklSpecAdmin` off `MachineHeadRoute` (§3) |
| 4 | `server/src/routes/importRoutes.ts`, `sixHiRoutes.ts` | drop `SUPERVISOR`/`PLANNER`; keep `[ADMIN, MACHINE_HEAD]` |
| 5 | `server/src/routes/masterDataRoutes.ts`, `machineRoutes.ts`, `validationRulesRoutes.ts`, `shiftRoutes.ts` | verify `[ADMIN]` on all mutations; no `SUPERVISOR` refs |
| 6 | `server/src/services/authService.ts` | `OVERRIDE_ROLES` keeps `ADMIN`; drop only `'SUPERVISOR'` string |
| 7 | `client/src/pages/admin/SystemAdmin.tsx` | **[extend]** add D365 BC connector config/health panel (ERP plan) |
| 8 | `export/layouts/line_log/{FUR,STP,DB}.json` + validation rules | **[new]** A‑59 process definitions Admin configures |

The user‑repoint + role‑row‑drop migration is in the consolidation plan (`migrations/19xx_consolidate_roles_to_four.js`); the PLANNER repoint (§4) is added to it.

---

## 8. QA / acceptance checklist

- Admin sees a **4‑option** role dropdown in `UsersAdmin`; assigning Machine Head exposes the machine‑access picker; Operator = single machine; Plant Head/Admin = implicit‑all.
- Admin can CRUD machine master, master data (7 entities), validation rules; a non‑Admin gets 403 on those mutations.
- Machine‑spec / ANN‑spec / PKL‑spec screens remain reachable by Machine Head (not promoted to `AdminRoute`).
- `/planning/import` works for Admin after the PLANNER fold; no `PLANNER` login remains.
- Validation rules authored for Furnace/STP/Draw gate an out‑of‑band operator entry both client‑ and server‑side.
- SystemAdmin shows service/DB health and the ERP connector status.
- Shift window/override endpoints are Admin‑only.
- **Override‑PIN mechanism intact** (`verifySupervisorOverridePin`, `supervisorOverride`).
- Tests: `npm run test -w @m1/server` (rbac, masterData, validationRules, userRoutes, importRoutes); client route‑guard/roleHome/userScope.

---

## 9. Bottom line

Admin owns the system of record: machine master, master data, validation rules, planning, users and machine‑access, and platform/ERP config — the world Operators, Machine Heads and Plant Heads run inside. It holds full override authority and top rank, but deliberately leaves process spec‑sheet authoring to Machine Head and day‑to‑day oversight to Plant Head. On the Goodluck A‑59 line, Admin is day‑zero: it stands up the four processes as machines with `process_code`, encodes the ANN‑FT‑01 / STP‑FT‑01A / DB‑FT‑01 gates as validation rules, creates the people with their scopes, and wires the D365 connector. The build exists in `zedral_test-share-the-code`; the work is the 4‑option user dropdown, the PLANNER fold, and the ERP/config extension — never touching the override‑PIN mechanism or promoting the Machine‑Head spec screens.

*Grounded in `zedral_test-share-the-code`. Companion docs: Machine Head and Plant Head profile plans.*
