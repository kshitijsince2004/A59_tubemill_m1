# ZEDRAL — ERW Tube Mill (A-59) Operator · Implementation Plan

**Goodluck India Limited · Sikandrabad Unit 2 · A-59 ERW Tube Mill · Module M1 (Data Capture)**
**Audience:** developers / IDE agent. Read `ZEDRAL_TUBEMILL_M1_A59_ARCHITECTURE.md` first for platform + runtime context; this doc is the buildable detail — data model, contracts, API, services and phases. Marked **[dev-decision]** where a rule is reasonably the developer's call.

This plan is **self-sufficient**: DDL, Zod contracts, the field-by-field mapping, the state machine and the API are all here, keyed to real paths in the monorepo (`packages/…`). It reuses the existing platform (Kysely, `@zedral/platform` event bus, canonical model, Manifold connectors, node-pg-migrate, RLS) rather than forking it.

**Paper sources of truth (Goodluck A-59, tube mill only):** TM-01 Work Instruction R18; TM-02 Production Parameters R18 (size/grade → power window + tooling chart); TM-FT-02 Daily Production Report R3; TM-FT-03 Down Time Report R2; TM-FT-04 Mill Parameter Record R2; TM-FT-08 Work Coil History Card R0; GLI-FT-TM-11 Arc Welding Current Monitoring R0; GLI-FT-TM-12 Edge Milling Inspection R1.

---

## 0. Guiding principle — the capture unit is the RUN, not the coil

Every existing process captures one coil on one machine, scoped to a shift (the COIL_NO spine). The tube mill is a continuous line: strip from many coils is welded end to end into one ribbon, formed and seam-welded into tube, cut into pieces and banded into bundles; the joint tube is deliberately scrapped. So a coil number cannot be the backbone.

The capture unit is the **production run**: continuous production on one mill between a **setup** and the next setup / roll change / size change, producing one size + grade against one or more work orders, possibly spanning shifts. Two lists hang off it:

- **Consumed coils** (many → one run) — material in, for yield and traceability.
- **Produced bundles** (one run → many) — packing/dispatch, with a quality class per bundle.

Mirror the CTL bundle fan for output; add a coil-input fan for input. This is the only structural departure from the platform; everything else is reused.

---

## 1. Domain vocabulary (names to use in code)

| Term | Meaning | Cardinality |
| --- | --- | --- |
| **Mill** | One ERW tube mill. A-59 first; group has several (TM-01…04) differing by saw (cold/flying) and cutter dia. Capture per mill. | 1 line, N group |
| **Run** (`prod_tm_run`) | The capture unit. One mill, one setup, one size+grade, ≥1 work order; shift-independent. | 1 |
| **Setup** (`tm_setup`) | Changeover that sets size/grade/tooling and opens the first-off gate. Types `INITIAL` / `REGULAR`. | 1 per run |
| **Input coil** (`prod_tm_coil_input`) | Strip coil fed and spliced in. Material-in unit. | 1..N per run |
| **Splice** | Arc-weld joint between two coils; carries the ECT drill marker. | 0..N per run |
| **Bundle** (`prod_tm_bundle`) | Banded stack of cut tubes; packing/dispatch unit, tagged, with a quality class. | 1..N per run |
| **Piece/tube** | One cut tube; counted per bundle; run total is the sum. | many per bundle |
| **Quality class** | `PRIME` / `PQ2` (reason `JOINT`|`OTHER`) / `CQ` / `OPEN` / `SCRAP`. | enum |
| **Tooling instance** (`tm_consumable`) | Tracked consumable: work coil, impeder, cutter, roll set, fin blade; carries cumulative usage. | many |
| **Parameter sample** (`plc.sample`) | One time-stamped machine reading. | high-frequency |

**Identity keys:** run = `run_no` (mill + setup ts). Order/queue identity + dedup key = **work order + BC batch number**. Coil identity = coil tag. Keep distinct.

**Size is a shape, not a scalar (locked):** round OD *or* section (RHS/SHS, e.g. `40 X 25`) with an equivalent OD; thickness in mm and SWG. Represent as a `size` JSON: `{ profile:'ROUND'|'SECTION', odMm?, aMm?, bMm?, equivOdMm, thkMm, swg?, lengthMm }`, with a stable `sizeKey` string for joins to the param chart.

---

## 2. Where the code lives (module map)

New module `m1-tubemill`, sibling of `m1-collection`, reusing platform + shared-validation:

```
packages/shared-validation/src/rules/
  tubeMillForms.ts            NEW — tm* Zod schemas + inferred types (§4)
packages/server/
  migrations/modules/tubemill/  NEW — node-pg-migrate files (§3.9) + seeds/tm_param_chart.json
  src/modules/m1-tubemill/
    services/
      RunService.ts           open/close run, save entries, rollups, yield
      SetupService.ts         setup + tooling snapshot + first-off gate
      StateMachine.ts         mill state transitions + invariants (§7)
      ParamBandService.ts     live speed/power vs TM-02 band (§6)
      ConsumableUsageService.ts  cumulative tooling life + change-due alerts
      CollectorIngestService.ts  consume tm.* events → plc.sample, stoppage, count
    routes/tubeMillRoutes.ts  HTTP API (§8)
    consumers/tubeMillConsumers.ts  bus subscriptions
packages/connectors/src/plugins/plc-a59/   NEW — collector plugin (arch §4.2)
packages/server/src/export/
  layouts/tubemill_dpr.v1.json  NEW — DPR layout for the tube mill
  dpr/dprFieldCatalog.ts        extend with tube-mill fields
packages/client/…              NEW — TubeMillRunConsole screen + panels
packages/platform/src/canonical/eventContracts.ts  extend (arch §4.4)
```

---

## 3. Data model (DDL)

Conventions (unchanged): schemas `master` / `coil` / `txn` / `planning` / `security` / `audit`; snake_case with unit suffix; `tenant_id uuid` + RLS on every row; weight **MT** at rollup, **Kg** per coil/bundle operator-facing; one master per entity (FK, no free-text codes); `timestamptz`; follow the **Windows/UTF-16 caution** on `.ts` edits. New schema `plc`. Below is intent DDL; wrap each block in a node-pg-migrate `exports.up`/`down` (see §3.9).

### 3.1 `txn.prod_tm_run` — run header (capture unit)
```sql
CREATE TABLE txn.prod_tm_run (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  run_no         text NOT NULL,                 -- mill + setup ts, unique per tenant
  mill_code      text NOT NULL REFERENCES master.machine(machine_code),
  work_order_no  text,                          -- from BC (queue card)
  bc_batch_number text,                         -- dedup key
  customer_code  text REFERENCES master.customer(code),
  grade_code     text REFERENCES master.grade(code),
  size           jsonb NOT NULL,                -- the shape object (§1)
  size_key       text NOT NULL,                 -- FK-ish join to tm_param_chart
  source_tag     text NOT NULL DEFAULT 'PLAN',  -- PLAN | JOURNEY
  setup_id       uuid,                           -- FK set after setup row (§3.2)
  run_state      text NOT NULL DEFAULT 'SETUP',  -- §7 enum
  first_off_status text NOT NULL DEFAULT 'PENDING', -- PENDING|PASS|FAIL
  first_off_by   text, first_off_at timestamptz,
  shift_open_ref  text, shift_close_ref text,    -- may span shifts
  time_from      timestamptz, time_to timestamptz,
  gross_runtime_s integer, net_runtime_s integer,
  raw_material_mt numeric(12,3) DEFAULT 0,       -- Σ coil inputs
  total_prime_mt  numeric(12,3) DEFAULT 0,
  total_pq2_mt    numeric(12,3) DEFAULT 0,
  total_cq_mt     numeric(12,3) DEFAULT 0,
  total_open_mt   numeric(12,3) DEFAULT 0,
  total_scrap_mt  numeric(12,3) DEFAULT 0,
  yield_pct       numeric(6,3),                  -- accepted / raw
  status          text NOT NULL DEFAULT 'DRAFT', -- DRAFT|SUBMITTED|APPROVED|LOCKED
  crew_ref        uuid, remarks text,
  created_at timestamptz NOT NULL DEFAULT now(), created_by text
);
CREATE UNIQUE INDEX ux_prod_tm_run_no ON txn.prod_tm_run(tenant_id, run_no);
CREATE INDEX ix_prod_tm_run_mill_state ON txn.prod_tm_run(tenant_id, mill_code, run_state);
CREATE INDEX ix_prod_tm_run_wo ON txn.prod_tm_run(tenant_id, work_order_no);
-- + ALTER TABLE … ENABLE ROW LEVEL SECURITY; FORCE; tenant policy (match existing pattern)
```

