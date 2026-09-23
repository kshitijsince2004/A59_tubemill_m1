# ZEDRAL — Furnace (Annealing / RHF) Process · Implementation Plan

**Goodluck India Limited · A-59 CEW/CDW line · Roller-Hearth Furnace (Annealing) · M1 Phase-1 manual digitization, PLC-ready**
**Audience:** dev team / IDE. Same house style and reuse-first approach as the Tube Mill build spec and the Phase-1 assessment. Grounded in the real format (`ANN-FT-01`, read cell-by-cell), the field dictionary (Furnace workbook, 27 fields), and the repo (`zedral_test-share-the-code`).

---

## 0. Scope and the one architectural decision

Furnace = heat treatment (Annealing 104A / Normalizing-SRA 104B) between Tube Mill and STP. Phase-1 is manual capture on the tablet; PLC/SCADA (RHF already logs zone temps + speed) is deferred behind `data_source` (MANUAL default).

**Decision — Furnace is a NEW process `FUR`, not the existing `ANN`.** The repo already has an `ANN` process, but it is a **cold-rolling bell/batch furnace**: `annSchema` is a charge/base model (`chargeNo`, `baseNo`, `dewPointN2/H2`, loading/unloading MT) writing to `txn.ann_charge` / `txn.ann_charge_coil`, with a bell-furnace export (`AnnChargeReport`: charge_temp/gas_temp/base_press/fan_rpm…). The Goodluck A-59 furnace is a **roller-hearth furnace (RHF)** — continuous, **six temperature zones (I–VI, min/max)**, line speed in m/hr, N2-PSA/EXO protective gas. Different machine, different data. So **reuse the ANN *framework and export pattern*, not its tables.** Adding a `FUR` process (rather than overloading `ANN`) keeps the existing cold-rolling ANN untouched — the fragile-update rule.

---

## 1. Reuse map (what exists vs what is new)

| Concern | Reuse (exists) | New for FUR |
|---|---|---|
| Process registry | `lib/processConfig.ts` `ProcessStationCode` union + `PROCESS_STATIONS`; server `ProcessStationService`/`ProcessRouteService` | add `'FUR'` code + config + station seed |
| Nav (Orders/Capture/History) | `OperatorNavRail` generic-process items; `classifyOperatorNav` | none (FUR falls into generic `isProcess` branch) |
| Orders queue | `components/process/ProcessHub.tsx` | FUR queue title/tabs (guarded `processCode==='FUR'`) |
| Capture shell | `ScopeCaptureRoute` → `ProcessCapturePage` → `CaptureWorkspace` | `FurnaceBody` in `components/process/bodies/`, wired by `processCode==='FUR'` |
| History | `pages/process/ProcessOperatorHistoryPage.tsx` | none (reads `prod_fur_run`) |
| Persistence | `ProductionService` + `productionRoutes` + `coil.coil` + `planning.order_journey` | `saveFurRun`, `/m1/fur/...`, `txn.prod_fur_run` |
| Export (faithful) | `AnnChargeReportWorkbookBuilder` pattern + `ReportDefinition`/`registerDictionary` + the TemplateInjector mechanism (build spec §3) | `ANN-FT-01.xlsx` template + `ANN-FT-01.v1.json` layout |
| Validation | shared validation engine (build spec §4) | `furnaceRules` ruleset |

Everything left of persistence is UI wiring on existing shells; persistence/history reuse existing services and tables. No redesign.

---

## 2. Fields — from ANN-FT-01 (exact)

Report title block: `GOOD LUCK INDUSTRIES / FURNACE PRODUCTION REPORT / Date / Shift`; footer sign. One row per lot; six zones each MIN/MAX. Table `txn.prod_fur_run`.

| Field (paper) | Column | Type | Unit | Req | Class | Validation |
|---|---|---|---|---|---|---|
| S No. | `sl_no` | int | - | Y | SYSTEM | auto |
| Customer Name | `customer_name` | text | - | Y | DERIVED (WO) | - |
| OD × THK × LENGTH | `size` (jsonb od/thk/len) | json | mm | Y | DERIVED (WO) | od,thk,len > 0 |
| Work Order / P.O. No. | `work_order_no` | text | - | Y | DERIVED (WO) | required, FK order |
| Specification / Grade | `grade_code` | text | - | Y | DERIVED (WO) | FK master.grade |
| No. of Tubes — Nos | `qty_nos` | int | Nos | Y | MANUAL | ≥ 1 |
| No. of Tubes — MT | `qty_mt` | dec | MT | Y | DERIVED (nos × wt/m) | ≥ 0 |
| Heat Treatment | `heat_treatment` | enum | - | Y | MANUAL | ANNEAL \| NORMALIZE \| SRA |
| Zone I..VI Temp — MIN | `zone1_min … zone6_min` | dec | °C | Y | MANUAL (SCADA P2) | 0–1200 |
| Zone I..VI Temp — MAX | `zone1_max … zone6_max` | dec | °C | Y | MANUAL | 0–1200; max ≥ min |
| Speed (running) | `line_speed_m_hr` | dec | m/hr | Y | MANUAL | tol ±2 vs recipe |
| Total | `total_mt` | dec | MT | Y | DERIVED | = Σ qty_mt |
| Remarks | `remarks` | text | - | N | MANUAL | - |
| (disposition) | `disposition` | enum | - | Y | MANUAL | ACCEPT \| QUARANTINE (no rework) |

