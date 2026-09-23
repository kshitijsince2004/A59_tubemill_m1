# ZEDRAL — M1 Phase 1 Build Spec · Tube Mill → Furnace → STP → Draw Bench

**Goodluck India Limited · A-59 CEW/CDW line · Manual digitization, PLC-ready · ERP: Dynamics 365 BC**
**Audience:** developers / IDE agent. This is the detailed, buildable spec for the four processes: their process-specific fields and reports, a **per-report export button that reproduces the exact plant format**, and a **shared validation engine (with code)**. It sits under the M1 Phase 1 Implementation Assessment and reuses the existing platform; it does not fork it.

Grounding: the real plant formats (read cell-by-cell — TM-FT-01/02/03/04/05/08, GLI-FT-TM-12; ANN-FT-01; STP-FT-01A/04/06; DB-FT-01/03/08), the four field-dictionary workbooks (canonical table names `prod_tm_*`, `prod_ann_run`, `prod_stp_lot`, `prod_db_lot`), and the repo (`zedral_test-share-the-code`: Kysely, Zod `m1Forms`, the export framework `ReportDefinition`/`registerDictionary`/`DprTemplateInjector`/`blankDprWorkbook`/layout JSON).

---

## 0. Principles (fixed for this spec)

1. **One field set per process, taken from its own paper formats.** Each process captures exactly the fields on its approved GLI formats, in the plant's terms and units. No invented fields; no field dropped because a form is large.
2. **One export button per report, byte-faithful to the plant format.** Export does not "design a sheet" — it fills captured data into a stored copy of the actual plant format (.xlsx template + a cell layout map + an injector). What the operator prints equals the controlled format.
3. **One validation engine, run on both client and server.** Declarative rules (required, range, tolerance-vs-spec, enum, cross-field, cross-record) defined once per process, enforced inline in the UI and authoritatively on save. Invalid data is never silently dropped.
4. **It must feel like one M1.** Reuse the process registry, roles, coil/journey spine, shift/handover, capture lifecycle (DRAFT→SUBMITTED→APPROVED→HOLD), and the export engine. `data_source` (MANUAL default) on every capture row keeps Phase-2 PLC open.

Plant route (from the route card, use this order): **Tube Mill (ERW) → Furnace (Annealing, RHF) → STP (soap) → Draw Bench (multi-pass)**. Drawing loops FUR→STP→Swage→DB→Centreless for passes 1–3.

---

## 1. Architecture: three shared pieces

### 1.1 Capture (reuse)
Each process = a `process_id` in the existing registry, a Zod contract in `packages/shared-validation/src/rules/m1Forms.ts` extending `baseProcessEntrySchema`, a `txn.prod_<proc>*` table set, a save method on `ProductionService`, a route on `productionRoutes`, and a React capture screen composed from existing form primitives. Furnace reuses the **ANN** pattern (charge/zone), Draw Bench reuses the **CTL** pattern (per-machine, repeating child rows). Nothing here is new architecture.

### 1.2 Export = template + layout + injector (reuse and extend the DPR mechanism)
The repo already fills a **blank workbook template** with data via `blankDprWorkbook.ts` + `DprTemplateInjector.ts` driven by `layouts/dpr_layout.v1.json`. Generalise that into a per-report mechanism:

```
packages/server/src/export/
  templates/            NEW  the actual plant format files, data stripped, one .xlsx per report
    TM-FT-01.xlsx  TM-FT-02.xlsx  TM-FT-03.xlsx  TM-FT-04.xlsx  TM-FT-05.xlsx  TM-FT-08.xlsx  TM-FT-12.xlsx
    ANN-FT-01.xlsx  N2-GAS-FT-01.xlsx  EXO-GAS-FT-02.xlsx
    STP-FT-01A.xlsx  STP-FT-04.xlsx  STP-FT-06.xlsx
    DB-FT-01.xlsx  DB-FT-03.xlsx  DB-FT-08.xlsx
  layouts/              the cell map per report (title-block cells, header row, data start, column bindings, repeating blocks, footer)
    TM-FT-02.v1.json ... DB-FT-01.v1.json
  render/TemplateInjector.ts   NEW generic injector (generalises DprTemplateInjector)
  definitions/            one ReportDefinition per report, registered in registerDictionary.ts
  read/processMappers.ts  add per-process query -> row model
```