### 3.2 `txn.tm_setup` — setup + first-off gate
```sql
CREATE TABLE txn.tm_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  setup_type text NOT NULL,                       -- INITIAL | REGULAR
  reason     text,                                -- NEW_PRODUCT|SIZE_CHANGE|SHIFT_CHANGE|POWER_FAILURE|BREAKDOWN|ROLL_CHANGE
  -- tooling snapshot (derived from tm_param_chart, operator-confirmed; override logged)
  id_tool text, od_tool text, boggie_size text, impeder_size text,
  ferrite_rod text, ss_rod text, work_coil_id text REFERENCES master.tm_consumable(code),
  fin_blade text, seam_guide text,
  -- weld setup (manual measured)
  v_length_mm numeric(6,2), v_gap_mm numeric(6,2),
  wc_to_wr_distance_mm numeric(6,1), weld_dia_mm numeric(6,2), argon_used boolean,
  -- gate
  first_off_result text,                          -- PASS | FAIL
  approved_by text, approved_at timestamptz,
  -- 4M change control
  is_4m_change boolean DEFAULT false,
  m4_category text,                               -- MAN|MATERIAL|MACHINE|METHOD
  validation_ref text, customer_approval boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tm_setup_run ON txn.tm_setup(tenant_id, run_id);
```

### 3.3 `txn.prod_tm_coil_input` — consumed coils (input fan)
```sql
CREATE TABLE txn.prod_tm_coil_input (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  coil_tag text NOT NULL,
  grade_code text REFERENCES master.grade(code),
  width_mm numeric(7,2), thk_mm numeric(6,3), swg text,
  source text,                                     -- strip source / RM ref
  input_weight_kg numeric(10,2),
  splice_seq integer,                              -- order fed into the ribbon
  joint_marker boolean DEFAULT false,              -- ECT drill-hole done
  arcweld_log_id uuid,                             -- FK → §3.7
  edgemill_id uuid,                                -- FK → §3.8
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tm_coil_input_run ON txn.prod_tm_coil_input(tenant_id, run_id);
```

### 3.4 `txn.prod_tm_bundle` — produced bundles (output fan)
```sql
CREATE TABLE txn.prod_tm_bundle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  bundle_no integer NOT NULL,
  tag_no text,
  pieces integer NOT NULL DEFAULT 0,
  length_mm numeric(9,1),
  weight_kg numeric(10,2),
  weight_source text NOT NULL DEFAULT 'DERIVED',   -- DERIVED (count×theoretical) | MEASURED
  quality_class text NOT NULL,                     -- PRIME|PQ2|CQ|OPEN|SCRAP
  pq2_reason text,                                 -- JOINT|OTHER (when PQ2)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_tm_bundle ON txn.prod_tm_bundle(tenant_id, run_id, bundle_no);
```
Run piece/weight/quality rollups derive from these rows, never typed. Theoretical weight = f(size, thk, length, grade density) — O-6.

### 3.5 `txn.prod_tm_param_snapshot` — hourly parameter record (replaces manual TM-FT-04)
```sql
CREATE TABLE txn.prod_tm_param_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  ts_hour timestamptz NOT NULL,
  line_speed_mpm numeric(7,2),        -- AUTO
  weld_power_kw  numeric(7,2),        -- AUTO
  weld_current_amp numeric(8,1),      -- AUTO if wired
  coolant_pressure_kg numeric(5,2),   -- AUTO if instrumented else MANUAL
  coolant_oil_pct numeric(4,1),       -- MANUAL
  wiper_change boolean,               -- MANUAL
  argon_used boolean,                 -- DERIVED from setup
  in_band boolean,                    -- DERIVED vs tm_param_chart
  remarks text, sign_ref text,
  source text NOT NULL DEFAULT 'AUTO' -- AUTO|MANUAL for the row's machine cols
);
CREATE UNIQUE INDEX ux_tm_param_snapshot ON txn.prod_tm_param_snapshot(tenant_id, run_id, ts_hour);
```

### 3.6 Stoppages — reuse `txn.stoppage_entry`, run/mill-scoped
Add `run_id uuid` + `mill_code text` (nullable, for tube mill) if not present; auto-created by the collector on line-stop (open, uncoded); operator sets `stoppage_code` (FK `master.stoppage_code`) + reason + `is_planned`. `time_lost` derives. Emits `DowntimeLoggedEvent`.

### 3.7 `txn.tm_arcweld_log` — arc-weld current (GLI-FT-TM-11, feature-flagged)
```sql
CREATE TABLE txn.tm_arcweld_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  coil_input_id uuid REFERENCES txn.prod_tm_coil_input(id) ON DELETE CASCADE,
  current_amp numeric(8,1),           -- AUTO if wired else MANUAL
  thk_mm numeric(6,3), grade_code text, operator_ref text, remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.8 `txn.prod_tm_edgemill` — edge milling inspection (GLI-FT-TM-12, LDP)
```sql
CREATE TABLE txn.prod_tm_edgemill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  coil_input_id uuid REFERENCES txn.prod_tm_coil_input(id),
  od text, thk_mm numeric(6,3), grade_code text,
  width_before_mm numeric(7,2), width_after_mm numeric(7,2),
  edge_condition text, operator_ref text, remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.9 Schema `plc` — machine time-series