**Gas plant child `txn.prod_fur_gas`** (N2-GAS-FT-01 / EXO-GAS-FT-02): `gas_type` (N2_PSA \| EXO), `dew_point`, `pressure`, `flow`, `png_consumption`, `nh3_consumption`, per shift. RHF gas assignment: N2-PSA on RHF-02/04/05/06, EXO on RHF-01/03.

---

## 3. Database

Reuse conventions (snake_case+unit, `tenant_id`+RLS, `data_source` default MANUAL, weight MT). New, distinct from the bell-anneal `ann_charge`:

```sql
CREATE TABLE txn.prod_fur_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  work_order_no text, coil_no text, shift_log_id text, machine_code text,   -- RHF-01..06
  sl_no int, customer_name text, size jsonb, grade_code text,
  qty_nos int, qty_mt numeric(12,3),
  heat_treatment text,                                    -- ANNEAL|NORMALIZE|SRA
  zone1_min numeric(6,1), zone1_max numeric(6,1), ... zone6_min numeric(6,1), zone6_max numeric(6,1),
  line_speed_m_hr numeric(7,2), total_mt numeric(12,3),
  disposition text, remarks text,
  data_source text NOT NULL DEFAULT 'MANUAL', status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz DEFAULT now(), created_by text
);
CREATE TABLE txn.prod_fur_gas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  run_id uuid REFERENCES txn.prod_fur_run(id) ON DELETE CASCADE,
  gas_type text, dew_point numeric(6,2), pressure numeric(7,2), flow numeric(9,2),
  png_consumption numeric(10,2), nh3_consumption numeric(10,2), shift_ref text
);
```
Keyed to WO + coil + shift on the existing `coil.coil` + `planning.order_journey` spine. Migration under `packages/server/migrations/modules/fur/`. Masters: furnace recipe (soaking-zone spec °C + speed spec m/hr per grade/size) → `master.fur_recipe` for the tolerance rules; RHF list + gas assignment → `master.machine`/`machine_spec`.

---

## 4. Capture flow (Orders → Capture → Reading → History)

1. **Register `FUR`** in `processConfig` (label "Furnace", queue title "Furnace Queue", tab "Coils") + seed the FUR station server-side. FUR then inherits the generic Orders/Capture/History nav automatically.
2. **ORDERS** (`ProcessHub`): the queue of tubes arriving from Tube Mill for heat treatment (from `planning.order_journey`, route position Furnace). Operator selects a lot.
3. **CAPTURE** (`CaptureWorkspace`, `processCode==='FUR'`): render `FurnaceBody`.
4. **READING** = `FurnaceBody` — a **6-zone temperature grid** (I–VI, Min/Max), line speed, qty (Nos/MT auto), heat-treatment select, disposition, remarks; gas-plant sub-panel (N2-PSA/EXO). Header (customer/size/grade) pre-filled read-only from the order. Pattern to copy: `PklChartGrid` (grid) + `AnnBaseCard` (header/assign look).
   - Furnace has no first-off gate like the tube mill; its process control is the **batch-gap** rule (300 mm between lots, 6000 mm between batches) surfaced as a WARN, and the zone-vs-recipe tolerance.
5. **PERSIST** `saveFurRun` → `txn.prod_fur_run` (+ `prod_fur_gas`), order/coil/shift keyed. The persisted rows are the log sheet.
6. **HISTORY** (`ProcessOperatorHistoryPage`): FUR records by order/shift, each showing the order, timestamps, zones and disposition.

Data integrity: one order-linked record per lot; no duplicate tables; reuse the spine. Furnace disposition is ACCEPT/QUARANTINE only (no rework) — enforced by the ruleset and reflected in the journey status.

---

## 5. Export — faithful ANN-FT-01 reproduction

Use the template + layout + injector mechanism (build spec §3), which mirrors the existing `AnnChargeReportWorkbookBuilder` pattern.

