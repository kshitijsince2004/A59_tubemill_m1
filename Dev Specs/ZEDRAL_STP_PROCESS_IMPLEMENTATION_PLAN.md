# ZEDRAL — STP (Surface Treatment Plant) Process · Implementation Plan

**Goodluck India Limited · A-59 CEW/CDW line · STP soap-draw surface treatment (105A) · M1 Phase-1 manual digitization, PLC-ready**
**Audience:** dev team / IDE. Same house style and reuse-first approach as the Tube Mill build spec and the Furnace plan. Grounded in the real formats (`STP-FT-01A` read cell-by-cell, plus `STP-FT-04` bath history and `STP-06` coating), the field dictionary (STP workbook, 28 fields), and the repo (`zedral_test-share-the-code`).

---

## 0. Scope

STP prepares the tube surface for cold drawing (degrease, pickle, phosphate, lubricate) between Furnace and Draw Bench. Phase-1 is manual capture; the auto-crane / bath SCADA (ET200S/TP700) is deferred behind `data_source` (MANUAL default). STP is a **new process `STP`** on the generic process pattern — no existing analog to overload, so it slots cleanly into the framework like HRS/CRS/CTL.

The STP primary report is unusual: **`STP-FT-01A` is a two-part sheet on one page** — a left table (per-lot production + bath temperatures/dip-times, with the spec ranges printed in the headers) and a right table (bath chemical analysis: spec value vs observed value). Plus `STP-FT-04` (bath history card) and `STP-06` (phosphate coating weight). The plan reproduces all three faithfully.

---

## 1. Reuse map (what exists vs what is new)

| Concern | Reuse (exists) | New for STP |
|---|---|---|
| Process registry | `lib/processConfig.ts` `ProcessStationCode` + `PROCESS_STATIONS`; server `ProcessStationService`/`ProcessRouteService` | add `'STP'` code + config + station seed |
| Nav (Orders/Capture/History) | `OperatorNavRail` generic-process items; `classifyOperatorNav` | none (STP → generic `isProcess` branch) |
| Orders queue | `components/process/ProcessHub.tsx` | STP queue title/tabs (`processCode==='STP'`) |
| Capture shell | `ScopeCaptureRoute` → `ProcessCapturePage` → `CaptureWorkspace` | `StpBody` in `components/process/bodies/`, wired by `processCode==='STP'` |
| History | `pages/process/ProcessOperatorHistoryPage.tsx` | none (reads `prod_stp_lot`) |
| Persistence | `ProductionService` + `productionRoutes` + `coil.coil` + `planning.order_journey` | `saveStpLot`, `/m1/stp/...`, `txn.prod_stp_*` |
| Export (faithful) | `AnnChargeReportWorkbookBuilder` pattern + `ReportDefinition`/`registerDictionary` + TemplateInjector (build spec §3) | `STP-FT-01A.xlsx` template + `STP-FT-01A.v1.json` (two-table) layout |
| Validation | shared validation engine (build spec §4) | `stpRules` ruleset (bath spec ranges) |

Additive, process-guarded; no redesign, no impact on other processes.

---

## 2. Fields — from STP-FT-01A / STP-04 / STP-06 (exact)

### 2.1 Production + process monitoring (STP-FT-01A left) → `txn.prod_stp_lot` (+ child `txn.stp_bath_reading`)
Title block: `GOOD LUCK INDUSTRIES / STP PRODUCTION CUM PROCESS MONITORING REPORT / For Unit A-59 / Format GLI-FT-STP-01A / Date / Shift`; footer `SHIFT SUPERVISOR-STP` / `SHIFT INCHARGE-STP`.

| Field (paper) | Column | Type | Unit | Req | Class |
|---|---|---|---|---|---|
| SN | `sl_no` | int | - | Y | SYSTEM |
| Customer | `customer_name` | text | - | Y | DERIVED (WO) |
| Grade | `grade_code` | text | - | Y | DERIVED (WO) |
| OD × THK × LEN | `size` (jsonb) | json | mm | Y | DERIVED (WO) |
| Work Order No. | `work_order_no` | text | - | Y | DERIVED (WO) |
| Qty No | `qty_no` | int | Nos | Y | MANUAL |
| Qty MT | `qty_mt` | dec | MT | Y | DERIVED |