```sql
CREATE SCHEMA IF NOT EXISTS plc;
CREATE TABLE plc.tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL,
  controller text,                    -- which of the 17
  signal text NOT NULL,               -- LINE_SPEED|WELD_POWER|WELD_CURRENT|RUN_STATE|CUT_COUNT|COOLANT_PRESSURE|…
  unit text, subnet text, driver text -- OPCUA|MODBUS|WINCC_CSV
);
CREATE TABLE plc.sample (
  tag_id uuid NOT NULL REFERENCES plc.tag(id),
  ts timestamptz NOT NULL,
  value double precision
) PARTITION BY RANGE (ts);             -- daily partitions; retention per O-7
CREATE INDEX ix_plc_sample_tag_ts ON plc.sample(tag_id, ts);
CREATE TABLE plc.collector_health (
  mill_code text, tag_id uuid, last_sample_at timestamptz,
  backlog integer, heartbeat_at timestamptz
);
```

### 3.10 Master data
```sql
-- TM-02 recipe: autofill source + validation band
CREATE TABLE master.tm_param_chart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  size_key text NOT NULL,             -- matches prod_tm_run.size_key
  thk_mm numeric(6,3) NOT NULL, grade_code text NOT NULL,
  power_kw_min numeric(7,2), power_kw_max numeric(7,2),
  speed_min_mpm numeric(7,2), speed_max_mpm numeric(7,2),
  id_tool text, od_tool text, boggie text, impeder text,
  ferrite_rod text, ss_rod text, work_coil_id text,
  fin_pass_dims jsonb, seam_guide text, weld_dia_mm numeric(6,2), v_length_norm text,
  effective_from date, version integer NOT NULL DEFAULT 1, is_active boolean DEFAULT true
);
CREATE INDEX ix_tm_param_chart_key ON master.tm_param_chart(tenant_id, size_key, thk_mm, grade_code, is_active);

-- mills + envelope (reuse master.machine / machine_spec pattern; add tube-mill columns)
ALTER TABLE master.machine ADD COLUMN IF NOT EXISTS saw_type text;       -- COLD|FLYING
ALTER TABLE master.machine ADD COLUMN IF NOT EXISTS cutter_dia_min numeric(6,1);
ALTER TABLE master.machine ADD COLUMN IF NOT EXISTS cutter_dia_max numeric(6,1);
-- machine_spec envelope rows: od/section range, thk range, speed, length band

-- consumables / tooling life (replaces work-coil history card)
CREATE TABLE master.tm_consumable (
  code text PRIMARY KEY, tenant_id uuid NOT NULL,
  kind text NOT NULL,                 -- WORK_COIL|CUTTER|ROLL_SET|IMPEDER|FIN_BLADE
  spec jsonb, replace_threshold_mt numeric(12,3), replace_threshold_uses integer, status text
);
CREATE TABLE txn.tm_consumable_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  consumable_code text NOT NULL REFERENCES master.tm_consumable(code),
  run_id uuid REFERENCES txn.prod_tm_run(id),
  cumulative_tonnage_mt numeric(12,3), cumulative_uses integer,
  visual_inspection text, action text, at timestamptz NOT NULL DEFAULT now()
);

-- codes
CREATE TABLE master.stoppage_code (   -- from TM-FT-03 list (O-1)
  code text PRIMARY KEY, tenant_id uuid NOT NULL, label text,
  category text,                      -- OPN|ELECT|MECH|UTILITY|POWER|PLANNED|OTHER
  is_planned boolean DEFAULT false
);
-- master.defect_code, master.grade (with density for weight), master.customer, master.shift, master.operator: existing patterns
```

**Migration files to add** (numeric-timestamp, JS, under `packages/server/migrations/modules/tubemill/`): `..._tm_schema.js` (all txn.prod_tm_* + tm_setup + stoppage cols), `..._plc_schema.js`, `..._tm_master.js` (param_chart, machine cols, consumable, codes), `..._tm_seeds.js` (loads `seeds/tm_param_chart.json`, grades, A-59 machine, stoppage codes). Each with a real `down()`.

