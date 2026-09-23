# ZEDRAL — Draw Bench (Drawing) Process · Implementation Plan

**Goodluck India Limited · A-51 / A-59 / A59-LDP · Cold Draw Bench (Drawing 107) + Swaging · M1 Phase-1 manual digitization, PLC-ready**
**Audience:** dev team / IDE. Same house style and reuse-first approach as the Tube Mill build spec and the Furnace / STP plans. Grounded in the real formats (`DB-FT-01`, `DB-FT-03`, `DB-FT-08` read cell-by-cell), the Draw Bench field workbook (58 fields, Tables A/B/C), and the repo (`zedral_test-share-the-code`).

---

## 0. Scope

Drawing is cold-draw to final size between STP and finishing. It is **multi-pass**: each of 1st / 2nd / 3rd draw is a cycle **Furnace → STP → Swage → Draw Bench → Centreless**, repeated until final size, then straightening. Phase-1 is manual capture; draw load / drawn-metre / cycle-time (PLC candidates) are deferred behind `data_source` (MANUAL default). Draw Bench is a **new process `DB`** on the generic framework, and it maps almost exactly onto the existing **CTL pattern** (a common area with several independently-operated machines, per-machine capture, warning-only machine eligibility, unlimited child rows) — so reuse CTL wholesale and swap its envelope columns.

The draw formats to reproduce: **DB-FT-01** Draw Bench Production Report (the main multi-bench sheet), **DB-FT-03** Die History Card, **DB-FT-08** Die & Plug Issue Slip. The machine-check sheet **GLI-FT-PRD-DRAW-07** is referenced but not yet shared (gap R-2 — stub until provided).

---

## 1. Reuse map (what exists vs what is new)

| Concern | Reuse (exists) | New for DB |
|---|---|---|
| Process registry | `lib/processConfig.ts` `ProcessStationCode` + `PROCESS_STATIONS`; server `ProcessStationService`/`ProcessRouteService` | add `'DB'` code + config + station seed |
| Nav (Orders/Capture/History) | `OperatorNavRail` generic-process items; `classifyOperatorNav` | none (DB → generic `isProcess` branch) |
| Orders queue | `components/process/ProcessHub.tsx` | DB queue title/tabs (`processCode==='DB'`) |
| **Per-machine common area + assignment + warning-only eligibility** | **CTL** machinery: `master.machine_spec` + CRUD, the assignment board + `MachineAllocationModal`, `suggestCtlMachine`/`checkCtlEligibility` | generalise to `suggestDbBench`/`checkDbEligibility` against Table-C |
| Capture shell + child rows | `ScopeCaptureRoute` → `ProcessCapturePage` → `CaptureWorkspace`; `CtlPieceCounter` (unlimited weighed child rows) | `DrawBenchBody` in `components/process/bodies/`, wired by `processCode==='DB'` |
| History | `pages/process/ProcessOperatorHistoryPage.tsx` | none (reads `prod_db_lot`) |
| Persistence | `ProductionService` + `productionRoutes` + `coil.coil` + `planning.order_journey` (multi-pass re-entry uses the dedup vectors) | `saveDbLot`, `/m1/db/...`, `txn.prod_db_*` |
| Export (faithful) | `AnnChargeReportWorkbookBuilder` pattern + `ReportDefinition`/`registerDictionary` + TemplateInjector (build spec §3) | `DB-FT-01/03/08.xlsx` templates + layout JSON |
| Validation | shared validation engine (build spec §4) | `drawRules` ruleset |

Draw Bench is the mirror of CTL: CTL fans one coil **down** into weighed bundles; Draw Bench fans one lot **across passes and benches**. Reuse the CTL scaffolding; change the envelope (Table-C) and the capture body.

---

## 2. Fields — from DB-FT-01 / DB-FT-03 / DB-FT-08 (exact)

### 2.1 Production report (DB-FT-01, GLI-FT-PRD-DRW-01 R6) → `txn.prod_db_lot`
Title block `GOOD LUCK INDUSTRIES / DRAW BENCH PRODUCTION REPORT / A51 / A59 & LDP / Date / Shift`; repeating per **"DRAW BENCH No."** block with a Break Down / Remarks row; footer sign.