Bath readings (child rows, spec range printed in the format header = the validation spec):

| Bath (header spec) | Reading fields | Spec |
|---|---|---|
| De-greasing 75–85 °C / 10–15 min | `degrease_temp_c`, `degrease_time_min` | 75–85 / 10–15 |
| De-scaling 8–13 min | `descale_time_min` | 8–13 |
| Phosphating 65–75 °C / 6–11 min | `phos_temp_c`, `phos_time_min` | 65–75 / 6–11 |
| Neutralizer 50–60 °C / 1 flash dip | `neut_temp_c`, `neut_dip` | 50–60 |
| Lubrication 70–75 °C / 7–12 min | `lube_temp_c`, `lube_time_min` | 70–75 / 7–12 |
| Dryer 80–120 °C / 12–17 min | `dryer_temp_c`, `dryer_time_min` | 80–120 / 12–17 |
| Surface finish neutralizer 65–85 °C / flash dip | `sf_neut_temp_c` | 65–85 |
| Reactive oil ambient / 8–10 min | `roil_time_min` | 8–10 |

### 2.2 Bath analysis (STP-FT-01A right) → child `txn.stp_bath_analysis`
Rows `(bath_name, spec_value, obz_value, chem_name)` straight from the format:

| Bath | Parameter (spec) | Chemical |
|---|---|---|
| Degreasing | TA 78–90 ml | G-390 |
| HCl pickling | HCl 6–22 % ; Fe 10 % max | HCl-30% min |
| Activation | pH 7–8 | GV-6521 |
| Phosphating | TA 32–38 ; FA 4–6 ; ACC 3–5 ; OXTA 18–22 | 3510E / 3510A / GB-14 |
| Neutralizer | pH 8–10 | G-21 |
| Lube | CON 4–6 % ; FA 0–1 % ; pH 8–10 | G-3005 |
| Water rinse | 1 deg 7–10 pH ; 2 acid 2–5 ; 3 acid 5–7 ; 4 phos 5–8 | - |
| Oil bath | water 1–2 % ; acid-no 100–200 | Bondrite LR 06021 |
| Neutralizer (final) | pH 6.5–7.5 | Gardoline-R 1683 |

Plus **Addition of chemical**: `chem_name`, `quantity`, `batch_no_date`.

### 2.3 Bath history (STP-FT-04) → `txn.stp_bath_history`
`bath_name`, change frequency, last-change date, next-due — the bath-change regime card.

### 2.4 Coating weight (STP-06) → `txn.stp_coating`
`coating_gsm` (phosphate coat, **4.0–8.0 g/m²**, weekly), lot ref, date. Draw-lubrication criterion, not a final-product criterion.

---

## 3. Database

```sql
CREATE TABLE txn.prod_stp_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  work_order_no text, coil_no text, shift_log_id text, machine_code text,   -- STP-A59
  sl_no int, customer_name text, grade_code text, size jsonb, qty_no int, qty_mt numeric(12,3),
  supervisor_ref text, incharge_ref text, remarks text,
  data_source text NOT NULL DEFAULT 'MANUAL', status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz DEFAULT now(), created_by text
);
CREATE TABLE txn.stp_bath_reading (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_stp_lot(id) ON DELETE CASCADE,
  bath text, temp_c numeric(6,2), time_min numeric(6,2)      -- one row per bath, or wide columns per §2.1
);
CREATE TABLE txn.stp_bath_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_stp_lot(id) ON DELETE CASCADE,
  bath_name text, parameter text, spec_value text, obz_value numeric(9,3), chem_name text
);
CREATE TABLE txn.stp_bath_history ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  bath_name text, change_freq text, last_change date, next_due date, machine_code text );
CREATE TABLE txn.stp_coating ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_stp_lot(id), coating_gsm numeric(5,2), taken_on date );
```
Keyed to WO + coil + shift on the existing `coil.coil` + `planning.order_journey` spine. Migration under `packages/server/migrations/modules/stp/`. Master: `master.stp_bath_spec` (bath → parameter → spec range) so the analysis rules have real spec keys.