### 3.11 `seeds/tm_param_chart.json` (shape, from TM-02 R18)
```json
[
  { "sizeKey":"OD25.4", "thkMm":2.6, "gradeCode":"1010", "powerKwMin":90, "powerKwMax":115,
    "idTool":"R-7/8", "odTool":"R-15/18", "boggie":"16", "impeder":"16 X 18",
    "ferriteRod":"3X200", "ssRod":"10", "workCoilId":"36", "weldDiaMm":25.20 },
  { "sizeKey":"OD25.4", "thkMm":3.0, "gradeCode":"1010", "powerKwMin":95, "powerKwMax":125, "…":"…" },
  { "sizeKey":"SEC40X25(41.28)", "thkMm":1.5, "gradeCode":"1010", "powerKwMin":25, "powerKwMax":60, "…":"…" }
]
```
The seed loader parses TM-02 rows (round + section) into this shape; `sizeKey` is the canonical join key. **[dev-decision]** section-notation parser + SWG↔mm table (O-5).

---

## 4. Validation contracts — `packages/shared-validation/src/rules/tubeMillForms.ts`

Zod, same helpers as `m1Forms.ts` (`requiredString`, `optionalPositiveNumber`, `timeString`, …). The run is the capture unit, so it does **not** extend `baseProcessEntrySchema` (which requires `coilNo`); coil inputs are children.

```ts
export const tmRunSchema = z.object({
  id: z.string().optional(), tenantId: z.string().uuid().optional(),
  runNo: requiredString, millCode: requiredString,
  workOrderNo: optionalString, bcBatchNumber: optionalString,
  customerCode: optionalString, gradeCode: optionalString,
  size: z.object({ profile: z.enum(['ROUND','SECTION']), odMm: optionalPositiveNumber,
    aMm: optionalPositiveNumber, bMm: optionalPositiveNumber, equivOdMm: optionalPositiveNumber,
    thkMm: optionalPositiveNumber, swg: optionalString, lengthMm: optionalPositiveNumber }),
  sizeKey: requiredString, sourceTag: z.enum(['PLAN','JOURNEY']).default('PLAN'),
  runState: z.enum(['IDLE','SETUP','FIRST_OFF_PENDING','RUNNING','STOPPAGE','ROLL_CHANGE','RUN_COMPLETE']).default('SETUP'),
  firstOffStatus: z.enum(['PENDING','PASS','FAIL']).default('PENDING'),
  remarks: optionalString,
});
export const tmSetupSchema = z.object({ runId: requiredString,
  setupType: z.enum(['INITIAL','REGULAR']),
  reason: z.enum(['NEW_PRODUCT','SIZE_CHANGE','SHIFT_CHANGE','POWER_FAILURE','BREAKDOWN','ROLL_CHANGE']).optional(),
  idTool: optionalString, odTool: optionalString, boggieSize: optionalString, impederSize: optionalString,
  ferriteRod: optionalString, ssRod: optionalString, workCoilId: optionalString,
  vLengthMm: optionalPositiveNumber, vGapMm: optionalPositiveNumber,
  wcToWrDistanceMm: optionalPositiveNumber, weldDiaMm: optionalPositiveNumber, argonUsed: z.boolean().optional(),
  is4mChange: z.boolean().optional(), m4Category: z.enum(['MAN','MATERIAL','MACHINE','METHOD']).optional(),
});
export const tmCoilInputSchema = z.object({ runId: requiredString, coilTag: requiredString,
  gradeCode: optionalString, widthMm: optionalPositiveNumber, thkMm: optionalPositiveNumber, swg: optionalString,
  inputWeightKg: optionalPositiveNumber, spliceSeq: z.coerce.number().int().optional(), jointMarker: z.boolean().optional() });
export const tmBundleSchema = z.object({ runId: requiredString, bundleNo: z.coerce.number().int().positive(),
  pieces: z.coerce.number().int().nonnegative(), lengthMm: optionalPositiveNumber, weightKg: optionalPositiveNumber,
  weightSource: z.enum(['DERIVED','MEASURED']).default('DERIVED'),
  qualityClass: z.enum(['PRIME','PQ2','CQ','OPEN','SCRAP']), pq2Reason: z.enum(['JOINT','OTHER']).optional() });
export const tmParamSnapshotSchema = z.object({ runId: requiredString, tsHour: z.string().datetime(),
  lineSpeedMpm: optionalPositiveNumber, weldPowerKw: optionalPositiveNumber, weldCurrentAmp: optionalPositiveNumber,
  coolantPressureKg: optionalPositiveNumber, coolantOilPct: optionalPositiveNumber, wiperChange: z.boolean().optional() });
export const tmEdgeMillSchema = z.object({ runId: optionalString, coilInputId: optionalString, od: optionalString,
  thkMm: optionalPositiveNumber, gradeCode: optionalString, widthBeforeMm: optionalPositiveNumber,
  widthAfterMm: optionalPositiveNumber, edgeCondition: optionalString });
export const tmArcWeldSchema = z.object({ coilInputId: requiredString, currentAmp: optionalPositiveNumber,
  thkMm: optionalPositiveNumber, gradeCode: optionalString });

export type M1TubeMillRunForm = z.infer<typeof tmRunSchema>;
export type M1TmSetupForm = z.infer<typeof tmSetupSchema>;
export type M1TmCoilInputForm = z.infer<typeof tmCoilInputSchema>;
export type M1TmBundleForm = z.infer<typeof tmBundleSchema>;
export type M1TmParamSnapshotForm = z.infer<typeof tmParamSnapshotSchema>;
export type M1TmEdgeMillForm = z.infer<typeof tmEdgeMillSchema>;
export type M1TmArcWeldForm = z.infer<typeof tmArcWeldSchema>;
```