Preserving the format is a **file-copy plus cell-write**, so merges, column widths, title block, revision number and spec-range header labels are exactly the controlled copy. Data lands in the data rows only.

### 1.3 Validation (new, shared)
A declarative engine in `packages/shared-validation/src/engine/` (so client and server import the same rules). Rules are data; the engine is code (§4). Zod handles shape/coercion; the engine handles plant business rules (ranges, tolerances vs spec, cross-field, cross-record).

---

## 2. Per-process specification

Conventions: `snake_case` columns with unit suffix; weight **MT** at rollup, **Kg/Nos** operator-facing; `tenant_id`+RLS on every row; `data_source` default `MANUAL`; identity = **WO + coil/lot** on the existing `coil.coil` + `planning.order_journey` spine. Each row below is a real field from the named format.

### 2.1 TUBE MILL  (process_id = TM)

**Reports (each an export button):** TM-FT-05 setup, TM-FT-04 hourly parameters, TM-FT-02 daily production, TM-FT-03 downtime, TM-FT-01 slit inspection, TM-FT-08 work-coil history, GLI-FT-TM-12 edge milling. (Full field-by-field capture already specified in `ZEDRAL_TUBEMILL_M1_A59_IMPLEMENTATION_SPEC.md` and the Tube Mill data-mapping workbook — reuse it.)

**Tables:** `txn.prod_tm_run` (daily production, run header), `txn.prod_tm_bundle` (prime/PQ2/CQ/open child), `txn.tm_setup` (TM-FT-05 + first-off gate), `txn.prod_tm_param` (TM-FT-04 hourly), `txn.stoppage_entry` (TM-FT-03), `txn.tm_slit_inspection` (TM-FT-01), `txn.prod_tm_edgemill` (TM-12), `master.tm_consumable`+`txn.tm_consumable_usage` (TM-FT-08).

**Key capture fields by report** (representative; validation in §4):
- TM-FT-05 setup: tube_size, slit_thk_mm, slit_width_mm, roll_set, mill_no, grade, speed_mpm(spec/obs), power_kw(spec/obs), id_tool, od_tool, work_coil_id, impeder_size, boggie_size, wc_to_wr_mm, coolant_conc_pct, coolant_pressure_kg, argon(Y/N), wiper(Y/N), fin_pass_FF1/FF2/FF3, first_off_result, sign.
- TM-FT-02 daily production: per WO row → prime(nos,mt), pq2(joint/other nos,mt), cq(nos,mt), open(nos,mt), total, raw_material_mt, scrap_mt, yield.
- TM-FT-01 slit inspection: wo, slit_no, weight, hardness_hrb, grade_source, width_start/middle/end_mm, thk_start/middle/end_mm, rejection, reasons.

### 2.2 FURNACE / ANNEALING  (process_id = ANN → table `txn.prod_ann_run`)

**Report:** ANN-FT-01 Furnace Production Report (R4). Gas logs: N2-GAS-FT-01, EXO-GAS-FT-02.

**ANN-FT-01 exact columns** (title block: GOOD LUCK INDUSTRIES / FURNACE PRODUCTION REPORT / date, shift; footer sign):

| Field (paper) | Column | Type | Unit | Req | Class |
|---|---|---|---|---|---|
| S No. | `sl_no` | int | - | Y | SYSTEM |
| Customer Name | `customer_name` | text | - | Y | DERIVED (WO) |
| OD X THK X LENGTH | `size` (jsonb od/thk/len) | json | mm | Y | DERIVED (WO) |
| Work Order / P.O. No. | `work_order_no` | text | - | Y | DERIVED (WO) |
| Specification / Grade | `grade_code` | text | - | Y | DERIVED (WO) |
| No. of Tubes — Nos | `qty_nos` | int | Nos | Y | MANUAL |
| No. of Tubes — MT | `qty_mt` | dec | MT | Y | DERIVED (nos×wt) |
| Heat Treatment | `heat_treatment` | enum | - | Y | MANUAL (ANNEAL/NORMALIZE/SRA) |
| Zone I..VI Temp — MIN | `zone1_min..zone6_min` | dec | °C | Y | MANUAL (SCADA in P2) |
| Zone I..VI Temp — MAX | `zone1_max..zone6_max` | dec | °C | Y | MANUAL |
| Speed (running) | `line_speed_m_hr` | dec | m/hr | Y | MANUAL |
| Total | `total_mt` | dec | MT | Y | DERIVED |
| Remarks | `remarks` | text | - | N | MANUAL |