**[dev-decision]** wide vs tall for `stp_bath_reading` — wide columns (per §2.1 field names) map 1:1 to the STP-FT-01A layout and are simpler to inject into the template; a tall `(bath,temp,time)` table is more flexible. Prefer wide for export fidelity.

---

## 4. Capture flow (Orders → Capture → Reading → History)

1. **Register `STP`** in `processConfig` (label "STP", queue "STP Queue", tab "Coils") + seed the STP station. STP inherits Orders/Capture/History nav automatically.
2. **ORDERS** (`ProcessHub`): tubes arriving from Furnace for surface treatment (route position STP in `order_journey`). Select a lot.
3. **CAPTURE** (`CaptureWorkspace`, `processCode==='STP'`): render `StpBody`.
4. **READING** = `StpBody` — two panels matching the paper: (a) **production + bath readings** (per-bath temp/time inputs with the spec range shown beside each, like a form grid — pattern `PklChartGrid`); (b) **bath analysis** (spec vs observed per parameter, pattern a compact table). Header (customer/grade/size/qty) pre-filled read-only from the order. STP-06 coating and STP-04 bath-change are lighter secondary entries (weekly/periodic), on their own small forms.
5. **PERSIST** `saveStpLot` → `txn.prod_stp_lot` (+ children), order/coil/shift keyed. The rows are the log sheet.
6. **HISTORY** (`ProcessOperatorHistoryPage`): STP records by order/shift with the order, timestamps, and bath readings.

Data integrity: one order-linked lot record; children hang off it; no duplicate tables; reuse the spine. STP has no rework gate; its control is the bath-in-spec check (warnings).

---

## 5. Export — faithful STP-FT-01A reproduction (two tables, one sheet)

Template + layout + injector (build spec §3); the layout carries **two tables** because the sheet does.

- **Template:** `export/templates/STP-FT-01A.xlsx` — the real report with sample rows stripped; title block, the bath spec-range headers, the analysis block labels, and the footer kept exactly.
- **Layout:** `export/layouts/STP-FT-01A.v1.json`:
```jsonc
{ "report":"STP-FT-01A", "version":1, "sheet":"STP",
  "titleBlock": { "date":"<dateCell>", "shift":"<shiftCell>" },
  "table": { "dataStartRow":8, "rowBlock":1,
    "columns": { "sl_no":"A","customer_name":"B","grade_code":"C","size":"D","work_order_no":"E",
      "qty_no":"F","qty_mt":"G","degrease_temp_c":"H","degrease_time_min":"I","descale_time_min":"J",
      "phos_temp_c":"K","phos_time_min":"L","neut_temp_c":"M","neut_dip":"N","lube_temp_c":"O",
      "lube_time_min":"P","dryer_temp_c":"Q","dryer_time_min":"R","sf_neut_temp_c":"S","roil_time_min":"T" } },
  "analysisTable": { "anchorCol":"AA", "specCol":"AB", "obzCol":"AC", "startRow":8,
    "rows": [ {"bath":"Degreasing","param":"TA"}, {"bath":"HCl pickling","param":"HCl%"}, "…" ] },
  "footer": { "supervisor":"<cell>", "incharge":"<cell>" } }
```
(Confirm exact cells against the checked-in template — the analysis block sits on the right of the sheet; the injector writes only the `obz_value` cells, leaving the printed spec labels untouched.)
- **Registry + button:** `STP-FT-01A` `ReportDefinition` (processMapper over `prod_stp_lot` + children), `POST /m1/stp/export { report, filters }`, export button on the STP screen. `STP-FT-04` and `STP-06` get their own templates/layouts/buttons the same way.

Result: the printed sheet is the controlled STP-FT-01A — both tables, all spec-range labels, the footer — with observed values in the right cells.

---

## 6. Validation ruleset (shared engine)