---

## 5. The six-form field map (AUTO / DERIVED / MANUAL → target column)

**AUTO** = collector/PLC. **DERIVED** = from work order or TM-02 chart (system-filled, operator confirms). **MANUAL** = operator measures/judges.

**TM-FT-02 Daily Production Report** → `prod_tm_run` + `prod_tm_bundle`
| Field | Class | Target |
|---|---|---|
| Work order, customer, grade, size, length | DERIVED | run header (from BC) |
| Tube count (pieces) | AUTO | Σ `prod_tm_bundle.pieces` (from `PIECE_CUT`) |
| Weight per bundle | DERIVED | `bundle.weight_kg` (count×theoretical) unless MEASURED |
| Prime/PQ2/CQ/Open split | MANUAL | `bundle.quality_class` |
| Scrap (setup + joint) | AUTO+MANUAL | scrap bundles; setup pieces auto-scrapped |
| Totals + cumulative | AUTO | run rollups |
| Yield | AUTO | `run.yield_pct` |

**TM-FT-03 Down Time Report** → `stoppage_entry`
| Field | Class | Target |
|---|---|---|
| Start/stop/running time, time lost | AUTO | collector timestamps |
| Reason + code | MANUAL | `stoppage_code`, reason |
| Remark | MANUAL | remark |

**TM-FT-04 Mill Parameter Record** → `prod_tm_param_snapshot` (hourly, generated)
| Field | Class | Target |
|---|---|---|
| Line speed, weld power, weld current | AUTO | snapshot |
| Size, thickness, grade | DERIVED | run header |
| All tooling (ID/OD tool, boggie, impeder, work coil, etc.) | DERIVED | `tm_setup` (from TM-02), confirmed |
| Expected power window | DERIVED | `tm_param_chart` (band check) |
| Coolant pressure | AUTO/MANUAL | snapshot |
| Coolant oil %, argon, wiper change | MANUAL | snapshot |

**TM-FT-08 Work Coil History Card** → `tm_consumable` + `tm_consumable_usage`
| Field | Class | Target |
|---|---|---|
| Work coil in use | DERIVED | setup |
| Tonnage rolled, cumulative | AUTO | usage counter |
| Visual inspection, action | MANUAL | usage row |

**GLI-FT-TM-11 Arc Weld Current** → `tm_arcweld_log`
| Field | Class | Target |
|---|---|---|
| Current (amp) at splice | AUTO/MANUAL | `current_amp` |
| Thickness, grade | DERIVED | from coil/run |
| Operator, remark | MANUAL | — |

**GLI-FT-TM-12 Edge Milling** → `prod_tm_edgemill`
| Field | Class | Target |
|---|---|---|
| Size, thickness, grade | DERIVED | run/coil |
| Width before/after | MANUAL | measured |
| Edge condition | MANUAL | judged |

---

## 6. Autofill resolution + band check

**Hierarchy (highest available wins):** Work order (BC) ▸ `tm_param_chart` ▸ collector (PLC) ▸ running-setup carry-forward ▸ manual.

```
resolveRunDefaults(workOrder):
  header ← { customer, grade, size, length, qty } from workOrder
  chart  ← tm_param_chart WHERE size_key, thk, grade AND is_active
  tooling ← chart.tooling            // pre-filled, operator confirms/overrides (override logged)
  band    ← { chart.power_kw_min..max, chart.speed_min..max }
  return { header, tooling, band }

onPowerSample(sample, run):
  inBand ← run.band.power_kw_min ≤ sample.powerKw ≤ run.band.power_kw_max
  if not inBand: raise Exception(OUT_OF_BAND) ; flag pieces in the window for review
  persist plc.sample ; hourly rollup → prod_tm_param_snapshot(in_band)
```
`ParamBandService.ts` owns the band check; `RunService.ts` owns autofill + rollups.