- **Template:** `export/templates/ANN-FT-01.xlsx` — the real Furnace Production Report with sample rows stripped, title block / 6-zone header / footer kept.
- **Layout:** `export/layouts/ANN-FT-01.v1.json`:
```jsonc
{ "report":"ANN-FT-01", "version":1, "sheet":"Sheet1",
  "titleBlock": { "date":"<dateCell>", "shift":"<shiftCell>" },
  "table": { "headerRows":[1,4], "dataStartRow":5, "rowBlock":1,
    "columns": { "sl_no":"A","customer_name":"B","size":"C","work_order_no":"D","grade_code":"E",
      "qty_nos":"F","qty_mt":"G","heat_treatment":"H",
      "zone1_min":"I","zone1_max":"J","zone2_min":"K","zone2_max":"L","zone3_min":"M","zone3_max":"N",
      "zone4_min":"O","zone4_max":"P","zone5_min":"Q","zone5_max":"R","zone6_min":"S","zone6_max":"T",
      "line_speed_m_hr":"U","total_mt":"V","remarks":"W" } },
  "numberFormats": { "qty_mt":"0.000","zone1_min":"0.0" } }
```
(Confirm exact column letters against the checked-in template; the ANN-FT-01 header groups zones I–VI under Min/Max, so the data columns follow that order.)
- **Registry + button:** register `ANN-FT-01` as a `ReportDefinition` (processMapper query over `prod_fur_run`), served by `POST /m1/fur/export { report:"ANN-FT-01", filters }`. The **export button** on the Furnace screen calls it; filters (date/shift/machine/order) scope the rows. Gas logs (`N2-GAS-FT-01`, `EXO-GAS-FT-02`) get their own templates/layouts + buttons the same way.

Result: the printed sheet is the controlled ANN-FT-01, revision and layout intact, data in the zone cells.

---

## 6. Validation ruleset (shared engine)

```ts
// packages/shared-validation/src/engine/rulesets/furnace.ts
import { required, range, toleranceVsSpec, oneOf } from '../rules';
export const furnaceRules = [
  { field:'work_order_no', label:'Work Order', rules:[required('work_order_no','Work Order')] },
  { field:'qty_nos', label:'No. of Tubes', rules:[required('qty_nos','No. of Tubes'), range('qty_nos',1,100000,'No. of Tubes')] },
  { field:'heat_treatment', label:'Heat Treatment', rules:[oneOf('heat_treatment',['ANNEAL','NORMALIZE','SRA'])] },
  { field:'disposition', label:'Disposition', rules:[oneOf('disposition',['ACCEPT','QUARANTINE'])] }, // no rework
  ...['zone1','zone2','zone3','zone4','zone5','zone6'].flatMap(z => [
    { field:`${z}_min`, label:`${z} min`, rules:[range(`${z}_min`,0,1200,`${z} min`)] },
    { field:`${z}_max`, label:`${z} max`, rules:[range(`${z}_max`,0,1200,`${z} max`)] },
  ]),
  { field:'zone3_max', label:'Soaking max', rules:[toleranceVsSpec('zone3_max','soaking_spec_c',10,'Soaking temp')] }, // ±10 °C
  { field:'line_speed_m_hr', label:'Line speed', rules:[toleranceVsSpec('line_speed_m_hr','speed_spec_m_hr',2,'Line speed')] }, // ±2 m/hr
];
```
Run inline (client, ERROR blocks / WARN cautions) and authoritatively on `saveFurRun` (422 on ERROR). Masters (`soaking_spec_c`, `speed_spec_m_hr` per grade) loaded from `master.fur_recipe` and passed as the rule `master`. Cross-field: `zone*_max ≥ zone*_min`; batch-gap WARN if the entered gap < 300/6000 mm.

---

## 7. API & build sequence

**API:** `GET /m1/fur/records`, `POST /m1/fur/records` (Zod + engine), `/submit|/approve`, `GET /m1/fur/records/:id`, `POST /m1/fur/export`. Tenant + RLS + idempotency as elsewhere.

**Build order (fragile, additive):** (1) `prod_fur_run` + `prod_fur_gas` migrations, `furSchema`, `saveFurRun`, routes, seed FUR station — verify `smoke:api`. (2) register `FUR` in `processConfig` — confirm nav shows Orders/Capture/History with no other change. (3) `FurnaceBody` (6-zone grid + gas panel) wired in `CaptureWorkspace` (FUR-guarded) — verify order-linked persist. (4) `furnaceRules` + inline/server validation. (5) `ANN-FT-01` template + layout + export button (+ gas logs). (6) History confirm. Everything FUR-guarded; other processes untouched.

**Acceptance:** select a Furnace order → capture the 6-zone reading + gas → save → the `prod_fur_run` row is the log sheet → History shows the same record against the same order/timestamps → the ANN-FT-01 export is visually identical to the controlled format with data in the zone cells → validation blocks out-of-range zones and warns on soaking/speed tolerance → other processes' nav/capture unchanged.

---

## Bottom line

Furnace is a new `FUR` process reusing the ANN *framework* (nav, capture shell, history, export-builder pattern) but with its own RHF data model (6 zones, speed, gas) — kept separate from the existing bell-anneal ANN so nothing regresses. Fields come straight from ANN-FT-01, export reproduces that format via a template, validation enforces the real furnace ranges, and everything persists order-linked on the existing spine. Additive, format-faithful, and consistent with the Tube Mill build spec.

*Grounded in ANN-FT-01 (read cell-by-cell), the Furnace field workbook, and `zedral_test-share-the-code` (real reuse points cited).*