| Field (paper) | Column | Type | Unit | Req | Class |
|---|---|---|---|---|---|
| DB. No. (bench) | `bench_code` | text | - | Y | DERIVED/MANUAL |
| Operator Name | `operator_ref` | text | - | Y | MANUAL |
| Work Order No. | `work_order_no` | text | - | Y | DERIVED (WO) |
| Grade | `grade_code` | text | - | Y | DERIVED |
| Customer Name | `customer_name` | text | - | Y | DERIVED |
| Final size OD/ID/TH/LEN | `final_od_mm`,`final_id_mm`,`final_th_mm`,`final_len_mm` | dec | mm | Y | DERIVED (order) |
| FROM OD/TH/LEN (incoming) | `from_od_mm`,`from_th_mm`,`from_len_mm` | dec | mm | Y | MANUAL |
| TO OD/ID/TH/LEN (drawn) | `to_od_mm`,`to_id_mm`,`to_th_mm`,`to_len_mm` | dec | mm | Y | MANUAL |
| Draw Plan Length | `draw_plan_len_mm` | dec | mm | N | DERIVED |
| Inter / Final | `stage` | enum | - | Y | MANUAL (INTER\|FINAL) |
| Draw pass | `draw_pass` | enum | - | Y | MANUAL (1\|2\|3) |
| Accepted Qty Nos / MT | `accepted_nos`,`accepted_mt` | dec | Nos/MT | Y | MANUAL/DERIVED |
| Rejected Qty Nos | `rejected_nos` | int | Nos | Y | MANUAL |
| Drawn Meter | `drawn_meter` | dec | m | Y | AUTO (P2) / MANUAL now |
| Draw / pulling load | `pull_load` | dec | ton | N | AUTO (P2) |
| Cycle time | `cycle_time_s` | dec | s | N | AUTO (P2) |
| Break Down / Remarks | `breakdown_remark` | text | - | N | MANUAL |
| Paint colour (from grade) | `paint_colour` | text | - | Y | DERIVED (Table-B) |
| Swage-end length | `swage_end_mm` | dec | mm | Y | MANUAL (Table-B tol) |

### 2.2 Start-of-shift machine check (5-point) → `txn.db_shift_check`
`clean_ok`, `die_plug_ok`, `lube_ok`, `pressure_ok`, `input_lube_ok`, `draw_speed_set` (master), `noise_ok`. (Full DRAW-07 sheet not yet shared — extend when provided.)

### 2.3 1st-off / last-off inspection (per Table-A cadence) → `txn.db_inspection`
`inspection_type` (FIRST_OFF\|LAST_OFF), sample dims OD/ID/THK/LEN vs spec, `form_dev` (ovality/circularity/concentricity mm), `surface`/`ra_value`, `disposition` (OK\|HOLD\|REJECT), `special_control` trigger (NEW_SIZE\|4M\|CUSTOMER_CONCERN\|MASS\|SHIFT_CHANGE). **Table-A** sets how many samples per lot/size per trigger (e.g. new size = 3/lot: first-off start & middle + one last-off; mass production = 2/lot first & last-off; shift-change/power-failure = 1 first-off).

### 2.4 Die history card (DB-FT-03) → `master.db_tooling` + `txn.db_tooling_history`
Receiving inspection: `supplier`, `od_required`, `od_observed`, `die_approach_angle`, `angle_observed`, `die_fitment_ok`, `physical_condition_ok`, `die_life_note`, `die_code`, `history_card_no`. History rows: `date`, `od_at_prev_drawn_size`, `no_tubes_produced`, `input_tube_size`, `sign`, `die_polishing`, `die_oversized`.

### 2.5 Die & plug issue slip (DB-FT-08) → `txn.db_tool_issue`
`date`, `shift`, `bench_code`, tube size `od/id/thk`, `die_code`, die `stage` (FINAL\|INTER), `die_size_mm` (per history card), `tube_od_at_first_off`, `die_condition`; plug `stage`, `plug_size_mm`, `plug_condition_actual`, `sign`. Rule: no score/scratch/crack at issue; die & plug within tube OD/ID/THK range.