---

## 7. Mill state machine (`StateMachine.ts`)

States: `IDLE, SETUP, FIRST_OFF_PENDING, RUNNING, STOPPAGE, ROLL_CHANGE, RUN_COMPLETE`.

| From | Event | To | Guard / effect |
|---|---|---|---|
| IDLE | `RUN_OPENED` | SETUP | create run+setup, autofill tooling+band |
| SETUP | `TOOLING_CONFIRMED` | FIRST_OFF_PENDING | snapshot tooling |
| FIRST_OFF_PENDING | `FIRST_OFF_RESULT=PASS` | RUNNING | require SIC/QA; pieces now count as good |
| FIRST_OFF_PENDING | `FIRST_OFF_RESULT=FAIL` | FIRST_OFF_PENDING | stay; **all pieces book SCRAP** |
| RUNNING | `LINE_STOPPED` | STOPPAGE | open uncoded stoppage (collector) |
| STOPPAGE | `LINE_STARTED` | RUNNING | close stoppage; `time_lost` derived |
| RUNNING | `ROLL_CHANGE` | ROLL_CHANGE | tool/roll change |
| RUNNING/ROLL_CHANGE | `RUN_CLOSED` | RUN_COMPLETE→IDLE | close run; size/grade change ⇒ new SETUP |
| any | `SHIFT_BOUNDARY` | (unchanged) | carry open run + running stoppage to next shift log |

**Invariants:** production counted in `SETUP`/`FIRST_OFF_PENDING` ⇒ SCRAP; `RUNNING` requires `first_off_status=PASS`; a size/grade change forces a new `SETUP` (new run); `STOPPAGE` is entered/left automatically on collector line signals. Shift handover reuses `services/handover` — fix H-1 (`carryForward.ts` must target real `txn.prod_tm_*`, not `_entry`) and add the tube-mill process to its map.

---

## 8. API surface — `routes/tubeMillRoutes.ts`

All tenant-scoped, RLS-enforced, idempotent writes use `txn.idempotency_key` (existing pattern).

| Method · Path | Purpose |
|---|---|
| `GET /tubemill/queue?mill=A-59` | mill-scoped queue (Pending/Preparing/In Progress/Hold/Completed); one card = one run |
| `POST /tubemill/runs` | open a run from a queue card; returns run + autofilled tooling + band |
| `POST /tubemill/runs/:id/setup` | save setup + tooling confirmation |
| `POST /tubemill/runs/:id/first-off` | SIC/QA pass/fail (gate) |
| `POST /tubemill/runs/:id/coils` | append a consumed coil (splice) |
| `POST /tubemill/runs/:id/bundles` | append/close a bundle |
| `GET /tubemill/runs/:id/live` | live speed/power/count/state + band status (from server, not PLC) |
| `POST /tubemill/stoppages/:id/code` | code an open stoppage |
| `POST /tubemill/runs/:id/param-manual` | manual columns of the hourly snapshot |
| `POST /tubemill/runs/:id/submit` · `/approve` · `/lock` | lifecycle |
| `GET /tubemill/runs/:id/export` | DPR / shift summary for the run |
| `POST /internal/tubemill/ingest` (bus, not HTTP) | `CollectorIngestService` consumes `tm.*` events |

---

## 9. Integration

- **Dynamics 365 Business Central (ERP, system of record):** work orders, RM coil master, customer/grade, dispatch — via `platform/src/writeback/WritebackClient.ts` over OData. **Plan read first**, actuals write-back later (confirm round-trip with client IT). Canonical store stays on-prem Postgres.
- **Welder SCADA / line PLC:** through the collector plugin (arch §4.2). Confirm tag list + protocol per controller (O-2).
- **Manifold:** the WinCC CSV/OPC exports ingest through the connector framework into canonical, converging with the live collector on one model.
- **Interim export:** `layouts/tubemill_dpr.v1.json` + `dprFieldCatalog` entries; Shift Summary export until write-back + downstream modules are live.

---

## 10. RBAC / RLS / security