Child `txn.prod_ann_gas` for gas-plant params (N2-PSA / EXO): dew point, pressure, flow, PNG/NH3 consumption per shift.

**Furnace-specific rules:** six zones (I–VI), each MIN/MAX; soaking-zone temp tolerance ±10 °C; line-speed tolerance ±2 m/hr; batch gap 300 mm between lots, 6000 mm between batches; disposition = ACCEPT/QUARANTINE only (no rework).

### 2.3 STP  (process_id = STP → table `txn.prod_stp_lot`)

**Report:** STP-FT-01A Daily STP Production cum Process Monitoring (R3) — a two-part sheet: left = per-lot production + bath temps/dip-times; right = bath analysis. Plus STP-FT-04 bath history card, STP-06 coating thickness.

**STP-FT-01A left (production + process), per lot** → `txn.prod_stp_lot` + child `txn.stp_bath_reading`:
SN, customer, grade, size(od/thk/len), work_order_no, qty_no, qty_mt, then per bath a temperature and/or dip-time reading with the format's spec-range printed in the header:

| Bath (header spec) | Reading field | Spec (validation) |
|---|---|---|
| De-greasing 75–85 °C / 10–15 min | `degrease_temp_c`, `degrease_time_min` | 75–85 / 10–15 |
| De-scaling 8–13 min | `descale_time_min` | 8–13 |
| Phosphating 65–75 °C / 6–11 min | `phos_temp_c`, `phos_time_min` | 65–75 / 6–11 |
| Neutralizer 50–60 °C / 1 flash dip | `neut_temp_c`, `neut_dip` | 50–60 |
| Lubrication 70–75 °C / 7–12 min | `lube_temp_c`, `lube_time_min` | 70–75 / 7–12 |
| Dryer 80–120 °C / 12–17 min | `dryer_temp_c`, `dryer_time_min` | 80–120 / 12–17 |
| Reactive oil ambient / 8–10 min | `roil_time_min` | 8–10 |

**STP-FT-01A right = bath analysis** → child `txn.stp_bath_analysis` (bath_name, spec_value, obz_value):
Degreasing TA 78–90 ml (G-390); HCl pickling HCl 6–22 % / Fe 10 % max; Activation pH 7–8 (GV-6521); Phosphating TA 32–38 / FA 4–6 / ACC 3–5 / OXTA 18–22 (3510E/3510A/GB-14); Neutralizer pH 8–10 (G-21); Lube CON 4–6 % / FA 0–1 % / pH 8–10 (G-3005); Water rinse 1 deg 7–10 pH, 2 acid 2–5, 3 acid 5–7, 4 phos 5–8; Oil bath water 1–2 % / acid-no 100–200; Neutralizer pH 6.5–7.5. Plus "addition of chemical" (chem_name, quantity, batch_no/date).

STP-06 coating weight: 4.0–8.0 g/m² (weekly).

### 2.4 DRAW BENCH  (process_id = DB → table `txn.prod_db_lot`)

**Report:** DB-FT-01 Draw Bench Production Report (GLI-FT-PRD-DRW-01, R6). Plus DB-FT-03 die history, DB-FT-08 die & plug issue slip.

**DB-FT-01 exact columns** (title block: GOOD LUCK INDUSTRIES / DRAW BENCH PRODUCTION REPORT / A51/A59 & LDP / date, shift; repeating per "DRAW BENCH No." block, each with a Break Down/Remarks row) → `txn.prod_db_lot`:

| Field (paper) | Column | Type | Unit | Req | Class |
|---|---|---|---|---|---|
| DB. No. | `bench_code` | text | - | Y | DERIVED/MANUAL |
| Operator Name | `operator_ref` | text | - | Y | MANUAL |
| Work Order No. | `work_order_no` | text | - | Y | DERIVED |
| Grade | `grade_code` | text | - | Y | DERIVED |
| Customer Name | `customer_name` | text | - | Y | DERIVED |
| Final Size OD/ID/TH/LEN | `final_od_mm`,`final_id_mm`,`final_th_mm`,`final_len_mm` | dec | mm | Y | MANUAL |
| From OD/TH/LEN | `from_od_mm`,`from_th_mm`,`from_len_mm` | dec | mm | Y | MANUAL |
| To OD/ID/TH/LEN | `to_od_mm`,`to_id_mm`,`to_th_mm`,`to_len_mm` | dec | mm | Y | MANUAL |
| Draw Plan Length | `draw_plan_len_mm` | dec | mm | N | DERIVED |
| Inter/Final | `pass_type` | enum | - | Y | MANUAL (INTER/FINAL) |
| Accepted Qty Nos/MT | `accepted_nos`,`accepted_mt` | dec | Nos/MT | Y | MANUAL/DERIVED |
| Rejected Qty Nos | `rejected_nos` | int | Nos | Y | MANUAL |
| Drawn Meter | `drawn_meter` | dec | m | Y | MANUAL |
| Break Down / Remarks | `breakdown_remarks` | text | - | N | MANUAL |
| (pass) | `draw_pass` | int | - | Y | MANUAL (1/2/3) |

Children: `txn.db_inspection` (1st-off/last-off dims + disposition, special-controls Table-A triggers), `master.db_tooling` + `txn.db_tool_issue` (DB-FT-03/08 die/plug history + issue slip). Bench capability Table-C (DB-10…250T) as `master.machine_spec` envelope; swage-end-length-by-tonnage master.

**Draw-specific rules:** multi-pass (1/2/3) re-enters Furnace/STP — carry `draw_pass` without duplicating journey rows; `to_od < from_od` (drawing reduces); accepted+rejected reconcile vs input; disposition OK/HOLD/REJECT (operator-decided, warning-only hold).

---

## 3. Export engine — faithful per-report reproduction

### 3.1 Mechanism
For every report: (1) store the plant file as a **blank template** `templates/<REPORT>.xlsx` (delete sample data rows, keep title block, headers, merges, widths, revision text, footer); (2) write a **layout map** `layouts/<REPORT>.v1.json` describing where each value goes; (3) the generic `TemplateInjector` copies the template, fills the title block and data rows, and streams the file. This is the existing DPR pattern generalised — no new rendering library.

### 3.2 Layout JSON schema
```jsonc
{
  "report": "DB-FT-01", "version": 1, "sheet": "DB 1-7-A51",
  "titleBlock": { "date": "F2", "shift": "F3" },          // cell <- header field
  "table": {
    "headerRows": [4,7],                                    // frozen header (kept from template)
    "dataStartRow": 5,                                      // first writable data row
    "rowBlock": 1,                                          // rows consumed per record
    "columns": {                                            // field -> column letter
      "bench_code":"A","operator_ref":"B","work_order_no":"C","grade_code":"D",
      "customer_name":"E","final_od_mm":"F","final_id_mm":"G","final_th_mm":"H","final_len_mm":"I",
      "from_od_mm":"J","from_th_mm":"K","from_len_mm":"L","to_od_mm":"M","to_id_mm":"N","to_th_mm":"O",
      "to_len_mm":"P","draw_plan_len_mm":"Q","pass_type":"R","accepted_nos":"S","accepted_mt":"T",
      "rejected_nos":"U","drawn_meter":"V","remarks":"W"
    },
    "repeatingGroups": { "by":"bench_code", "blockLabelCell":"A", "breakdownRow": true }
  },
  "footer": { "supervisor": "B41", "incharge": "S41" },
  "numberFormats": { "final_od_mm":"0.00", "accepted_mt":"0.000" }
}
```
Furnace ANN-FT-01 uses the same schema with columns `zone1_min…zone6_max`, `line_speed_m_hr`, `qty_nos/qty_mt`. STP-FT-01A carries two tables in one layout (`table` for production + `analysisTable` for the bath-analysis block with `bath_name/spec_value/obz_value` cells). Spec-range header labels stay in the template, never written by code.