---

## 3. Database

```sql
CREATE TABLE txn.prod_db_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  lot_no text, work_order_no text, coil_no text, shift_log_id text,
  bench_code text,                                    -- DB-10..DB-250 (machine)
  customer_name text, grade_code text, size jsonb,    -- ordered size
  final_od_mm numeric, final_id_mm numeric, final_th_mm numeric, final_len_mm numeric,
  from_od_mm numeric, from_th_mm numeric, from_len_mm numeric,
  to_od_mm numeric, to_id_mm numeric, to_th_mm numeric, to_len_mm numeric,
  draw_plan_len_mm numeric, stage text, draw_pass smallint,        -- 1|2|3
  accepted_nos int, accepted_mt numeric(12,3), rejected_nos int,
  drawn_meter numeric, pull_load numeric, cycle_time_s numeric,
  paint_colour text, swage_end_mm numeric, breakdown_remark text,
  input_tube_ref text,
  data_source text NOT NULL DEFAULT 'MANUAL', status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz DEFAULT now(), created_by text
);
CREATE TABLE txn.db_shift_check ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_db_lot(id), bench_code text, clean_ok bool, die_plug_ok bool,
  lube_ok bool, pressure_ok bool, input_lube_ok text, draw_speed_set numeric, noise_ok bool, at timestamptz );
CREATE TABLE txn.db_inspection ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_db_lot(id) ON DELETE CASCADE, inspection_type text,
  od_mm numeric, id_mm numeric, thk_mm numeric, len_mm numeric, form_dev numeric, surface text, ra_value numeric,
  disposition text, special_control text );
CREATE TABLE master.db_tooling ( code text PRIMARY KEY, tenant_id uuid NOT NULL, kind text,   -- DIE|PLUG
  supplier text, od_required numeric, spec jsonb, history_card_no text, status text );
CREATE TABLE txn.db_tooling_history ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  tool_code text REFERENCES master.db_tooling(code), date date, od_at_prev_drawn numeric,
  no_tubes_produced int, input_tube_size text, die_polishing text, die_oversized text, sign text );
CREATE TABLE txn.db_tool_issue ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  date date, shift_ref text, bench_code text, tube_od numeric, tube_id numeric, tube_thk numeric,
  die_code text, die_stage text, die_size_mm numeric, tube_od_first_off numeric, die_condition text,
  plug_code text, plug_stage text, plug_size_mm numeric, plug_condition text, sign text );
```
Keyed to WO + coil/lot + shift on the existing `coil.coil` + `planning.order_journey` spine. Bench capability (**Table-C**) seeds `master.machine_spec` per bench (pulling-load ton, mother-hollow OD/THK band, finished OD/THK band). Migration under `packages/server/migrations/modules/db/`. **Multi-pass:** `draw_pass` on the lot; a pass re-enters Furnace/STP/Swage via `order_journey` — dedup the re-entry on lot + pass (reuse the import dedup vectors) so a pass does **not** create a duplicate journey row.

---

## 4. Capture flow (Orders → Capture → Reading → History)

1. **Register `DB`** in `processConfig` (label "Draw Bench", queue "Draw Bench Queue", tab "Coils") + seed the DB station and the eight benches (`master.machine_spec` from Table-C). DB inherits the generic Orders/Capture/History nav.
2. **ORDERS** (`ProcessHub`): tubes arriving from STP for drawing (route position Draw). Operator selects a lot; assignment board (reused from CTL) suggests a bench from the ordered size vs Table-C and shows an **eligibility warning (never a hard block)** if out of band — including a bench whose finished-OD band does not cover the target.
3. **CAPTURE** (`CaptureWorkspace`, `processCode==='DB'`): render `DrawBenchBody`.
4. **READING** = `DrawBenchBody` — pattern `CtlPieceCounter`: pick pass (1/2/3), start-of-shift machine check (5-point), FROM/TO dims, accepted (Nos/MT) + rejected (Nos), drawn metre, swage-end length, breakdown/remarks; a **1st-off / last-off inspection** sub-form driven by the Table-A cadence; a **die/plug issue** entry (DB-FT-08) at setup. Header (customer/grade/final size) pre-filled read-only from the order; paint colour auto-derived from grade (Table-B).
5. **PERSIST** `saveDbLot` → `txn.prod_db_lot` (+ `db_shift_check`, `db_inspection`, `db_tool_issue`), order/coil/shift/pass keyed. The rows are the log sheet.
6. **HISTORY** (`ProcessOperatorHistoryPage`): DB records by order/shift/pass, each showing the order, timestamps, FROM/TO dims and disposition.