Roles: OPERATOR (own mill) · SHIFT IN-CHARGE/SUPERVISOR (review/approve/first-off, multi-mill) · PLANT HEAD (read-only) · ADMIN (masters, machine + param-chart CRUD, integration). Row-level mill scoping via `security.line_access`. Before go-live: run as `m1_app` (H-2); constant-time service-token compare, no header-trusted tenant (M-1); PINs scrypt + `timingSafeEqual`. Collector reach into OT is read-only and one-directional.

---

## 11. Services & client components (build targets)

- **Server:** `RunService`, `SetupService`, `StateMachine`, `ParamBandService`, `ConsumableUsageService`, `CollectorIngestService`, `tubeMillRoutes`, `tubeMillConsumers` (paths in §2).
- **Collector:** `connectors/src/plugins/plc-a59/` (driver + tag mapping + store-and-forward).
- **Client (`packages/client`):** `TubeMillRunConsole` screen with panels — live machine strip, run/tooling (with confirm ticks), operator-entry, coil-input fan, bundle fan, stoppage coding, first-off gate, exception banner. Reuse the assignment board + `MachineAllocationModal` + crew/stoppage/defect sub-forms; add machine CRUD for the mills and CRUD for `tm_param_chart`.
- **Canonical:** extend `eventContracts.ts` (arch §4.4) + `eventSchemas.ts`.

---

## 12. Build order (demo-reachable early)

1. **Master + model + contracts:** migrations §3, `tm_param_chart` seed, `tubeMillForms.ts`.
2. **Operator run console (mocked machine values):** setup + TM-02 autofill, first-off gate, coil fan, bundle fan, manual param columns, stoppage coding, defects/hold. **← demo point.**
3. **Collector (real tags):** speed/power/run-stop/cut-count for A-59; hourly rollup; auto stoppage + count; band exceptions. Replace mocks.
4. **Consumables + reconciliation + export:** tooling-life counters + change-due alerts; yield mass-balance; DPR / Shift Summary.
5. **ERP + write-back + hardening:** BC OData plan pull then actuals write-back; `m1_app`; audit fixes H-1/H-2/M-1.

---

## 13. Acceptance criteria / test checklist

- **Contracts:** `tubeMillForms` unit + property tests (Zod), mirroring `shared-validation/tests`.
- **State machine:** cannot leave `FIRST_OFF_PENDING` without PASS; pieces before PASS are SCRAP; size/grade change forces new run; stoppage opens/closes on collector signals only.
- **Autofill/band:** given (size,thk,grade) the tooling + band load from `tm_param_chart`; a power sample outside the band raises exactly one OUT_OF_BAND exception and flags the window's pieces.
- **Rollups:** run piece/weight/quality/yield derive only from child rows; mass-balance warn when `raw − (accepted+scrap)` exceeds tolerance.
- **Handover:** an open run + running stoppage carry to the next shift log (regression on H-1).
- **Idempotency:** duplicate collector events (same `countId`/timestamp) do not double-count (reuse `txn.idempotency_key` + dedup vectors).
- **RLS:** a second tenant cannot read A-59 rows when app runs as `m1_app`.
- **Integration:** architecture tests confirm modules read canonical/events, never write `txn.prod_tm_*` directly.

---

## 14. Open questions / gaps (needed before freezing schema)

- **O-1 Stoppage code master** — obtain Goodluck's TM-FT-03 reason-code list; map to the loss taxonomy.
- **O-2 PLC tag reality** — per A-59 controller, which signals exist (speed, power, current, run/stop, cut-count, coolant pressure, any inline OD/wall gauge) and protocol. Decides AUTO vs MANUAL.
- **O-3 Missing referenced formats** — GLI-FT-TM-05 (setup/coolant + first-off data), GLI-FT-PRD-TM-09 (machine check sheet), GLI-FT-TM-07 (min tool stock), route card (release to next operation), quality/control plan.
- **O-4 Quality-class rules** — exact PRIME/PQ2(Joint|Other)/CQ/OPEN definitions and which are auto-suggestible.
- **O-5 Size/section coverage** — full active size list (round + sections) and the SWG↔mm table for the TM-02 seed.
- **O-6 Theoretical weight formula** — exact per-tube weight (round vs section) so derived bundle weight matches their books.
- **O-7 Time-series retention** — `plc.sample` frequency, partitioning, retention (raw vs rolled).
- **O-8 Upstream lineage scope** — slit-coil → tube genealogy in phase 1, or coil-tag logging only.

---

*Prepared for the Zedral engineering IDE. Reuses existing platform contracts by name; where a name is cited (`machine_spec`, `order_journey`, `stoppage_entry`, `carryForward`, DPR/export, event bus, connector framework) the intent is to generalise, not fork.*