### 3.3 The injector (generalise `DprTemplateInjector`)
```ts
// packages/server/src/export/render/TemplateInjector.ts
import ExcelJS from 'exceljs';
import type { ExportLayout } from './types';

export async function injectReport(
  templatePath: string, layout: ExportLayout,
  header: Record<string, unknown>, rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);           // copy of the exact plant format
  const ws = wb.getWorksheet(layout.sheet);

  for (const [field, cell] of Object.entries(layout.titleBlock ?? {}))
    ws.getCell(cell).value = fmt(header[field]);

  let r = layout.table.dataStartRow;
  const cols = layout.table.columns;
  let lastBlock: unknown;
  for (const row of rows) {
    if (layout.table.repeatingGroups?.by) {        // stacked "DRAW BENCH No." blocks
      const key = row[layout.table.repeatingGroups.by];
      if (key !== lastBlock) { ws.getCell(`${layout.table.repeatingGroups.blockLabelCell}${r}`).value = String(key); lastBlock = key; }
    }
    for (const [field, col] of Object.entries(cols)) {
      const cell = ws.getCell(`${col}${r}`);
      cell.value = fmt(row[field]);
      const nf = layout.numberFormats?.[field]; if (nf) cell.numFmt = nf;
    }
    r += layout.table.rowBlock ?? 1;
  }
  for (const [field, cell] of Object.entries(layout.footer ?? {}))
    ws.getCell(cell).value = fmt(header[field]);
  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}
const fmt = (v: unknown) => v == null ? '' : v as any;   // dates -> ISO+05:30 upstream in the mapper
```
(If the codebase already standardises on a different xlsx lib in `render/`, use that lib's copy-and-write API; the layout JSON and flow are unchanged.)

### 3.4 Report registry + endpoint + button
Each report is a `ReportDefinition` (code, process_id, template file, layout file, `processMapper` query, filename pattern, sheet name) registered in `registerDictionary.ts`. One endpoint serves all:

```
POST /m1/:process/export
  body: { report: "DB-FT-01", filters: { dateFrom, dateTo, shift, machineCode, operator, orderNo, status } }
  -> ExportJobService: validate filters -> processMapper(filters) -> injectReport(template, layout, header, rows)
     -> stream .xlsx; audit in export_job
```
Filenames follow the existing convention: `A59_<REPORT>_<machine>_<dateFrom>_<dateTo>.xlsx`. The **export button** on each process screen calls this with the report code; a process with several reports shows a small report picker (same `components/export` UI). Exported data reflects the active filters only.

### 3.5 Report → template → layout table

| Process | Report | Template | Layout | Source table(s) |
|---|---|---|---|---|
| Tube Mill | TM-FT-02 Daily Production | TM-FT-02.xlsx | TM-FT-02.v1.json | prod_tm_run + bundle |
| Tube Mill | TM-FT-03 Downtime | TM-FT-03.xlsx | … | stoppage_entry |
| Tube Mill | TM-FT-04 Mill Parameter | TM-FT-04.xlsx | … | prod_tm_param |
| Tube Mill | TM-FT-05 Setup | TM-FT-05.xlsx | … | tm_setup |
| Tube Mill | TM-FT-01 Slit Inspection | TM-FT-01.xlsx | … | tm_slit_inspection |
| Tube Mill | TM-FT-08 Work Coil | TM-FT-08.xlsx | … | tm_consumable_usage |
| Tube Mill | TM-12 Edge Milling | TM-FT-12.xlsx | … | prod_tm_edgemill |
| Furnace | ANN-FT-01 Furnace Prod | ANN-FT-01.xlsx | ANN-FT-01.v1.json | prod_ann_run (+gas) |
| STP | STP-FT-01A Prod+Process | STP-FT-01A.xlsx | STP-FT-01A.v1.json | prod_stp_lot + bath_reading + bath_analysis |
| STP | STP-FT-04 Bath History | STP-FT-04.xlsx | … | stp_bath_history |
| STP | STP-06 Coating | STP-FT-06.xlsx | … | stp_coating |
| Draw | DB-FT-01 Production | DB-FT-01.xlsx | DB-FT-01.v1.json | prod_db_lot |
| Draw | DB-FT-03 Die History | DB-FT-03.xlsx | … | db_tooling history |
| Draw | DB-FT-08 Die/Plug Issue | DB-FT-08.xlsx | … | db_tool_issue |

---

## 4. Validation engine (code)

Shared package so client and server run identical rules. Zod (`m1Forms`) still does shape/type/coercion; this engine adds plant business rules and produces field-addressed messages.

### 4.1 Types + engine
```ts
// packages/shared-validation/src/engine/types.ts
export type Severity = 'ERROR' | 'WARN';
export interface Issue { field: string; code: string; message: string; severity: Severity; }
export interface RuleCtx {                     // everything a rule may read
  value: unknown; row: Record<string, unknown>;
  siblings?: Array<Record<string, unknown>>;   // other child rows (bundles, baths, passes)
  master?: Record<string, unknown>;            // spec/tolerance from item/param chart/bath spec
}
export type Rule = (ctx: RuleCtx) => Issue | null;
export interface FieldRules { field: string; label: string; rules: Rule[]; }
export type ProcessRuleSet = FieldRules[];
```

```ts
// packages/shared-validation/src/engine/rules.ts  (rule factories)
import type { Rule } from './types';
const num = (v: unknown) => (v === '' || v == null ? NaN : Number(v));

export const required = (field: string, label = field): Rule => ({ value }) =>
  value === '' || value == null ? { field, code: 'REQUIRED', message: `${label} is required`, severity: 'ERROR' } : null;

export const range = (field: string, min: number, max: number, label = field, sev: 'ERROR'|'WARN' = 'ERROR'): Rule =>
  ({ value }) => { const n = num(value); return Number.isNaN(n) ? null
    : (n < min || n > max) ? { field, code: 'RANGE', message: `${label} ${n} out of ${min}–${max}`, severity: sev } : null; };

export const toleranceVsSpec = (field: string, specKey: string, tol: number, label = field): Rule =>
  ({ value, master }) => { const n = num(value), s = num(master?.[specKey]);
    if (Number.isNaN(n) || Number.isNaN(s)) return null;
    return Math.abs(n - s) > tol ? { field, code: 'TOL', message: `${label} ${n} beyond ±${tol} of spec ${s}`, severity: 'WARN' } : null; };

export const oneOf = (field: string, allowed: string[], label = field): Rule =>
  ({ value }) => value == null || value === '' || allowed.includes(String(value)) ? null
    : { field, code: 'ENUM', message: `${label} must be one of ${allowed.join(', ')}`, severity: 'ERROR' };

export const lessThan = (field: string, otherField: string, label = field): Rule =>
  ({ value, row }) => { const a = num(value), b = num(row[otherField]);
    return (!Number.isNaN(a) && !Number.isNaN(b) && a >= b)
      ? { field, code: 'CROSS', message: `${label} must be less than ${otherField}`, severity: 'ERROR' } : null; };

export const sumEquals = (field: string, parts: string[], tolPct = 1, label = field): Rule =>
  ({ value, row }) => { const total = num(value); const s = parts.reduce((a, p) => a + (num(row[p]) || 0), 0);
    if (Number.isNaN(total) || !total) return null;
    return Math.abs(total - s) / total * 100 > tolPct
      ? { field, code: 'RECONCILE', message: `${label} ${total} ≠ sum(${parts.join('+')})=${s}`, severity: 'WARN' } : null; };
```

```ts
// packages/shared-validation/src/engine/validate.ts
import type { ProcessRuleSet, Issue, RuleCtx } from './types';
export function validateRecord(
  ruleSet: ProcessRuleSet, row: Record<string, unknown>,
  opts: { siblings?: any[]; master?: Record<string, unknown> } = {},
): Issue[] {
  const issues: Issue[] = [];
  for (const fr of ruleSet) {
    const ctx: RuleCtx = { value: row[fr.field], row, siblings: opts.siblings, master: opts.master };
    for (const rule of fr.rules) { const i = rule(ctx); if (i) issues.push(i); }
  }
  return issues;
}
export const errorsOnly = (i: Issue[]) => i.filter(x => x.severity === 'ERROR');
```

### 4.2 Per-process rule sets (built from the formats/WIs)
```ts
// packages/shared-validation/src/engine/rulesets/furnace.ts
import { required, range, toleranceVsSpec, oneOf } from '../rules';
export const furnaceRules = [
  { field:'work_order_no', label:'Work Order', rules:[required('work_order_no','Work Order')] },
  { field:'qty_nos', label:'No. of Tubes', rules:[required('qty_nos','No. of Tubes'), range('qty_nos',1,100000,'No. of Tubes')] },
  { field:'heat_treatment', label:'Heat Treatment', rules:[oneOf('heat_treatment',['ANNEAL','NORMALIZE','SRA'])] },
  // six zones, each min/max present and plausible; soaking zone tol ±10 °C vs recipe
  ...['zone1','zone2','zone3','zone4','zone5','zone6'].flatMap(z => [
    { field:`${z}_min`, label:`${z} min`, rules:[range(`${z}_min`,0,1200,`${z} min`)] },
    { field:`${z}_max`, label:`${z} max`, rules:[range(`${z}_max`,0,1200,`${z} max`)] },
  ]),
  { field:'zone3_max', label:'Soaking max', rules:[toleranceVsSpec('zone3_max','soaking_spec_c',10,'Soaking temp')] },
  { field:'line_speed_m_hr', label:'Line speed', rules:[toleranceVsSpec('line_speed_m_hr','speed_spec_m_hr',2,'Line speed')] },
];

// rulesets/stp.ts  — bath spec ranges straight from STP-FT-01A headers
export const stpRules = [
  { field:'degrease_temp_c', label:'Degrease temp', rules:[range('degrease_temp_c',75,85,'Degrease temp')] },
  { field:'degrease_time_min', label:'Degrease time', rules:[range('degrease_time_min',10,15,'Degrease time')] },
  { field:'phos_temp_c', label:'Phosphate temp', rules:[range('phos_temp_c',65,75,'Phosphate temp')] },
  { field:'phos_time_min', label:'Phosphate time', rules:[range('phos_time_min',6,11,'Phosphate time')] },
  { field:'lube_temp_c', label:'Lube temp', rules:[range('lube_temp_c',70,75,'Lube temp')] },
  { field:'dryer_temp_c', label:'Dryer temp', rules:[range('dryer_temp_c',80,120,'Dryer temp')] },
  { field:'coating_gsm', label:'Coating weight', rules:[range('coating_gsm',4.0,8.0,'Coating weight','WARN')] },
  // bath analysis children validated against spec_value with toleranceVsSpec / range per bath
];

// rulesets/drawbench.ts
import { required, oneOf, lessThan, sumEquals } from '../rules';
export const drawRules = [
  { field:'work_order_no', rules:[required('work_order_no','Work Order')], label:'Work Order' },
  { field:'pass_type', label:'Inter/Final', rules:[oneOf('pass_type',['INTER','FINAL'])] },
  { field:'draw_pass', label:'Pass', rules:[oneOf('draw_pass',['1','2','3'])] },
  { field:'to_od_mm', label:'To OD', rules:[required('to_od_mm','To OD'), lessThan('to_od_mm','from_od_mm','To OD')] }, // drawing reduces
  { field:'rejected_nos', label:'Rejected', rules:[] },
  { field:'accepted_nos', label:'Accepted', rules:[sumEquals('input_nos',['accepted_nos','rejected_nos'],2,'Input')] },
];
// tube mill: power within TM-02 band (toleranceVsSpec vs power_kw_min/max), coolant ≥2% CEW/3% ERW, first-off gate.
```

### 4.3 Where it runs
- **Client (inline):** the capture form calls `validateRecord(ruleSet, draft, {siblings, master})` on change/blur; `ERROR` blocks submit and highlights the field, `WARN` shows a caution but allows submit (e.g. tolerance, hold). Reuse the existing toast/field-error components.
- **Server (authoritative):** `ProductionService.save<Proc>` runs Zod, then `validateRecord`; on any `ERROR` it returns 422 with the `Issue[]` (never persists partial/invalid). `WARN`s persist with a flag for review. Masters (spec/tolerance/param-chart/bath-spec) are loaded once per save and passed as `master`.
- **Cross-record:** children (bundles, bath readings, draw passes) validated as `siblings`; run/lot reconciliation (`sumEquals`) at submit.

---

## 5. Database (migration summary)

New per-process tables (Kysely/node-pg-migrate, `packages/server/migrations/modules/<proc>/`), all with `id, tenant_id, work_order_no, coil_no, shift_log_id, machine_code, data_source, status, created_*`:
`txn.prod_tm_run`(+`prod_tm_bundle`,`tm_setup`,`prod_tm_param`,`tm_slit_inspection`,`prod_tm_edgemill`); `txn.prod_ann_run`(+`prod_ann_gas`); `txn.prod_stp_lot`(+`stp_bath_reading`,`stp_bath_analysis`,`stp_bath_history`,`stp_coating`); `txn.prod_db_lot`(+`db_inspection`,`db_tool_issue`). Masters: `master.tm_param_chart`, `master.db_tooling`, bench-capability + swage tables (as `machine_spec`), `master.stp_bath_spec`, `master.stoppage_code`/`scrap_code`. Reuse `coil`, `planning.order_journey`, `security`, `audit`. Respect the Windows/UTF-16 caution.

---

## 6. API (extend existing conventions)

```
GET  /processes | /machines | /shifts                 (exist)
GET  /m1/:process/records         list + server-side filters
POST /m1/:process/records         create (Zod + validation engine)
PUT  /m1/:process/records/:id     update
POST /m1/:process/records/:id/submit | /approve | /hold
GET  /m1/:process/records/:id
POST /m1/:process/export          { report, filters } -> faithful .xlsx
```
`:process ∈ {tm, ann, stp, db}`. All tenant + RLS scoped; idempotent writes via `txn.idempotency_key`.

---

## 7. Build sequence, acceptance, testing

**Sequence:** (1) validation engine + rulesets (shared, unit-tested first — it gates every form). (2) DB migrations + Zod contracts. (3) `TemplateInjector` + one layout end-to-end (DB-FT-01) proving byte-faithful export. (4) Furnace (ANN-FT-01) — closest to ANN. (5) STP (two-table layout). (6) Draw Bench (multi-pass, per-bench blocks). (7) Tube Mill (reuse the existing spec). (8) wire the four export buttons + report picker. (9) roles/filters/audit (reuse). (10) E2E.

**Acceptance:** every report exports a file **visually identical to the controlled format** (title block, revision no., column order, merges, spec-range headers, footer) with data in the right cells; validation blocks out-of-range/missing ERROR fields and warns on tolerance/hold; filters scope the export; historical records queryable; roles enforced backend-side.

**Testing:** engine unit tests per rule and per ruleset (boundary values); a golden-file test per report (inject known rows → compare to a checked-in expected .xlsx cell map); API + RBAC tests; E2E capture→submit→approve→export per process.

---

## 8. Open items to confirm before freeze

- Templates: generate the 14 blank `.xlsx` templates from the plant files (strip sample rows; keep everything else) and check them in.
- Missing machine/shift check sheets (TM-09, DRAW-07, SLT-03, ANN-03, STP-02, HRPO-02) — add when shared.
- Stoppage/scrap/defect **code masters** (TM-FT-03 codes) — needed for downtime/reject validation enums (ERP OQ-09).
- STP bath spec values and draw tolerances that vary by grade/size → load as `master` so `toleranceVsSpec` has real spec keys.
- Furnace zone recipe per grade (soaking spec) → recipe master for the tolerance rule.

---

## Bottom line

Four processes, each with its own fields taken straight from its GLI formats; a per-report export button that fills the actual plant format template so the print is the controlled copy; and one shared, declarative validation engine (code above) enforced on both client and server. All of it rides the existing capture, export-template and RBAC machinery — Furnace on the ANN pattern, Draw Bench on the CTL pattern — so it lands as one M1 grown across the Tube Mill → Furnace → STP → Draw Bench route, not four separate modules.

*Grounded in the real plant formats (read cell-by-cell), the four field-dictionary workbooks, and `zedral_test-share-the-code`. Reuses `DprTemplateInjector`/layout-JSON for export fidelity and `m1Forms` Zod for shape; adds the validation engine and the per-report templates/layouts.*