```ts
// packages/shared-validation/src/engine/rulesets/stp.ts
import { required, range, toleranceVsSpec } from '../rules';
export const stpRules = [
  { field:'work_order_no', label:'Work Order', rules:[required('work_order_no','Work Order')] },
  { field:'qty_no', label:'Qty', rules:[required('qty_no','Qty'), range('qty_no',1,100000,'Qty')] },
  // bath temps / times — ranges straight from the STP-FT-01A headers (WARN, process guidance not a hard stop)
  { field:'degrease_temp_c', label:'Degrease temp', rules:[range('degrease_temp_c',75,85,'Degrease temp','WARN')] },
  { field:'degrease_time_min', label:'Degrease time', rules:[range('degrease_time_min',10,15,'Degrease time','WARN')] },
  { field:'phos_temp_c', label:'Phosphate temp', rules:[range('phos_temp_c',65,75,'Phosphate temp','WARN')] },
  { field:'phos_time_min', label:'Phosphate time', rules:[range('phos_time_min',6,11,'Phosphate time','WARN')] },
  { field:'neut_temp_c', label:'Neutralizer temp', rules:[range('neut_temp_c',50,60,'Neutralizer temp','WARN')] },
  { field:'lube_temp_c', label:'Lube temp', rules:[range('lube_temp_c',70,75,'Lube temp','WARN')] },
  { field:'lube_time_min', label:'Lube time', rules:[range('lube_time_min',7,12,'Lube time','WARN')] },
  { field:'dryer_temp_c', label:'Dryer temp', rules:[range('dryer_temp_c',80,120,'Dryer temp','WARN')] },
  { field:'roil_time_min', label:'Reactive-oil time', rules:[range('roil_time_min',8,10,'Reactive-oil time','WARN')] },
  { field:'coating_gsm', label:'Coating weight', rules:[range('coating_gsm',4.0,8.0,'Coating weight','WARN')] },
];
// bath-analysis children validated against master.stp_bath_spec via range/toleranceVsSpec per (bath,parameter):
//   Degreasing TA 78–90; Phosphating TA 32–38, FA 4–6, ACC 3–5, OXTA 18–22; Lube CON 4–6, FA 0–1, pH 8–10;
//   Activation pH 7–8; Neutralizer pH 8–10 and final 6.5–7.5; water rinse pH bands; oil bath water 1–2%, acid-no 100–200.
```
Run inline (client) and authoritatively on `saveStpLot` (bath analysis validated as `siblings` against `master.stp_bath_spec`). Bath ranges are process-monitoring, so most are `WARN` (out-of-spec is flagged for the supervisor, not blocked); missing WO/qty are `ERROR`.

---

## 7. API & build sequence

**API:** `GET /m1/stp/records`, `POST /m1/stp/records` (Zod + engine), `/submit|/approve`, `GET /m1/stp/records/:id`, `POST /m1/stp/export`. Tenant + RLS + idempotency as elsewhere.

**Build order (fragile, additive):** (1) `prod_stp_lot` + children migrations, `stpSchema`, `saveStpLot`, routes, seed STP station — verify `smoke:api`. (2) register `STP` in `processConfig` — confirm nav. (3) `StpBody` (production + bath grids, analysis table) wired in `CaptureWorkspace` (STP-guarded) — verify order-linked persist. (4) `stpRules` + `master.stp_bath_spec` seed + inline/server validation. (5) `STP-FT-01A` (two-table) template + layout + export button (+ STP-04, STP-06). (6) History confirm. All STP-guarded; other processes untouched.

**Acceptance:** select an STP order → capture bath temps/times + analysis + coating → save → the `prod_stp_lot` (+ children) rows are the log sheet → History shows the same record against the same order/timestamps → the STP-FT-01A export is visually identical (both tables, spec labels, footer) with observed values in the right cells → validation warns on out-of-spec baths and blocks missing WO/qty → other processes unchanged.

---

## Bottom line

STP is a new `STP` process on the existing generic capture framework: register the code, add `StpBody` (production + the two bath panels) wired by `processCode==='STP'`, persist order-linked to `txn.prod_stp_*` on the existing spine, reproduce STP-FT-01A faithfully via a two-table template, and validate against the real bath spec ranges. Additive, format-faithful, and consistent with the Tube Mill and Furnace plans — the same M1, extended to surface treatment.

*Grounded in STP-FT-01A / STP-FT-04 / STP-06 (read cell-by-cell), the STP field workbook, and `zedral_test-share-the-code` (real reuse points cited).*