Data integrity: one order-linked lot per bench per pass; children hang off it; no duplicate tables; multi-pass re-entry deduped on lot+pass; reuse the spine. Disposition OK/HOLD/REJECT is operator-decided (warning-only hold).

---

## 5. Export — faithful reproduction (three reports)

Template + layout + injector (build spec §3), mirroring `AnnChargeReportWorkbookBuilder`.

**DB-FT-01 Production Report** — `export/templates/DB-FT-01.xlsx` + `layouts/DB-FT-01.v1.json` (stacked per-bench blocks, Break Down row):
```jsonc
{ "report":"DB-FT-01", "version":1, "sheet":"DB 1-7-A51",
  "titleBlock": { "date":"F2", "shift":"F3" },
  "table": { "headerRows":[4,7], "dataStartRow":5, "rowBlock":1,
    "columns": { "bench_code":"A","operator_ref":"B","work_order_no":"C","grade_code":"D","customer_name":"E",
      "final_od_mm":"F","final_id_mm":"G","final_th_mm":"H","final_len_mm":"I",
      "from_od_mm":"J","from_th_mm":"K","from_len_mm":"L","to_od_mm":"M","to_id_mm":"N","to_th_mm":"O","to_len_mm":"P",
      "draw_plan_len_mm":"Q","stage":"R","accepted_nos":"S","accepted_mt":"T","rejected_nos":"U","drawn_meter":"V","breakdown_remark":"W" },
    "repeatingGroups": { "by":"bench_code", "blockLabelCell":"A", "breakdownRow":true } },
  "footer": { "supervisor":"B41", "incharge":"S41" },
  "numberFormats": { "final_od_mm":"0.00","accepted_mt":"0.000" } }
```
**DB-FT-03 Die History Card** — one card per die (receiving-inspection header block + history rows); template + layout writing `db_tooling` header cells and `db_tooling_history` rows.
**DB-FT-08 Die & Plug Issue Slip** — one slip per issue; template + layout writing the `db_tool_issue` fields.

Registry + buttons: each a `ReportDefinition` (processMapper over its table), `POST /m1/db/export { report, filters }`. The **export button** on the Draw Bench screen offers a report picker (Production / Die History / Issue Slip). Prints = the controlled formats, layout and revision intact, data in the cells.

---

## 6. Validation ruleset (shared engine)

```ts
// packages/shared-validation/src/engine/rulesets/drawbench.ts
import { required, oneOf, lessThan, sumEquals, range, toleranceVsSpec } from '../rules';
export const drawRules = [
  { field:'work_order_no', label:'Work Order', rules:[required('work_order_no','Work Order')] },
  { field:'bench_code',    label:'Draw Bench', rules:[required('bench_code','Draw Bench')] },
  { field:'stage',         label:'Inter/Final', rules:[oneOf('stage',['INTER','FINAL'])] },
  { field:'draw_pass',     label:'Pass',       rules:[oneOf('draw_pass',['1','2','3'])] },
  { field:'to_od_mm',      label:'To OD',      rules:[required('to_od_mm','To OD'), lessThan('to_od_mm','from_od_mm','To OD')] }, // drawing reduces
  { field:'to_th_mm',      label:'To THK',     rules:[lessThan('to_th_mm','from_th_mm','To THK','WARN')] },
  { field:'accepted_nos',  label:'Accepted',   rules:[sumEquals('input_nos',['accepted_nos','rejected_nos'],2,'Input')] }, // reconcile
  { field:'to_od_mm',      label:'Bench fit',  rules:[toleranceVsSpec('to_od_mm','bench_finished_od_max',0,'Finished OD','WARN')] }, // Table-C, warning-only
  { field:'swage_end_mm',  label:'Swage end',  rules:[toleranceVsSpec('swage_end_mm','swage_spec_mm','swage_tol','Swage end')] }, // Table-B by tonnage
  { field:'disposition',   label:'Disposition',rules:[oneOf('disposition',['OK','HOLD','REJECT'])] },
];
// Table-A cadence is a capture-flow rule, not a field rule: given the trigger (NEW_SIZE/4M/CUSTOMER/MASS/SHIFT_CHANGE),
// require the right number of db_inspection rows (e.g. NEW_SIZE => 3: first-off start+middle + last-off) before submit.
// Die/plug: crack in any piece => reject full set (block issue).
```
Bench-eligibility (Table-C) and swage-end (Table-B by tonnage) come from `master.machine_spec` / a swage master, passed as the rule `master`. Most bench-fit and dimensional checks are **WARN** (operator can override, matching the plant's warning-only ethos); missing WO/bench/pass and `to_od ≥ from_od` are **ERROR**. Table-A drives the required inspection-row count at submit.

---

## 7. API & build sequence

**API:** `GET /m1/db/records`, `POST /m1/db/records` (Zod + engine), `/submit|/approve|/hold`, `GET /m1/db/records/:id`, `POST /m1/db/export`. Tenant + RLS + idempotency as elsewhere.

**Build order (fragile, additive):** (1) `prod_db_lot` + children + `master.db_tooling` migrations, seed Table-C benches, `dbSchema`, `saveDbLot`, routes, seed DB station — verify `smoke:api`. (2) register `DB` in `processConfig` — confirm nav. (3) generalise CTL assignment/eligibility → `suggestDbBench`/`checkDbEligibility` (Table-C). (4) `DrawBenchBody` (machine check + FROM/TO + inspection + die/plug issue) wired in `CaptureWorkspace` (DB-guarded) — verify order/pass-linked persist and multi-pass dedup. (5) `drawRules` + swage/Table-C masters + validation. (6) `DB-FT-01/03/08` templates + layouts + export buttons. (7) History confirm. All DB-guarded; other processes untouched.

**Acceptance:** select a Draw order → bench suggested vs Table-C (warn if out of band) → machine check → capture pass-1 FROM/TO + accepted/rejected + swage-end + 1st-off inspection + die/plug issue → save → `prod_db_lot` rows are the log sheet → pass-2/3 re-enter without duplicating journey rows → History shows the same records by order/pass/timestamps → the DB-FT-01/03/08 exports are visually identical to the controlled formats with data in the right cells → validation blocks `to_od ≥ from_od` and reconciles accepted+rejected, warns on bench-fit/swage tolerance → other processes unchanged.

---

## 8. Gaps to confirm before freeze

- **DRAW-07** start-of-shift machine-check sheet not yet shared (using the 5-point set as interim).
- Table-C finished bands for **DB-45/80/120** to confirm on the controlled hard copy (DB-10/20/40 and both LDP benches are clean).
- Full **swaging pointing-set** charts (A51/A59/A59-LDP) — several sizes; confirm remaining rows from the WI.
- Draw load / drawn-metre / cycle-time are PLC candidates → MANUAL now, AUTO in Phase-2 via `data_source`.

---

## Bottom line

Draw Bench is a new `DB` process built on the existing **CTL** machinery (per-machine common area, assignment, warning-only eligibility, unlimited child rows) with the envelope swapped to Table-C. Fields come straight from DB-FT-01 plus the machine-check, 1st-off/last-off inspection (Table-A cadence), and die/plug history/issue (DB-FT-03/08); multi-pass is `draw_pass` with deduped re-entry; exports reproduce all three formats via templates; validation enforces the real draw rules (reduces on draw, reconcile, bench fit, swage-end by tonnage). Additive, format-faithful, order-linked on the existing spine — the same M1, extended to drawing, completing the Tube Mill → Furnace → STP → Draw Bench route.

*Grounded in DB-FT-01 / DB-FT-03 / DB-FT-08 (read cell-by-cell), the Draw Bench field workbook (Tables A/B/C), and `zedral_test-share-the-code` (real reuse points cited).*
