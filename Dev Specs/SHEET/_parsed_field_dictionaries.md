# Zedral A59 M1 — Complete Field Dictionaries

Parsed from `Dev Specs/SHEET` data-mapping workbooks. **Field Register** is the source of truth for DB/forms planning.

## Colour coding (capture Class column fills)

Observed across workbooks from cell fills on the Class column:

| Class | Typical fill | Meaning (from Cover & Legend) |
| --- | --- | --- |
| SYSTEM | `#EADCF2` lavender | System-generated id / timestamp |
| DERIVED | `#D6E3F0` light blue | From ERP/WO, recipe chart, or computed |
| AUTO | `#E2EFDA` / green-tint (when set) | PLC / SCADA / collector |
| MANUAL | `#FFF2CC` / amber-tint (when set) | Operator / tablet entry |
| AUTO/MANUAL | mixed | Prefer AUTO; fall back to MANUAL |
| MASTER / MASTER/MANUAL | — | Master chart lookup (+ optional confirm) |

---

# TubeMill

**File:** `Zedral_A59_TubeMill_M1_Data_Mapping.xlsx`
**Sheets (10):** `Cover & Legend`, `Sheet Map`, `Field Register`, `ERP-WO Fields`, `PLC Tag Map`, `TM-02 Param Window`, `TM-02 Tooling & Fin`, `Codes & Enums`, `Data Flow`, `Required Documents`
**Field Register count:** **122**

## Capture class counts

- **DERIVED**: 53 _(fill: FFD6E3F0)_
- **MANUAL**: 44 _(fill: FFFCE7C9)_
- **AUTO**: 20 _(fill: FFD6EAD6)_
- **AUTO/MANUAL**: 3 _(fill: FFD6EAD6)_
- **SYSTEM**: 2 _(fill: FFEADCF2)_

## Target tables / child entities

- `txn.prod_tm_run` — **24** fields: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07, RUN-08, RUN-09, RUN-10, RUN-11, PRC-04, PRC-05, PRC-06, PRD-01, PRD-02, PRD-04, PRD-05, PRD-14, PRD-15, PRD-16, PRD-17, PRD-18, PRD-20
- `txn.prod_tm_coil_input` — **16** fields: COIL-01, COIL-02, COIL-03, COIL-04, COIL-05, COIL-06, COIL-07, PRD-03, SLI-01, SLI-02, SLI-03, SLI-04, SLI-05, SLI-06, SLI-07, SLI-08
- `txn.tm_setup` — **33** fields: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08, SET-09, SET-10, SET-11, SET-12, SET-13, SET-14, SET-15, SET-16, SET-17, SET-18, SET-19, SET-20, SET-21, SET-22, SET-23, SET-24, SET-25, SET-26, PRC-09, PRC-10, PRC-11, PRC-12, PRC-13, PRC-14, PRC-15
- `txn.prod_tm_param_snapshot` — **11** fields: PRC-01, PRC-02, PRC-03, PRC-07, PRC-08, PRC-16, PRC-17, PRC-18, PRC-19, PRC-20, PRC-21
- `plc.sample` — **4** fields: PRC-22, PRC-23, PRC-24, PRD-21
- `txn.prod_tm_bundle` — **8** fields: PRD-06, PRD-07, PRD-08, PRD-09, PRD-10, PRD-11, PRD-12, PRD-13
- `(reporting)` — **1** fields: PRD-19
- `txn.stoppage_entry` — **8** fields: DWN-01, DWN-02, DWN-03, DWN-04, DWN-05, DWN-06, DWN-07, DWN-08
- `txn.tm_online_inspection` — **14** fields: INS-01, INS-02, INS-03, INS-04, INS-05, INS-06, INS-07, INS-08, INS-09, INS-10, INS-11, INS-12, INS-13, INS-14
- `txn.tm_consumable_usage` — **3** fields: TL-01, TL-02, TL-03

## Sheet / form groups

- **Run header** — 11: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07, RUN-08, RUN-09, RUN-10, RUN-11
- **Run/coil feed** — 7: COIL-01, COIL-02, COIL-03, COIL-04, COIL-05, COIL-06, COIL-07
- **1 Setup approval** — 26: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08, SET-09, SET-10, SET-11, SET-12, SET-13, SET-14, SET-15, SET-16, SET-17, SET-18, SET-19, SET-20, SET-21, SET-22, SET-23, SET-24, SET-25, SET-26
- **2 Online process** — 24: PRC-01, PRC-02, PRC-03, PRC-04, PRC-05, PRC-06, PRC-07, PRC-08, PRC-09, PRC-10, PRC-11, PRC-12, PRC-13, PRC-14, PRC-15, PRC-16, PRC-17, PRC-18, PRC-19, PRC-20, PRC-21, PRC-22, PRC-23, PRC-24
- **3 Production** — 21: PRD-01, PRD-02, PRD-03, PRD-04, PRD-05, PRD-06, PRD-07, PRD-08, PRD-09, PRD-10, PRD-11, PRD-12, PRD-13, PRD-14, PRD-15, PRD-16, PRD-17, PRD-18, PRD-19, PRD-20, PRD-21
- **4 Downtime** — 8: DWN-01, DWN-02, DWN-03, DWN-04, DWN-05, DWN-06, DWN-07, DWN-08
- **5 Online inspection** — 14: INS-01, INS-02, INS-03, INS-04, INS-05, INS-06, INS-07, INS-08, INS-09, INS-10, INS-11, INS-12, INS-13, INS-14
- **6 Slit inspection** — 8: SLI-01, SLI-02, SLI-03, SLI-04, SLI-05, SLI-06, SLI-07, SLI-08
- **Tooling life (TM-FT-08)** — 3: TL-01, TL-02, TL-03

## Cover & Legend

- **ZEDRAL  .  A-59 ERW TUBE MILL  .  M1 DATA MAPPING**
- **Goodluck India Limited . Sikandrabad Unit 2 . Tube mill only . v1.0 (organised around the plant's 5 shop-floor sheets)**
- **Purpose**: Single source of truth for M1 data capture on the A-59 tube mill: every field on the plant's shop-floor sheets mapped to its digital field, capture class, source and target table.
- **The 5 sheets**: Setup approval report (+1 gate), Online process report, Production report, Downtime report, Online inspection report. Tabs follow this framing.
- **Capture unit**: The production RUN (one mill, one setup, one size and grade, one or more work orders). Coils fan in, bundles fan out. Not the coil.
- **Architecture**: PLC-first: a server-side collector reads the welder and line controls; the tablet confirms, enters manual values and clears exceptions. The sheets become views over one event stream.
- **Key finding**: The welder (AB MicroLogix 1400 + Thermatool Weld-Manager) already exports 1-second data. Speed and power for the online process report are AUTO from that one controller today.
- **Update 20 Sep 2026**: Formats folder received. TM-FT-05 (setup) and GLI-FT-QA-04 (online inspection) are now in hand, plus GLI-FT-PRD-TM-01 slit inspection. Sheets 1 and 5 flipped from referenced to in-hand; a 6th sheet (incoming slit inspection) added.
- **LEGEND . capture class**
- **AUTO**: Machine reports it (PLC / welder SCADA / saw counter). No typing.
- **DERIVED**: Pre-filled from the work order (ERP) or the TM-02 chart. Operator confirms.
- **MANUAL**: Operator measures or judges it.
- **MASTER**: One-time reference / master data.
- **SYSTEM**: Generated by the platform (ids, rollups, timestamps).
- **Tabs**: Sheet Map | Field Register | ERP-WO Fields | PLC Tag Map | TM-02 Param Window | TM-02 Tooling & Fin | Codes & Enums | Data Flow | Required Documents
- **Source docs**: TM-01 WI R18; TM-02 R18; TM-FT-02 R3; TM-FT-03 R2; TM-FT-04 R2; TM-FT-08 R0; GLI-FT-TM-11 R0; GLI-FT-TM-12 R1; A-59 PLC survey; welder SCADA exports (06 Sep 2026).
- **House note**: All controlled copies under GLI-SOP-MR-01. Machine access for M1 is read-only, one direction.
- **Field counts**
- **AUTO**: =COUNTIF('Field Register'!$H$4:$H$125,"*AUTO*")
- **DERIVED**: =COUNTIF('Field Register'!$H$4:$H$125,"*DERIVED*")
- **MANUAL**: =COUNTIF('Field Register'!$H$4:$H$125,"*MANUAL*")
- **SYSTEM**: =COUNTIF('Field Register'!$H$4:$H$125,"*SYSTEM*")
- **Total fields**: =COUNTA('Field Register'!$A$4:$A$125)

## Sheet Map

| Plant sheet (your name) | Format / doc no. | Rev | In hand? | Nature | Digital target table(s) | Capture summary |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Setup approval report | GLI-FT-PRD-TM-05 Mill Setup Parameter Sheet | R1 | Yes (now in hand) | Per-run gate (setup + first-off) | txn.tm_setup | Fin-pass rolls + first-off dims specified vs observed; tooling DERIVED; weld setup MANUAL; first-off gate MANUAL |
| 2. Online process report | GLI-FT-PRD-TM-04 Mill Parameter Record | R2 | Yes | Hourly, running | txn.prod_tm_param_snapshot (+ tm_setup) | Speed + power AUTO (welder); tooling DERIVED; coolant/wiper/argon MANUAL |
| 3. Production report | GLI-FT-PRD-TM-02 Daily Production Report | R3 | Yes | Per work order | txn.prod_tm_run + txn.prod_tm_bundle | Piece count AUTO (COC); quality class MANUAL; weight DERIVED; totals + yield AUTO |
| 4. Downtime report | GLI-FT-PRD-TM-03 Down Time Report | R2 | Yes | Per stoppage | txn.stoppage_entry | Times AUTO (collector); reason + code MANUAL |
| 5. Online inspection report | GLI-FT-QA-04 Online Quality Inspection Report at Tube Mill | R4 | Yes (now in hand) | Running, QA (dims / weld / UT-ECT / surface) | txn.tm_online_inspection | Dimensions/weld/surface MANUAL; UT/ECT AUTO if tapped |
| 6. Slit inspection (incoming) | GLI-FT-PRD-TM-01 Daily Slit Inspection Report | R3 | Yes (now in hand) | Per slit at mill entry | txn.prod_tm_coil_input | Strip width + thickness start/mid/end MANUAL; hardness MANUAL |
| Work Instruction | TM-01 (GLI-WI-PRD-TM-01) | R18 | Yes | Process logic (setup, first-off, 4M, weld flow) | txn.tm_setup | Drives the gate + tooling logic |
| Production parameters (master) | TM-02 (GLI-WI-PRD51-TM-02) | R18 | Yes | Size/grade -> power window + tooling | master.tm_param_chart | Reference master (see TM-02 tabs) |
| Work coil history card | TM-FT-08 | R0 | Yes | Tooling life | master.tm_consumable + txn.tm_consumable_usage | Tonnage AUTO; inspection MANUAL |
| Arc welding current | GLI-FT-TM-11 | R0 | Referenced | Strip-joint arc weld current | txn.tm_arcweld_log | AUTO if wired else MANUAL; feature-flagged |
| Edge milling inspection (LDP) | GLI-FT-TM-12 | R1 | Yes | Strip edge width before/after | txn.prod_tm_edgemill | Widths + condition MANUAL |

## COMPLETE Field Register

| Field ID | Sheet | Paper field | Canonical field (DB) | Target schema.table | Type | Unit | Class | Source | Req | Validation / rule | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RUN-01 | Run header | Run number | run_no | txn.prod_tm_run | text | - | SYSTEM | mill + setup ts | Y | unique per tenant | capture-unit id |
| RUN-02 | Run header | Tube Mill No | mill_code | txn.prod_tm_run | text | - | DERIVED | assignment / context | Y | FK master.machine | A-59 first |
| RUN-03 | Run header | W.O. No | work_order_no | txn.prod_tm_run | text | - | DERIVED | work order (BC) | Y | dedup w/ batch | queue card = 1 run |
| RUN-04 | Run header | Batch number | bc_batch_number | txn.prod_tm_run | text | - | DERIVED | work order (BC) | N | dedup key | plan/journey merge |
| RUN-05 | Run header | Customer | customer_code | txn.prod_tm_run | text | - | DERIVED | work order (BC) | N | FK master.customer |  |
| RUN-06 | Run header | RM Grade / Source | grade_code | txn.prod_tm_run | text | - | DERIVED | work order / coil | Y | FK master.grade | also on coil input |
| RUN-07 | Run header | Size (OD / Section) | size (jsonb) | txn.prod_tm_run | json | mm | DERIVED | work order / TM-02 | Y | round or section | section -> equiv OD |
| RUN-08 | Run header | Thickness | size.thkMm / swg | txn.prod_tm_run | number | mm | DERIVED | work order | Y | >0 | mm + SWG |
| RUN-09 | Run header | Length | size.lengthMm | txn.prod_tm_run | number | mm | DERIVED | work order | N | >0 |  |
| RUN-10 | Run header | Shift | shift_open_ref | txn.prod_tm_run | text | - | DERIVED | shift context | Y | FK master.shift | run may span shifts |
| RUN-11 | Run header | Date | prod_date | txn.prod_tm_run | date | - | DERIVED | shift | Y | - |  |
| COIL-01 | Run/coil feed | Coil tag / slit no | coil_tag | txn.prod_tm_coil_input | text | - | MANUAL | operator scan | Y | - | input fan |
| COIL-02 | Run/coil feed | Coil width | width_mm | txn.prod_tm_coil_input | number | mm | DERIVED | coil master | N | >0 |  |
| COIL-03 | Run/coil feed | Coil thickness | thk_mm / swg | txn.prod_tm_coil_input | number | mm | DERIVED | coil master | N | >0 |  |
| COIL-04 | Run/coil feed | Grade / source | grade_code / source | txn.prod_tm_coil_input | text | - | DERIVED | coil master | Y | FK master.grade |  |
| COIL-05 | Run/coil feed | Input weight | input_weight_kg | txn.prod_tm_coil_input | number | Kg | DERIVED | coil master | Y | >0 | sum = raw_material_mt |
| COIL-06 | Run/coil feed | Splice sequence | splice_seq | txn.prod_tm_coil_input | int | - | SYSTEM | order fed | N | - |  |
| COIL-07 | Run/coil feed | Joint drill marker | joint_marker | txn.prod_tm_coil_input | bool | - | MANUAL | welder | N | - | ECT joint-tube scrap |
| SET-01 | 1 Setup approval | Setup type | setup_type | txn.tm_setup | enum | - | MANUAL | operator | Y | INITIAL\|REGULAR |  |
| SET-02 | 1 Setup approval | Reason | reason | txn.tm_setup | enum | - | MANUAL | operator | N | NEW_PRODUCT\|SIZE_CHANGE\|SHIFT_CHANGE\|POWER_FAILURE\|BREAKDOWN\|ROLL_CHANGE |  |
| SET-03 | 1 Setup approval | ID Tool size | id_tool | txn.tm_setup | text | - | DERIVED | TM-02 chart | Y | confirm/override logged | from tooling chart |
| SET-04 | 1 Setup approval | OD Tool size | od_tool | txn.tm_setup | text | - | DERIVED | TM-02 chart | Y | confirm/override logged |  |
| SET-05 | 1 Setup approval | Boggie size | boggie_size | txn.tm_setup | text | - | DERIVED | TM-02 chart | Y | - |  |
| SET-06 | 1 Setup approval | Impeder size | impeder_size | txn.tm_setup | text | - | DERIVED | TM-02 chart | Y | - |  |
| SET-07 | 1 Setup approval | Ferrite rod | ferrite_rod | txn.tm_setup | text | - | DERIVED | TM-02 chart | N | - |  |
| SET-08 | 1 Setup approval | SS rod | ss_rod | txn.tm_setup | text | - | DERIVED | TM-02 chart | N | - |  |
| SET-09 | 1 Setup approval | Work coil ID | work_coil_id | txn.tm_setup | text | - | DERIVED | TM-02 + consumable | Y | FK master.tm_consumable | links tooling life |
| SET-10 | 1 Setup approval | Fin blade / seam guide | fin_blade / seam_guide | txn.tm_setup | text | - | DERIVED | TM-02 fin table | N | - |  |
| SET-11 | 1 Setup approval | Weld dia | weld_dia_mm | txn.tm_setup | number | mm | DERIVED | TM-02 norm + measured | N | per fin-pass table | welder VEE data assists |
| SET-12 | 1 Setup approval | Distance WC to WR | wc_to_wr_distance_mm | txn.tm_setup | number | mm | MANUAL | operator | Y | 70-160 mm (WI) | V length/angle |
| SET-13 | 1 Setup approval | V length | v_length_mm | txn.tm_setup | number | mm | MANUAL | operator | N | per WI annexure | welder exports VEE LENGTH (AUTO xcheck) |
| SET-14 | 1 Setup approval | V gap | v_gap_mm | txn.tm_setup | number | mm | MANUAL | operator | N | per norm |  |
| SET-15 | 1 Setup approval | Bead / weld-flow check | weld_flow_ok | txn.tm_setup | text | - | MANUAL | operator/QA | Y | reference sample compare | weld flow each new setup |
| SET-16 | 1 Setup approval | Use of argon | argon_used | txn.tm_setup | bool | - | DERIVED | grade | N | special grades ST-52, SPL-K3, 1536/1541, Corten |  |
| SET-17 | 1 Setup approval | ECT calibration (1.5mm hole) | ect_calibrated | txn.tm_setup | bool | - | MANUAL | QA | Y | auto-sort + red paint working |  |
| SET-18 | 1 Setup approval | First-off result | first_off_result | txn.tm_setup | enum | - | MANUAL | SIC / QA | Y | PASS\|FAIL | GATE: RUNNING needs PASS |
| SET-19 | 1 Setup approval | First-off approver | approved_by | txn.tm_setup | text | - | MANUAL | SIC / QA | Y | L3 setup, SIC/QA approve |  |
| SET-20 | 1 Setup approval | 4M change | is_4m_change / m4_category | txn.tm_setup | enum | - | MANUAL | operator/SIC | N | MAN\|MATERIAL\|MACHINE\|METHOD | validation + customer approval + tag stamp |
| SET-21 | 1 Setup approval | Fin-pass rolls 13/15/17/19/20 (spec vs obs) | fin_pass_dims | txn.tm_setup | json | mm | DERIVED | TM-02 fin table | Y | tol -0.20/+0.70 | observed recorded on TM-05 |
| SET-22 | 1 Setup approval | Weld roll dia (21) | weld_roll_dia_mm | txn.tm_setup | number | mm | DERIVED | TM-02 | N | tol -0.20/+0.50 |  |
| SET-23 | 1 Setup approval | Coolant concentration | coolant_conc_pct | txn.tm_setup | number | % | MANUAL | operator | Y | 2.0% min CEW, 3% min ERW | on TM-05 |
| SET-24 | 1 Setup approval | First-off dims (OD/THK/Len/Fin ht) | first_off_dims | txn.tm_setup | json | mm | MANUAL | QA | Y | per WO | TM-05 first-off block |
| SET-25 | 1 Setup approval | First-off form (Ovality/Straightness/Flattening/Drifting) | first_off_form | txn.tm_setup | json | - | MANUAL | QA | Y | flattening 2t min; drifting 12.5% min | on TM-05 |
| SET-26 | 1 Setup approval | Weld flow / surface / V angle | weld_flow_surface_vangle | txn.tm_setup | text | - | MANUAL | QA | Y | weld flow each new setup | on TM-05 |
| PRC-01 | 2 Online process | Date | prod_date | txn.prod_tm_param_snapshot | date | - | DERIVED | shift | Y | - |  |
| PRC-02 | 2 Online process | Shift | shift_ref | txn.prod_tm_param_snapshot | text | - | DERIVED | shift | Y | FK master.shift |  |
| PRC-03 | 2 Online process | Time (hourly + each restart) | ts_hour | txn.prod_tm_param_snapshot | ts | - | AUTO | server rollup | Y | hourly + restart |  |
| PRC-04 | 2 Online process | OD | size.equivOdMm | txn.prod_tm_run | number | mm | DERIVED | run (welder xcheck) | Y | - | welder reports OD |
| PRC-05 | 2 Online process | THK | size.thkMm | txn.prod_tm_run | number | mm | DERIVED | run (welder xcheck) | Y | - | welder reports WALL |
| PRC-06 | 2 Online process | Mat grade | grade_code | txn.prod_tm_run | text | - | DERIVED | run | Y | - |  |
| PRC-07 | 2 Online process | Speed (MPM) | line_speed_mpm | txn.prod_tm_param_snapshot | number | mpm | AUTO | welder SPEED mpm | Y | in TM-02 speed band | confirmed streaming |
| PRC-08 | 2 Online process | Power (KW) | weld_power_kw | txn.prod_tm_param_snapshot | number | kW | AUTO | welder POWER kW | Y | in TM-02 power band | band check; confirmed |
| PRC-09 | 2 Online process | ID tool size | id_tool | txn.tm_setup | text | - | DERIVED | setup (TM-02) | Y | - |  |
| PRC-10 | 2 Online process | OD tool size | od_tool | txn.tm_setup | text | - | DERIVED | setup (TM-02) | Y | - |  |
| PRC-11 | 2 Online process | Work coil ID | work_coil_id | txn.tm_setup | text | - | DERIVED | setup | Y | - |  |
| PRC-12 | 2 Online process | Impeder size | impeder_size | txn.tm_setup | text | - | DERIVED | setup (TM-02) | Y | - |  |
| PRC-13 | 2 Online process | Boggie size | boggie_size | txn.tm_setup | text | - | DERIVED | setup (TM-02) | N | - |  |
| PRC-14 | 2 Online process | Weld dia | weld_dia_mm | txn.tm_setup | number | mm | DERIVED | setup | N | - |  |
| PRC-15 | 2 Online process | Distance WC to WR | wc_to_wr_distance_mm | txn.tm_setup | number | mm | MANUAL | setup carry | N | 70-160 mm |  |
| PRC-16 | 2 Online process | Oil % in coolant (min 3.0) | coolant_oil_pct | txn.prod_tm_param_snapshot | number | % | MANUAL | operator titration | Y | ERW >=3.0% special (WI) |  |
| PRC-17 | 2 Online process | Coolant pressure (min) | coolant_pressure_kg | txn.prod_tm_param_snapshot | number | kg/mm2 | AUTO/MANUAL | utility PLC if wired | Y | >=2.0 (WI) | no wired sensor found -> likely MANUAL |
| PRC-18 | 2 Online process | Use of argon Y/N | argon_used | txn.prod_tm_param_snapshot | bool | - | DERIVED | setup / operator | N | - |  |
| PRC-19 | 2 Online process | Wiper change / clean | wiper_change | txn.prod_tm_param_snapshot | bool | - | MANUAL | operator | N | - |  |
| PRC-20 | 2 Online process | Remarks | remarks | txn.prod_tm_param_snapshot | text | - | MANUAL | operator | N | - |  |
| PRC-21 | 2 Online process | Sign | sign_ref | txn.prod_tm_param_snapshot | text | - | MANUAL | operator | N | - |  |
| PRC-22 | 2 Online process | Frequency (kHz) [bonus] | weld_frequency_khz | plc.sample | number | kHz | AUTO | welder | N | - | telemetry beyond paper sheet |
| PRC-23 | 2 Online process | Current % / Voltage % [bonus] | weld_current_pct / voltage_pct | plc.sample | number | % | AUTO | welder | N | - | telemetry beyond paper sheet |
| PRC-24 | 2 Online process | KW monitor status/stored/offset [bonus] | kw_band_* | plc.sample | mixed | - | AUTO | welder | N | reconcile vs TM-02 | welder's own KW band |
| PRD-01 | 3 Production | W.O. No | work_order_no | txn.prod_tm_run | text | - | DERIVED | work order | Y | - |  |
| PRD-02 | 3 Production | Size (OD/THK/Length) | size | txn.prod_tm_run | json | mm | DERIVED | work order | Y | - |  |
| PRD-03 | 3 Production | Slit No | source / coil ref | txn.prod_tm_coil_input | text | - | DERIVED | journey / plan | N | - |  |
| PRD-04 | 3 Production | Customer | customer_code | txn.prod_tm_run | text | - | DERIVED | work order | N | - |  |
| PRD-05 | 3 Production | RM Grade / Source | grade_code | txn.prod_tm_run | text | - | DERIVED | work order / coil | Y | - |  |
| PRD-06 | 3 Production | Prime - No | pieces (class=PRIME) | txn.prod_tm_bundle | int | pcs | AUTO | COC saw count | Y | >=0 | class set by operator |
| PRD-07 | 3 Production | Prime - Wt | weight_kg (PRIME) | txn.prod_tm_bundle | number | Kg | DERIVED | count x theoretical wt | Y | >=0 | MEASURED if weighed |
| PRD-08 | 3 Production | PQ2 - No (Joint/Other) | pieces + pq2_reason | txn.prod_tm_bundle | int | pcs | MANUAL | operator class | N | reason JOINT\|OTHER |  |
| PRD-09 | 3 Production | PQ2 - Wt | weight_kg (PQ2) | txn.prod_tm_bundle | number | Kg | DERIVED | count x theoretical | N | >=0 |  |
| PRD-10 | 3 Production | CQ - No | pieces (class=CQ) | txn.prod_tm_bundle | int | pcs | MANUAL | operator class | N | >=0 |  |
| PRD-11 | 3 Production | CQ - Wt | weight_kg (CQ) | txn.prod_tm_bundle | number | Kg | DERIVED | count x theoretical | N | >=0 |  |
| PRD-12 | 3 Production | Open - No | pieces (class=OPEN) | txn.prod_tm_bundle | int | pcs | MANUAL | operator class | N | >=0 |  |
| PRD-13 | 3 Production | Open - Wt | weight_kg (OPEN) | txn.prod_tm_bundle | number | Kg | DERIVED | count x theoretical | N | >=0 |  |
| PRD-14 | 3 Production | Total - No | sum pieces | txn.prod_tm_run | int | pcs | AUTO | rollup | Y | - |  |
| PRD-15 | 3 Production | Total - Wt | sum weight | txn.prod_tm_run | number | MT | AUTO | rollup | Y | - |  |
| PRD-16 | 3 Production | Total Raw Mat | raw_material_mt | txn.prod_tm_run | number | MT | AUTO | sum coil inputs | Y | - | yield denominator |
| PRD-17 | 3 Production | Total Scrap (setup+joint) | total_scrap_mt | txn.prod_tm_run | number | MT | AUTO/MANUAL | setup pieces auto-scrap | Y | - |  |
| PRD-18 | 3 Production | Totals Prime/PQ2/CQ/Open | total_*_mt | txn.prod_tm_run | number | MT | AUTO | rollup | Y | - |  |
| PRD-19 | 3 Production | Cumulative (MTD) | MTD rollup | (reporting) | number | MT | AUTO | running total | Y | - |  |
| PRD-20 | 3 Production | Yield | yield_pct | txn.prod_tm_run | number | % | AUTO | accepted / raw | Y | 0-100 | mass-balance warn |
| PRD-21 | 3 Production | Hourly production/energy [bonus] | prod_ton / energy_kwh / cost_inr | plc.sample | number | ton,kWh,INR | AUTO | welder hourly export | N | - | energy KPI + tonnage xcheck |
| DWN-01 | 4 Downtime | Starting time | start_ts | txn.stoppage_entry | ts | - | AUTO | collector (line stop) | Y | - | welder MESSAGE interim signal |
| DWN-02 | 4 Downtime | Stopping time | stop_ts | txn.stoppage_entry | ts | - | AUTO | collector (line start) | Y | - |  |
| DWN-03 | 4 Downtime | Running time | running_min | txn.stoppage_entry | number | min | AUTO | derived | Y | - |  |
| DWN-04 | 4 Downtime | Reasons | reason | txn.stoppage_entry | text | - | MANUAL | operator | Y | - |  |
| DWN-05 | 4 Downtime | Time lost | time_lost | txn.stoppage_entry | number | min | AUTO | stop - start | Y | - |  |
| DWN-06 | 4 Downtime | Code No | stoppage_code | txn.stoppage_entry | text | - | MANUAL | operator | Y | FK master.stoppage_code | O-1: code list needed |
| DWN-07 | 4 Downtime | Remark | remark | txn.stoppage_entry | text | - | MANUAL | operator | N | - |  |
| DWN-08 | 4 Downtime | S.T. Total | st_total_min | txn.stoppage_entry | number | min | AUTO | sum time lost | Y | - |  |
| INS-01 | 5 Online inspection | Lot No / Coil No(s) | lot_no / coil_no | txn.tm_online_inspection | text | - | DERIVED | run / coil feed | Y | - | GLI-FT-QA-04 identification |
| INS-02 | 5 Online inspection | OD / WD & HT | od_meas_mm | txn.tm_online_inspection | number | mm | MANUAL | QA | Y | per WO tolerance | welder OD is reference |
| INS-03 | 5 Online inspection | Thickness (Min / Max) | thk_min_max_mm | txn.tm_online_inspection | number | mm | MANUAL | QA | Y | per WO tolerance | micrometer 0-225 bands |
| INS-04 | 5 Online inspection | Length | len_meas_mm | txn.tm_online_inspection | number | mm | MANUAL | QA | Y | per WO |  |
| INS-05 | 5 Online inspection | FC / NFC | fin_cut_class | txn.tm_online_inspection | enum | - | MANUAL | QA | Y | FC\|NFC | fin-cut / no-fin-cut |
| INS-06 | 5 Online inspection | ID finish height | id_finish_ht_mm | txn.tm_online_inspection | number | mm | MANUAL | QA | N | - | inside weld upset |
| INS-07 | 5 Online inspection | Straightness | straightness | txn.tm_online_inspection | number | mm | MANUAL | QA | N | - | weld test |
| INS-08 | 5 Online inspection | Drift % | drift_pct | txn.tm_online_inspection | number | % | MANUAL | QA | N | 0t/t/2t/3t |  |
| INS-09 | 5 Online inspection | Flattening 0 / 90 | flatten_0_90 | txn.tm_online_inspection | text | - | MANUAL | QA | N | 2t min | weld test |
| INS-10 | 5 Online inspection | UT / ECT (U/E) | ut_ect_result | txn.tm_online_inspection | enum | - | AUTO/MANUAL | ECT if tapped | Y | 0t/t/2t/3t; red-paint reject | AUTO if ECT signal wired |
| INS-11 | 5 Online inspection | Surface defect (scratch/tool/roll mark/pick up) | surface_defect | txn.tm_online_inspection | text | - | MANUAL | operator/QA | Y | - |  |
| INS-12 | 5 Online inspection | Gauge check (OK / Not OK) | gauge_result | txn.tm_online_inspection | enum | - | MANUAL | QA | N | ball/pin/vernier/mandrel/plug/snap | micrometer 0-225 |
| INS-13 | 5 Online inspection | Class split (Prime/PQ2/CQ/Open/Joints) | qa_class | txn.tm_online_inspection | enum | - | MANUAL | QA | Y | - | QA-04 disposition block |
| INS-14 | 5 Online inspection | Customer / WO / final size-grade | work_order_no / final_size | txn.tm_online_inspection | text | - | DERIVED | work order | Y | - |  |
| SLI-01 | 6 Slit inspection | W.O. Number | work_order_no | txn.prod_tm_coil_input | text | - | DERIVED | work order | Y | - | GLI-FT-PRD-TM-01 |
| SLI-02 | 6 Slit inspection | Slit No | coil_tag / slit_no | txn.prod_tm_coil_input | text | - | MANUAL | operator | Y | - |  |
| SLI-03 | 6 Slit inspection | Weight | input_weight_kg | txn.prod_tm_coil_input | number | MT | DERIVED | coil master | N | >0 |  |
| SLI-04 | 6 Slit inspection | Hardness (coil) HRB | hardness_hrb | txn.prod_tm_coil_input | number | HRB | MANUAL | operator / lab | N | - |  |
| SLI-05 | 6 Slit inspection | Grade & source | grade_code / source | txn.prod_tm_coil_input | text | - | DERIVED | coil master | Y | FK master.grade |  |
| SLI-06 | 6 Slit inspection | Strip width (Start/Mid/End) | width_sme_mm | txn.prod_tm_coil_input | number | mm | MANUAL | operator | Y | per WO tol | 3 readings |
| SLI-07 | 6 Slit inspection | Thickness (Start/Mid/End) | thk_sme_mm | txn.prod_tm_coil_input | number | mm | MANUAL | operator | Y | per WO tol | 3 readings |
| SLI-08 | 6 Slit inspection | Rejection + reasons | rejection_reason | txn.prod_tm_coil_input | text | - | MANUAL | operator | N | - |  |
| TL-01 | Tooling life (TM-FT-08) | Work coil in use | work_coil_id | txn.tm_consumable_usage | text | - | DERIVED | setup | Y | FK master.tm_consumable |  |
| TL-02 | Tooling life (TM-FT-08) | Tonnage rolled / cumulative | cumulative_tonnage_mt | txn.tm_consumable_usage | number | MT | AUTO | usage counter | Y | vs threshold -> change-due |  |
| TL-03 | Tooling life (TM-FT-08) | Visual inspection / action | visual_inspection / action | txn.tm_consumable_usage | text | - | MANUAL | operator | N | - |  |

## ERP / WO Fields

| ERP / WO field | Canonical field | Target table | Read now (plan) | Write back (later) | Notes |
| --- | --- | --- | --- | --- | --- |
| Work order number | work_order_no | txn.prod_tm_run | Yes | - | queue card = one run; dedup with batch |
| Batch number | bc_batch_number | txn.prod_tm_run | Yes | - | dedup / merge key |
| Customer | customer_code | txn.prod_tm_run | Yes | - | FK master.customer |
| RM grade / source | grade_code | txn.prod_tm_run | Yes | - | FK master.grade |
| Size (OD or section) | size (jsonb) | txn.prod_tm_run | Yes | - | round OD or section -> equiv OD |
| Thickness / SWG | size.thkMm / swg | txn.prod_tm_run | Yes | - |  |
| Length | size.lengthMm | txn.prod_tm_run | Yes | - |  |
| Planned quantity | planned_qty | txn.prod_tm_run | Yes | - | for yield / completion |
| RM coil master (tag) | coil_tag | txn.prod_tm_coil_input | Yes | - | material-in identity |
| RM coil width / thk / grade | width_mm / thk_mm / grade | txn.prod_tm_coil_input | Yes | - |  |
| RM coil weight | input_weight_kg | txn.prod_tm_coil_input | Yes | - | sum = raw_material_mt |
| Route / next operation | route_ref | (genealogy) | Yes | - | release to next process |
| Produced quantity (actuals) | total_*_mt / pieces | txn.prod_tm_run | - | Yes | write-back phase |
| Yield / scrap (actuals) | yield_pct / total_scrap_mt | txn.prod_tm_run | - | Yes | write-back phase |
| Dispatch / bundle tags | bundle tag_no | txn.prod_tm_bundle | - | Yes | packing/dispatch phase |

## Codes & Enums

| Group | Code / value | Meaning / notes |
| --- | --- | --- |
| Quality class | PRIME | first quality |
| Quality class | PQ2 (JOINT \| OTHER) | prime second; sub-reason joint or other |
| Quality class | CQ | commercial quality |
| Quality class | OPEN | open weld |
| Quality class | SCRAP | setup, joint, crop, trim |
| Grade | 1006 / 1010 / 1020 / 1026 | carbon steel |
| Grade | ST-52 / SPL-K3 / 1536 / 1541 / Corten | special -> argon at weld |
| Grade | BSK-46 / GR-50 / GR2 / E250 / E034 | other order grades |
| Stoppage category | OPN / ELECT / MECH / UTILITY / POWER / PLANNED / OTHER | map TM-FT-03 codes to these (O-1) |
| Setup type | INITIAL \| REGULAR |  |
| Setup reason | NEW_PRODUCT \| SIZE_CHANGE \| SHIFT_CHANGE \| POWER_FAILURE \| BREAKDOWN \| ROLL_CHANGE |  |
| 4M category | MAN \| MATERIAL \| MACHINE \| METHOD |  |
| Run state | IDLE \| SETUP \| FIRST_OFF_PENDING \| RUNNING \| STOPPAGE \| ROLL_CHANGE \| RUN_COMPLETE | mill state machine |
| Weight source | DERIVED \| MEASURED | derived = count x theoretical |
| Record status | DRAFT \| SUBMITTED \| APPROVED \| LOCKED | capture lifecycle |
| Consumable kind | WORK_COIL \| CUTTER \| ROLL_SET \| IMPEDER \| FIN_BLADE | tooling life |
| Mill / saw | A-59 [survey] \| TM-01 cold 325-400 \| TM-02 flying 550-700 \| TM-03 flying 550-700 \| TM-04 cold 425-500 | cutter dia mm |
| Weld-line width | ERW 0.05-0.30 mm \| CEW 0.05 mm max | magnification 8X-25X by thickness (TM-01) |

## Data Flow

| Step | Source | To | What moves |
| --- | --- | --- | --- |
| 1 Plan | Dynamics 365 BC (ERP) | Server (run header) | WO, batch, customer, grade, size, thk, length, qty, RM coil master |
| 2 Recipe | TM-02 master chart | Server (setup autofill) | tooling set + power/speed band for size+thk+grade; operator confirms on tablet |
| 3 Machine | Welder (AB EtherNet/IP) + COC (Beckhoff OPC UA) | Collector -> Server | 1s speed/power/current/vee/message; per-cut count + length |
| 4 Compute | Collector / Server | plc.sample + rollups | hourly param snapshot; run/stop -> stoppage; cut -> piece count; band exception |
| 5 Confirm | Server (live API) | Tablet (monitor + exception) | confirm tooling, first-off PASS/FAIL, quality class, code stoppages, enter coolant/wiper, inspection |
| 6 Assemble | Server rollups | The 5 sheets (views) | setup approval, online process, production, downtime, online inspection assemble themselves |
| 7 Write-back (later) | Server | Dynamics 365 BC | produced qty, yield, scrap, dispatch tags |
| Invariant | - | - | Only the collector touches PLCs. The tablet reads the server API, never a PLC. Everything keys on work order + batch number. |

## Required Documents

| Ref | Document / item needed | Why it matters | Status / owner |
| --- | --- | --- | --- |
| D-1 | GLI-FT-PRD-TM-05 Mill Setup Parameter Sheet | Sheet 1 setup gate | RESOLVED - received (R1) |
| D-2 | GLI-FT-QA-04 Online Quality Inspection Report | Sheet 5 dims / weld / UT-ECT / surface | RESOLVED - received (R4) |
| D-2b | Overarching Quality / Control Plan (acceptance master) | Ties QA-04/QA-03/QA-06A frequencies + acceptance | Pending - Goodluck QA |
| D-3 | TM-FT-03 stoppage reason-CODE master list (O-1) | Code downtime; map to OEE taxonomy | Pending - Goodluck |
| D-4 | A-59 PLC tag / address map per controller (O-2) | Welder tag list, COC TwinCAT variables, Twido registers; decides AUTO vs MANUAL | Pending - tag survey |
| D-5 | GLI-FT-PRD-TM-09 machine check sheet (start of shift) | Setup / shift-start checks | Pending - Goodluck |
| D-6 | GLI-FT-TM-07 minimum tool stock | Tooling min-stock alerts | Pending - Goodluck |
| D-7 | Route card + tag colour scheme | Release to next operation, genealogy | Partial (GLI-WI-QA-13) |
| D-8 | GLI-FT-TM-11 Arc Weld Current format (R0 provisional) | If arc-weld current log retained | Referenced |
| D-9 | Theoretical tube-weight formula (O-6) | Derived bundle weight must match their books | Pending - Goodluck |
| D-10 | Full size/section list + SWG to mm table (O-5) | TM-02 seed + size model | Partly from TM-02 R18 |
| D-11 | WinCC / SCADA access (10am email path, SQL read login, tag export) | Interim CSV ingest + welder history | Pending - Electrical Head |
| D-12 | Welder controller confirmation (AB MicroLogix 1400 + Thermatool) | Confirm data interface to tap | Confirm on site |

## Extra / supporting sheets

### PLC Tag Map (14 rows)

| Signal | Canonical column | Target table | Unit | Controller | Model | Comms | Read protocol / driver | Ease | Status / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WELD_POWER | weld_power_kw | prod_tm_param_snapshot | kW | HF Welder (Thermatool Weld-Manager) | AB MicroLogix 1400 | Ethernet | EtherNet/IP (pylogix / KEPServerEX) | Easy | CONFIRMED streaming (POWER kW in LOG/PROCESS export) |
| LINE_SPEED | line_speed_mpm | prod_tm_param_snapshot | mpm | HF Welder | AB MicroLogix 1400 | Ethernet | EtherNet/IP | Easy | CONFIRMED (SPEED mpm in export); also on Twido mill drive |
| WELD_CURRENT | weld_current_pct | prod_tm_param_snapshot | % | HF Welder | AB MicroLogix 1400 | Ethernet | EtherNet/IP | Easy | welder exports CURRENT % + VOLTAGE % |
| FREQUENCY | weld_frequency_khz | plc.sample | kHz | HF Welder | AB MicroLogix 1400 | Ethernet | EtherNet/IP | Easy | bonus telemetry |
| VEE_LENGTH | v_length_mm | tm_setup | mm | HF Welder | AB MicroLogix 1400 | Ethernet | EtherNet/IP | Easy | AUTO V-length cross-check for setup |
| KW_BAND (status/stored/offset) | kw_band_* | plc.sample | - | HF Welder | AB MicroLogix 1400 | Ethernet | EtherNet/IP | Easy | welder's own KW window; reconcile vs TM-02 |
| RUN_STATE (MESSAGE) | run/stop | stoppage_entry | text | HF Welder MESSAGE | AB MicroLogix 1400 | Ethernet | EtherNet/IP | Easy (interim) | 'WELDER PRODUCING HEAT' = weld-on proxy |
| PRODUCTION_TON / ENERGY | prod_ton / energy_kwh / cost_inr | plc.sample | ton,kWh,INR | HF Welder hourly report | AB MicroLogix 1400 | Ethernet / CSV | WinCC CSV / EtherNet/IP | Easy | hourly; energy KPI + tonnage xcheck |
| CUT_COUNT | pieces | prod_tm_bundle | pulse | COC cut-off | Beckhoff CX/IPC (TwinCAT) | Ethernet | TwinCAT OPC UA / ADS | Medium | piece-count source; enable OPC UA server |
| CUT_LENGTH | length_mm | prod_tm_run | mm | COC cut-off | Beckhoff CX/IPC | Ethernet | TwinCAT OPC UA / ADS | Medium | cut length per piece |
| FORMING/FINPASS/SIZING | (context) | plc.sample | - | Mill drive PLC x3 | Schneider Twido TWDLCAA40DRF | RS-232/485 serial, Win XP | Modbus RTU via serial->Ethernet gateway (Moxa MGate) | Hard | legacy island; register map via TwidoSuite; DEFERABLE |
| LINE_RUN_STOP (true) | run/stop | stoppage_entry | bool | Mill drive PLC | Schneider Twido | serial | Modbus RTU via gateway | Hard | true line stop; interim use welder MESSAGE |
| COOLANT_PRESSURE | coolant_pressure_kg | prod_tm_param_snapshot | kg/mm2 | Utility PLC (not identified) | - | - | - | Manual | no wired sensor found -> likely MANUAL |
| UNCOILER (feed/splice) | (optional) | plc.sample | - | Uncoiler | Schneider Twido TM221CE40R | Ethernet | Modbus TCP | Medium | onboard Ethernet; optional |

### TM-02 Param Window (100 rows)

| Size (as chart) | Size key | Thickness (mm) | Speed min | Speed max | Grade | Power min (kW) | Power max (kW) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | OD20 | 1.0 | 20 | 30 | 1010 | 30 | 45 |
| 20 | OD20 | 1.2/1.3 | 20 | 30 | BSK46 | 30 | 50 |
| 20 | OD20 | 1.4 | 25 | 35 | 1010 | 40 | 60 |
| 20 | OD20 | 1.5 | 25 | 35 | 1010 | 40 | 65 |
| 20 | OD20 | 1.6 | 25 | 35 | 1010 | 45 | 70 |
| 20 | OD20 | 1.8 | 25 | 35 | 1010 | 50 | 75 |
| 20 | OD20 | 2.0 | 20 | 30 | 1010 | 55 | 85 |
| 20 | OD20 | 2.0 | 20 | 30 | 1020 | 60 | 90 |
| 22.23 | OD22.23 | 1.2 | 20 | 30 | 1010/BSK-46 | 30 | 50 |
| 22.23 | OD22.23 | 1.5/1.4 | 25 | 35 | 1010/BSK-46 | 40 | 70 |
| 22.23 | OD22.23 | 1.6 | 25 | 35 | 1010 | 45 | 75 |
| 22.23 | OD22.23 | 1.4/1.6 | 20 | 30 | ST-52/BSK-46 | 45 | 75 |
| 22.23 | OD22.23 | 1.8/1.9 | 25 | 35 | 1010 | 50 | 80 |
| 22.23 | OD22.23 | 2.0 | 25 | 35 | 1010/BSK-46 | 50 | 80 |
| 22.23 | OD22.23 | 2.0 | 20 | 30 | 1020 | 55 | 85 |
| 22.23 | OD22.23 | 2.0 | 20 | 30 | ST-52 | 70 | 100 |
| 22.23 | OD22.23 | 2.2 | 18 | 25 | GR-50 | 50 | 80 |
| 22.23 | OD22.23 | 2.3/2.25 | 20 | 30 | 1010 | 80 | 110 |
| 22.23 | OD22.23 | 2.3 | 20 | 30 | 1020 | 80 | 110 |
| 22.23 | OD22.23 | 2.4 | 20 | 30 | 1010 | 80 | 110 |
| 22.23 | OD22.23 | 2.5 | 20 | 30 | 1010 | 80 | 115 |
| 22.23 | OD22.23 | 2.6 | 20 | 30 | 1010 | 80 | 115 |
| 22.23 | OD22.23 | 2.6 | 20 | 30 | 1020 | 85 | 120 |
| 22.23 | OD22.23 | 2.6 | 18 | 25 | SPL-K3 | 60 | 100 |
| 22.23 | OD22.23 | 2.7 | 20 | 25 | 1010 | 85 | 120 |
| 25.40 | OD25.40 | 1.4 | 20 | 30 | BSK-46 | 45 | 65 |
| 25.40 | OD25.40 | 1.8 | 25 | 35 | BSK-46 | 55 | 80 |
| 25.4 | OD25.4 | 1.5 | 25 | 35 | 1010 | 50 | 75 |
| 25.4 | OD25.4 | 1.6 | 25 | 35 | 1010/BSK-46 | 50 | 75 |
| 25.4 | OD25.4 | 1.8/1.9 | 25 | 35 | 1010 | 55 | 80 |
| 25.4 | OD25.4 | 2.0 | 25 | 35 | 1010 | 75 | 110 |
| 25.4 | OD25.4 | 2.0 | 25 | 35 | 1020 | 80 | 110 |
| 25.4 | OD25.4 | 2.3 | 25 | 35 | 1010 | 85 | 110 |
| 25.4 | OD25.4 | 2.3 | 25 | 35 | 1010/BSK-46 | 85 | 110 |
| 25.4 | OD25.4 | 2.5 | 25 | 30 | 1010/BSK-46 | 90 | 110 |
| 25.4 | OD25.4 | 2.6 | 25 | 30 | 1010 | 90 | 115 |
| 25.4 | OD25.4 | 2.6 | 25 | 30 | 1020 | 90 | 115 |
| 25.4 | OD25.4 | 2.8/2.9 | 25 | 30 | 1010 | 95 | 120 |
| 25.4 | OD25.4 | 3.0 | 20 | 25 | 1010 | 95 | 125 |
| 25.4 | OD25.4 | 3.0 | 20 | 25 | 1020 | 95 | 125 |
| 25.4 | OD25.4 | 3.0 | 15 | 25 | ST-52 | 90 | 125 |
| 25.4 | OD25.4 | 3.2 | 20 | 25 | 1010 | 100 | 130 |
| 25.4 | OD25.4 | 3.2 | 20 | 25 | 1020 | 100 | 135 |
| 25.4 | OD25.4 | 3.5 | 15 | 25 | 1010 | 100 | 135 |
| 25.4 | OD25.4 | 3.6 | 15 | 25 | 1010/1020/ST-52 | 100 | 135 |
| 25.4 | OD25.4 | 3.6 | 15 | 25 | 1020/E250 | 110 | 140 |
| 25.4 | OD25.4 | 3.7 | 15 | 25 | 1010 | 110 | 140 |
| 28.58 | OD28.58 | 1.6 | 20 | 40 | 1010 | 25 | 60 |
| 28.58 | OD28.58 | 1.6 | 18 | 35 | ST-52 | 30 | 70 |
| 28.58 | OD28.58 | 1.8 | 18 | 35 | ST-52 | 35 | 75 |
| 28.58 | OD28.58 | 2.0/2.20/2.30/2.35 | 18 | 35 | 1010/1020 | 35 | 75 |
| 28.58 | OD28.58 | 2.50/2.6/2.7 | 18 | 30 | 1010 | 50 | 100 |
| 28.58 | OD28.58 | 2.6 | 18 | 30 | ST 52 | 45 | 75 |
| 28.58 | OD28.58 | 3.0/2.9 | 18 | 30 | 1010/GR50 | 80 | 145 |
| 28.58 | OD28.58 | 3.2/3.5/3.6/3.8 | 15 | 25 | 1010/1020/ST-52 | 80 | 135 |
| 31.75 | OD31.75 | 1.6 | 18 | 40 | 1010/1020 | 30 | 80 |
| 31.75 | OD31.75 | 2.0 | 18 | 35 | 1010/1020 | 35 | 75 |
| 31.75 | OD31.75 | 3.6 | 15 | 30 | 1010/1020 | 80 | 130 |
| 31.75 | OD31.75 | 4.0 | 12 | 25 | 1010/1020 | 70 | 140 |
| 34.93 | OD34.93 | 1.6 | 15 | 30 | E034/BSK-46 | 25 | 52 |
| 34.93 | OD34.93 | 2.2/2.3 | 20 | 35 | 1010/BSK46 | 50 | 90 |
| 35.0 | OD35.0 | 1.5 | 15 | 30 | 1010 | 30 | 60 |
| 35.0 | OD35.0 | 2.0 | 20 | 35 | 1010 | 40 | 80 |
| 35.0 | OD35.0 | 3.0 | 20 | 30 | ST-52 | 30 | 60 |
| 35.50 | OD35.50 | 2.85 | 10 | 20 | 1010 | 30 | 75 |
| 35.50 | OD35.50 | 3.80 | 10 | 20 | 1010 | 70 | 110 |
| 38.1 | OD38.1 | 1.0 | 15 | 30 | 1010 | 18 | 50 |
| 38.1 | OD38.1 | 1.2 | 15 | 30 | 1010 | 18 | 50 |
| 38.1 | OD38.1 | 1.6 | 15 | 35 | 1010 | 20 | 60 |
| 38.1 | OD38.1 | 1.8/2.0 | 15 | 35 | 1010 | 25 | 65 |
| 38.1 | OD38.1 | 2.0 | 15 | 30 | 1010/1020/ST 52 | 25 | 65 |
| 38.1 | OD38.1 | 2.35 | 15 | 30 | 1010/1020 | 45 | 80 |
| 38.1 | OD38.1 | 3.0 | 15 | 30 | 1010/1020/ST 52 | 45 | 100 |
| 38.1 | OD38.1 | 3.5 | 15 | 30 | 1010 | 50 | 110 |
| 38.5 | OD38.5 | 1.27/1.20 | 15 | 30 | 1010 | 18 | 50 |
| 40.0 | OD40.0 | 1.6 | 15 | 30 | 1010 | 30 | 60 |
| 40.0 | OD40.0 | 2.0 | 15 | 30 | 1010 | 25 | 75 |
| 41.28 | OD41.28 | 2.40 | 18 | 30 | 1010 | 50 | 95 |
| 41.28 | OD41.28 | 2.40/2.7/2.65 | 18 | 30 | BSK46 | 50 | 95 |
| 41.28 | OD41.28 | 2.7 | 18 | 30 | 1010 | 50 | 95 |
| 44.45 | OD44.45 | 1.50/1.6 | 18 | 30 | 1010 | 32 | 65 |
| 44.45 | OD44.45 | 2.0 | 15 | 30 | 1010/ST52/GR50 | 40 | 85 |
| 44.45 | OD44.45 | 2.2 | 15 | 30 | BSK 46 | 35 | 85 |
| 44.45 | OD44.45 | 2.35 | 15 | 25 | 1010/1020 | 40 | 75 |
| 44.45 | OD44.45 | 2.5 | 15 | 30 | 1010 | 35 | 90 |
| 44.45 | OD44.45 | 2.5 | 15 | 25 | 1006 | 40 | 80 |
| 44.45 | OD44.45 | 3.0 | 15 | 25 | 1010/1020/GR50 | 50 | 90 |
| 44.45 | OD44.45 | 3.2 | 15 | 25 | 1020 | 50 | 95 |
| 44.45 | OD44.45 | 3.6 | 12 | 20 | 1020 | 60 | 115 |
| 45.0 | OD45.0 | 1.6 | 18 | 30 | 1010 | 30 | 65 |
| 45.0 | OD45.0 | 2.0 | 15 | 30 | 1010 | 30 | 85 |
| 50.80 | OD50.80 | 2.3 | 20 | 35 | 1010/1020 | 35 | 100 |
| 50.80 | OD50.80 | 2.6 | 20 | 35 | 1010/1020 | 35 | 120 |
| 50.80 | OD50.80 | 3.6 | 15 | 25 | 1010/1020 | 50 | 130 |
| 50.80 | OD50.80 | 4.0 | 15 | 25 | 1010/1020 | 55 | 140 |
| 20 X 40 (38.10) | SEC20X40(38.10) | 1.6 | 20 | 35 | 1010/GR2 | 28 | 55 |
| 30 X 30 (38.10) | SEC30X30(38.10) | 1.6 | 20 | 35 | BSK-46 | 35 | 90 |
| 40 X 25 (41.28) | SEC40X25(41.28) | 1.4/1.5 | 15 | 30 | 1010/BSK46 | 25 | 60 |
| 40 X 20 (38.10) | SEC40X20(38.10) | 2.0 | 15 | 30 | ST-52 | 30 | 80 |
| 40 X 30 (44.45) | SEC40X30(44.45) | 2.0 | 15 | 30 | ST-52 | 30 | 80 |

### TM-02 Tooling & Fin (22 rows)

| Tube OD | Thickness | Boggie size | Impeder size | Ferrite rod | SS rod | ID tool | OD tool | Work coil ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 1.00-2.00 | 14 | 14 X 16 | 3X200 | 8 | R-6.5 | R-12/15 | 30 |
| 22.23 | 1.0-1.60 | 16 | 15 X 17 | 3X200 | 8 | R-7.0 & 8.0 | R-12/15 | 34 |
| 22.23 | 1.8-2.6 | 14 | 15 X 17 | 3X200 | 8 | R/6.5 | R-12/15 | 34 |
| 25.40 | 1.0-2.0 | 18 | 16 X 18 | 4X200 | 10 | R -7/8 | R -15/18 | 36 |
| 25.40 | 2.5-3.6 | 16 | 16 X 18 | 3X200 | 10 | R -7/8 | R -15/18 | 36 |
| 28.58 | 1.0-3.0 | 20 | 18 X 20 | 4X200 | 10 | R -7/8/9 | R -18/20 | 40 |
| 28.58 | 3.2-3.6 | 18 | 16 X 18 | 3X200 | 10 | R -7/8/9 | R -18/20 | 40 |
| 31.75 | 1.00-4.00 | 20/22 | 20 X 22 | 4/5X200 | 10 | R -7/8/9 | R -18/20 | 42 |
| 34.93/35.0/35.50 | 1.00-4.00 | 25 | 20 X 22 | 5X200 | 10 | R -9/10/11/12 | R -20/25 | 48 |
| 38.10/38.50 | 1.0-3.6 | 30 | 26 X 28 | 7X200 | 12 | R -9/10/11/12 | R -20/25 | 50 |
| 40.00 | 1.20-2.50 | 30 | 26X28 | 7X200 | 12 | R -9/10/11/12 | R -30/35 | 52 |
| 45.00 | 1.60-2.50 | 34 | 30X32 | 8X200 | 12 | R -9/10/11/12 | R -30/35 | 58 |
| 41.28 | 1.00-2.7 | 30 | 26 X 28 | 7X200 | 12 | R -10/11/12 | R -30/35 | 52 |
| 44.45 | 1.80-3.50 | 34 | 30 X 32 | 7X200 | 12 | R -10/11/12 | R -30/35 | 55 |
| 50.80 | 2.30-4.0 | 34 | 30 X 32 | 7X200 | 12 | R -11/12 | R -30/35 | 62 |
| Tube size | Fin10 | Fin12 | Fin14 / SG | Weld dia |  |  |  |  |
| 20 | 23.55 | 22.5 | 21.75 | 19.80/20.50 |  |  |  |  |
| 25.4 | 28.66 | 27.78 | 26.94 | 25.20/25.90 |  |  |  |  |
| 31.75 | 35.82 | 34.72 | 33.66 | 31.55/32.25 |  |  |  |  |
| 38.1 | 44.45 | 42.36 | 40.32 | 37.90/38.60 |  |  |  |  |
| 44.45 | 49.18 | 47.8 | 46.44 | 44.25/44.95 |  |  |  |  |
| 50.80 | 55.50 | 53.75 | 52.60 | 51.40/51.50 |  |  |  |  |

---

# Furnace

**File:** `Zedral_A59_Furnace_M1_Data_Mapping.xlsx`
**Sheets (9):** `Cover & Legend`, `Sheet Map`, `Field Register`, `ERP-WO Fields`, `PLC Connectivity`, `Gas Plant Params`, `Codes & Enums`, `Data Flow`, `Required Documents`
**Field Register count:** **27**

## Capture class counts

- **AUTO**: 8 _(fill: FFD6EAD6)_
- **DERIVED**: 7 _(fill: FFD6E3F0)_
- **AUTO/MANUAL**: 6 _(fill: FFD6EAD6)_
- **MANUAL**: 4 _(fill: FFFCE7C9)_
- **MANUAL/AUTO**: 1 _(fill: FFFCE7C9)_
- **SYSTEM**: 1 _(fill: FFEADCF2)_

## Target tables / child entities

- `txn.prod_ann_run` — **21** fields: ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, ANN-06, ANN-07, ANN-08, ANN-09, ANN-10, ANN-11, ANN-12, ANN-13, ANN-14, ANN-15, ANN-16, ANN-17, ANN-18, ANN-19, ANN-20, ANN-21
- `txn.ann_gas_log` — **6** fields: GAS-01, GAS-02, GAS-03, GAS-04, GAS-05, GAS-06

## Sheet / form groups

- **Run header** — 6: ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, ANN-06
- **1 Furnace prod** — 15: ANN-07, ANN-08, ANN-09, ANN-10, ANN-11, ANN-12, ANN-13, ANN-14, ANN-15, ANN-16, ANN-17, ANN-18, ANN-19, ANN-20, ANN-21
- **2/3 Gas plant** — 6: GAS-01, GAS-02, GAS-03, GAS-04, GAS-05, GAS-06

## Cover & Legend

- **ZEDRAL  .  A-59 ANNEALING FURNACE  .  M1 DATA MAPPING**
- **Goodluck India Limited . Sikandrabad . Roller Hearth Furnace (RHF) heat treatment + N2/EXO gas plant . v1.0**
- **Purpose**: Data mapping for M1 on the annealing / heat-treatment furnace, same method as the tube-mill and draw-bench books. Sits between the tube mill and drawing on the CEW/CDW route.
- **Position on route**: Tube mill -> ANNEALING (this) -> STP -> Draw bench. Also re-entered between draw passes (inter-pass anneal).
- **Best L2 candidate**: Furnace is SCADA-driven and the easiest connect on the line: RHF-03/04 (Siemens S7-300) and RHF-05 (ET200SP, OPC UA) already run on a Siemens SCADA that collects zone temperatures. Zone temps + line speed are AUTO.
- **Sheets**: Furnace Production Report (ANN-FT-01) + N2 PSA Gas Plant log + EXO Gas Plant log. Heat-treat recipe (temp/speed) comes from WI charts ANN-02/03/04.
- **Atmosphere**: Protective gas: N2-PSA (feeds RHF-04/05) or EXO (feeds RHF-03). Gas-plant params are logged hourly; AUTO if the gas plant PLC is tapped, else a manual log.
- **Tolerances**: Line speed +/- 2 m/hr; soaking-zone temperature +/- 10 C. Batch entry gap: 300 mm min between lots, 6000 mm between batches. Reject/quarantine reaction plan, no rework.
- **LEGEND . capture class**
- **AUTO**: Machine reports it (RHF SCADA / instruments). No typing.
- **DERIVED**: Pre-filled from the work order (ERP) or the heat-treat recipe chart. Operator confirms.
- **MANUAL**: Operator measures, judges, or logs it.
- **MASTER**: One-time reference / master data (recipe, gas spec ranges).
- **SYSTEM**: Generated by the platform (ids, rollups).
- **Tabs**: Sheet Map | Field Register | ERP-WO Fields | PLC Connectivity | Gas Plant Params | Codes & Enums | Data Flow | Required Documents
- **Source docs**: GLI-FT-PRD-ANN-01 R4 (furnace production report); GLI-FT-PRD-GAS PLANT-01 R4 (N2 PSA); GLI-FT-PRD-GAS PLANT-02 R1 (EXO); WI GLI-WI-PRD-ANN-01 R18; A-59 PLC survey (RHF-03/04/05).
- **Note**: ANN-FT-01 records SIX temperature zones (I-VI), each Min/Max, not four. Shift check GLI-ST-PRD-ANN-03 and temp/speed charts ANN-02/03/04 are referenced in the WI but not in the Formats set yet.
- **Field counts**
- **AUTO**: =COUNTIF('Field Register'!$H$4:$H$30,"*AUTO*")
- **DERIVED**: =COUNTIF('Field Register'!$H$4:$H$30,"*DERIVED*")
- **MANUAL**: =COUNTIF('Field Register'!$H$4:$H$30,"*MANUAL*")
- **MASTER**: =COUNTIF('Field Register'!$H$4:$H$30,"*MASTER*")
- **SYSTEM**: =COUNTIF('Field Register'!$H$4:$H$30,"*SYSTEM*")
- **Total fields**: =COUNTA('Field Register'!$A$4:$A$30)

## Sheet Map

| Plant sheet | Format / doc no. | Rev | In hand? | Nature | Digital target | Capture summary |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Furnace production report | GLI-FT-PRD-ANN-01 (ANN-FT-01) | R4 | Yes | Per charge / lot | txn.prod_ann_run | 6-zone temps + speed AUTO (SCADA); no. of tubes + HT type DERIVED/MANUAL; gas consumption metered |
| 2. N2 PSA gas plant log | GLI-FT-PRD-GAS PLANT-01 | R4 | Yes | Hourly | txn.ann_gas_log | Pressures/temps/flows/dew point/H2% - AUTO if plant PLC else manual hourly log |
| 3. EXO gas plant log | GLI-FT-PRD-GAS PLANT-02 | R1 | Yes | Hourly | txn.ann_gas_log | PNG/air/combustion/chiller/H2%/dew point - AUTO if plant PLC else manual |
| Work Instruction (all furnaces) | GLI-WI-PRD-ANN-01 | R18 | Yes | Process logic + gas plant | - | SCADA-driven; zone temps, speed, batch |
| Temp / speed charts | ANN-02 / ANN-03 (RHF-3&4) / ANN-04 | R06+ | In WI | Heat-treat recipe per grade | master.ann_recipe | seed the recipe master |
| Shift check sheet | GLI-ST-PRD-ANN-03 | - | Referenced, not shared | Per shift start | txn.ann_shift_check | gap |

## COMPLETE Field Register

| Field ID | Sheet | Paper field | Canonical field (DB) | Target schema.table | Type | Unit | Class | Source | Req | Validation / rule | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ANN-01 | Run header | Charge / lot id | charge_no | txn.prod_ann_run | text | - | SYSTEM | furnace + ts | Y | unique per tenant | batch entry |
| ANN-02 | Run header | Furnace (RHF) no | furnace_code | txn.prod_ann_run | text | - | DERIVED | assignment | Y | FK master.machine | RHF-03/04/05 on A-59 |
| ANN-03 | Run header | Customer | customer_code | txn.prod_ann_run | text | - | DERIVED | work order | N | FK master.customer |  |
| ANN-04 | Run header | OD x THK x Length | size | txn.prod_ann_run | json | mm | DERIVED | work order | Y | - |  |
| ANN-05 | Run header | Work Order / PO No | work_order_no | txn.prod_ann_run | text | - | DERIVED | work order (BC) | Y | - |  |
| ANN-06 | Run header | Specification / Grade | grade_code | txn.prod_ann_run | text | - | DERIVED | work order | Y | FK master.grade | selects HT recipe |
| ANN-07 | 1 Furnace prod | No. of tubes | tube_count | txn.prod_ann_run | int | pcs | MANUAL | operator | Y | >=0 | charge count |
| ANN-08 | 1 Furnace prod | Heat treatment (type) | ht_type | txn.prod_ann_run | enum | - | DERIVED | grade / recipe | Y | ANNEAL\|NORMALIZE\|SRA | per grade |
| ANN-09 | 1 Furnace prod | Temperature Zone I (Min/Max) | zone1_min/max_c | txn.prod_ann_run | number | C | AUTO | RHF SCADA | Y | soaking +/-10 C | zone temp |
| ANN-10 | 1 Furnace prod | Temperature Zone II (Min/Max) | zone2_min/max_c | txn.prod_ann_run | number | C | AUTO | RHF SCADA | Y | +/-10 C |  |
| ANN-11 | 1 Furnace prod | Temperature Zone III (Min/Max) | zone3_min/max_c | txn.prod_ann_run | number | C | AUTO | RHF SCADA | Y | +/-10 C |  |
| ANN-12 | 1 Furnace prod | Temperature Zone IV (Min/Max) | zone4_min/max_c | txn.prod_ann_run | number | C | AUTO | RHF SCADA | Y | +/-10 C |  |
| ANN-13 | 1 Furnace prod | Temperature Zone V (Min/Max) | zone5_min/max_c | txn.prod_ann_run | number | C | AUTO | RHF SCADA | Y | +/-10 C |  |
| ANN-14 | 1 Furnace prod | Temperature Zone VI (Min/Max) | zone6_min/max_c | txn.prod_ann_run | number | C | AUTO | RHF SCADA | Y | +/-10 C | 6 zones on ANN-FT-01 |
| ANN-15 | 1 Furnace prod | Line speed (running) | line_speed_mhr | txn.prod_ann_run | number | m/hr | AUTO | RHF SCADA | Y | +/-2 m/hr | charge speed |
| ANN-16 | 1 Furnace prod | Total (Nos / MT) | total_nos / total_mt | txn.prod_ann_run | number | pcs,MT | AUTO | rollup | Y | - |  |
| ANN-17 | 1 Furnace prod | Gas consumption PNG (A/B/C) | png_consumption | txn.prod_ann_run | number | Nm3 | AUTO/MANUAL | meter if wired | N | - | furnace fuel |
| ANN-18 | 1 Furnace prod | Gas consumption NH3 | nh3_consumption | txn.prod_ann_run | number | kg | AUTO/MANUAL | meter if wired | N | - | cracked NH3 (N2 route) |
| ANN-19 | 1 Furnace prod | Remarks | remarks | txn.prod_ann_run | text | - | MANUAL | operator | N | - |  |
| ANN-20 | 1 Furnace prod | Batch gap (300mm lot / 6000mm batch) | batch_gap_ok | txn.prod_ann_run | bool | - | MANUAL/AUTO | operator / SCADA | N | 300 mm lots, 6000 mm batches | charge spacing |
| ANN-21 | 1 Furnace prod | Reject / quarantine | disposition | txn.prod_ann_run | enum | - | MANUAL | operator/QA | N | reject/quarantine, no rework |  |
| GAS-01 | 2/3 Gas plant | Atmosphere type | gas_type | txn.ann_gas_log | enum | - | DERIVED | furnace | Y | N2-PSA \| EXO | N2 -> RHF-04/05; EXO -> RHF-03 |
| GAS-02 | 2/3 Gas plant | Hourly gas params (full list) | gas_params (jsonb) | txn.ann_gas_log | json | mixed | AUTO/MANUAL | plant PLC / hourly log | Y | per Gas Plant Params tab | see Gas Plant Params tab |
| GAS-03 | 2/3 Gas plant | Dew point | dew_point_c | txn.ann_gas_log | number | C | AUTO/MANUAL | plant | Y | N2: -40 to -110; EXO: +20 to -45 | atmosphere quality |
| GAS-04 | 2/3 Gas plant | Final H2 % | h2_pct | txn.ann_gas_log | number | % | AUTO/MANUAL | plant | Y | N2: 1-10; EXO: 0.10-5.0 |  |
| GAS-05 | 2/3 Gas plant | O2 product gas (ppm) | o2_ppm | txn.ann_gas_log | number | ppm | AUTO/MANUAL | plant | Y | 0-10 |  |
| GAS-06 | 2/3 Gas plant | Dryer / tower change-over time (N2) | changeover_time | txn.ann_gas_log | ts | - | MANUAL | operator | N | - | N2 PSA only |

## ERP / WO Fields

| ERP / WO field | Canonical field | Target table | Read now (plan) | Write back (later) | Notes |
| --- | --- | --- | --- | --- | --- |
| Work order / PO number | work_order_no | txn.prod_ann_run | Yes | - |  |
| Customer | customer_code | txn.prod_ann_run | Yes | - |  |
| Specification / grade | grade_code | txn.prod_ann_run | Yes | - | selects heat-treat recipe |
| Size (OD x THK x Length) | size | txn.prod_ann_run | Yes | - |  |
| Incoming tube ref (from mill) | input_tube_ref | txn.prod_ann_run | Yes | - | route card genealogy |
| Route / next operation (STP / draw) | route_ref | (genealogy) | Yes | - |  |
| Heat-treated qty (actuals) | total_nos / total_mt | txn.prod_ann_run | - | Yes | write-back phase |
| Disposition (accept / quarantine) | disposition | txn.prod_ann_run | - | Yes | write-back phase |

## Codes & Enums

| Group | Value | Notes |
| --- | --- | --- |
| Furnaces (A-59) | RHF-03 \| RHF-04 \| RHF-05 | roller hearth; RHF-03 EXO, RHF-04/05 N2-PSA |
| Heat treatment type | ANNEAL \| NORMALIZE \| SRA | SRA = stress relief anneal (WI 104B optional) |
| Atmosphere gas | N2-PSA \| EXO | protective atmosphere |
| Zone count | I . II . III . IV . V . VI | 6 temperature zones on ANN-FT-01 |
| Tolerances | line speed +/-2 m/hr; soaking temp +/-10 C | from WI |
| Batch spacing | 300 mm min between lots; 6000 mm between batches |  |
| Reaction plan | reject / quarantine; no rework |  |
| Record status | DRAFT \| SUBMITTED \| APPROVED \| LOCKED | capture lifecycle |

## Data Flow

| Step | Source | To | What moves |
| --- | --- | --- | --- |
| 1 Plan | Dynamics 365 BC (ERP) | Charge header | WO, customer, grade, size; grade selects heat-treat recipe |
| 2 Recipe | ANN temp/speed charts (ANN-02/03/04) | Server | soaking temp + line speed target per grade; operator confirms |
| 3 Machine | RHF SCADA / historian (S7-300 / ET200SP) | Collector -> Server | 6 zone temps + line speed AUTO (1 tap, no new hardware) |
| 4 Atmosphere | N2 PSA / EXO gas plant | Collector or log | dew point, H2%, O2 ppm, pressures/flows (AUTO if plant PLC else hourly log) |
| 5 Confirm | Server (live API) | Tablet | confirm charge, HT type, no. of tubes; band-check zone temps vs recipe; reject/quarantine |
| 6 Assemble | Server rollups | Sheets (views) | furnace production report + gas logs assemble themselves |
| 7 Write-back (later) | Server | Dynamics 365 BC + next process | heat-treated qty, disposition; release to STP / draw |
| Note | - | - | Furnace is re-entered between draw passes (inter-pass anneal). Same charge model each pass. |

## Required Documents

| Ref | Document / item needed | Why it matters | Status / owner |
| --- | --- | --- | --- |
| D-1 | GLI-FT-PRD-ANN-01 Furnace Production Report | Sheet 1 (6-zone temps, speed, gas) | RESOLVED - received (R4) |
| D-2 | GLI-FT-PRD-GAS PLANT-01 / 02 logs | N2 PSA + EXO hourly params | RESOLVED - received (R4 / R1) |
| D-3 | GLI-ST-PRD-ANN-03 shift check sheet | Start-of-shift furnace checks | Pending - Goodluck |
| D-4 | Temp / speed charts ANN-02/03/04 | Heat-treat recipe master (soaking temp/time per grade) | Pending - Goodluck (WI annex) |
| D-5 | RHF SCADA / historian access + tag map (O-2) | Which zone-temp/speed tags; OPC / historian read login | Pending - Electrical Head |
| D-6 | RHF-05 OPC UA runtime licence (S7-1500 family) | Enable built-in OPC UA server on ET200SP | Confirm / procure |
| D-7 | Gas plant PLC / instrument survey | Decides AUTO vs manual for atmosphere params | Pending - tag survey |
| D-8 | Heat-treatment acceptance (metallurgy) | Hardness / grain criteria post-anneal | Pending - Goodluck QA |

## Extra / supporting sheets

### PLC Connectivity (6 rows)

| Machine | Controller / PLC | Model | Comms | Read protocol / driver | Ease | Status | What it yields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RHF-03 | Siemens SIMATIC S7-300 | CPU 315-2 PN/DP (6ES7 315-2EH14-0AB0) | Ethernet PROFINET + Siemens SCADA | S7comm (Snap7 / KEPServerEX) or tap Siemens SCADA OPC/historian | Easy | Connected (survey) | 6 zone temps, line speed, batch |
| RHF-04 | Siemens SIMATIC S7-300 | CPU 315-2 PN/DP (6ES7 315-2EH14-0AB0) | Ethernet PROFINET + Siemens SCADA | S7comm (Snap7) or SCADA OPC tap | Easy | Connected (survey) | 6 zone temps, line speed, batch |
| RHF-05 | Siemens SIMATIC ET 200SP | CPU 1510SP-1 PN | Ethernet PROFINET + Siemens SCADA | OPC UA (built-in CPU server; needs runtime licence) or S7comm | Easy | Connected (survey) | 6 zone temps, line speed, batch |
| Furnace SCADA / historian | Siemens WinCC | - | Ethernet | OPC / historian read (already collects zone temps) | Easy | Present | fastest path - tap the historian |
| N2 PSA gas plant | Instruments / PLC (confirm) | - | - | Manual hourly log; AUTO if plant PLC tapped | Medium | Log only | atmosphere params (see Gas Plant Params) |
| EXO gas plant | Instruments / PLC (confirm) | - | - | Manual hourly log; AUTO if plant PLC tapped | Medium | Log only | atmosphere params |

### Gas Plant Params (26 rows)

| Gas plant | Parameter | Unit | Spec range |
| --- | --- | --- | --- |
| N2 PSA | Inlet water pressure | kg/cm2 | 1.50-3.0 |
| N2 PSA | Discharge temp | C | 75-110 |
| N2 PSA | Air receiver pressure | kg/cm2 | 6.5-7.2 |
| N2 PSA | PSA tower pressure A / B | kg/cm2 | 6.5-7.2 |
| N2 PSA | Raw N2 flow (LDP 200-550) | Nm3/hr | 150-300 |
| N2 PSA | NH3 inlet pressure | kg/cm2 | 5.0-6.5 |
| N2 PSA | Cracked NH3 flow | Nm3/hr | 05-40 |
| N2 PSA | Deoxo temp | C | 50-400 |
| N2 PSA | N2 dryer tower A/B pressure | kg/cm2 | 4.0-5.50 |
| N2 PSA | N2 dryer tower A/B temp | C | 20-220 |
| N2 PSA | O2 product gas | ppm | 0-10 |
| N2 PSA | Dew point | C | -40 to -110 |
| N2 PSA | Final H2 | % | 1-10 |
| EXO | Main pressure PNG | kg/cm2 | 2.0-3.5 |
| EXO | Secondary pressure PNG | Nm3/hr | 0.10-0.50 |
| EXO | PNG flow | Nm3/hr | 18-40 |
| EXO | Combustion air | Nm3/hr | 120-300 |
| EXO | Combustion chamber temp | C | 35-80 |
| EXO | Inlet water pressure | kg/cm2 | 1.0-2.5 |
| EXO | Air blower pressure | kg/cm2 | 0.15-0.50 |
| EXO | Deoxo pressure | Nm3 | 0.05-0.50 |
| EXO | Chiller inlet / outlet temp | C | 5-65 / 3-20 |
| EXO | Chiller suction / discharge pressure | PSI | 0-65 / 180-300 |
| EXO | H2 | % | 0.10-5.0 |
| EXO | O2 product gas | ppm | 0-10 |
| EXO | Dew point | C | +20 to -45 |

---

# STP

**File:** `Zedral_A59_STP_M1_Data_Mapping.xlsx`
**Sheets (10):** `Cover & Legend`, `Sheet Map`, `Field Register`, `ERP-WO Fields`, `PLC Connectivity`, `Bath Table (spec)`, `Bath History (STP-04B)`, `Codes & Enums`, `Data Flow`, `Required Documents`
**Field Register count:** **28**

## Capture class counts

- **MANUAL**: 13 _(fill: FFFCE7C9)_
- **AUTO**: 8 _(fill: FFD6EAD6)_
- **DERIVED**: 4 _(fill: FFD6E3F0)_
- **DERIVED/MANUAL**: 1 _(fill: FFD6E3F0)_
- **MASTER/MANUAL**: 1 _(fill: FFE4E4E7)_
- **SYSTEM**: 1 _(fill: FFEADCF2)_

## Target tables / child entities

- `txn.prod_stp_lot` — **16** fields: STP-01, STP-02, STP-03, STP-04, STP-05, STP-06, STP-07, STP-08, STP-09, STP-10, STP-11, STP-12, STP-13, STP-14, STP-25, STP-26
- `plc.sample` — **1** fields: STP-15
- `txn.stp_bath_analysis` — **9** fields: STP-16, STP-17, STP-18, STP-19, STP-20, STP-21, STP-22, STP-23, STP-24
- `txn.stp_coating` — **1** fields: STP-27
- `txn.stp_bath_history` — **1** fields: STP-28

## Sheet / form groups

- **Lot header** — 6: STP-01, STP-02, STP-03, STP-04, STP-05, STP-06
- **1 Process monitor** — 11: STP-07, STP-08, STP-09, STP-10, STP-11, STP-12, STP-13, STP-14, STP-15, STP-25, STP-26
- **1 Bath analysis** — 9: STP-16, STP-17, STP-18, STP-19, STP-20, STP-21, STP-22, STP-23, STP-24
- **3 Coating** — 1: STP-27
- **2 Bath history** — 1: STP-28

## Cover & Legend

- **ZEDRAL  .  A-59 STP SURFACE TREATMENT  .  M1 DATA MAPPING**
- **Goodluck India Limited . Sikandrabad . Surface Treatment Plant (degrease / pickle / phosphate / lube for draw) . v1.0**
- **Purpose**: Data mapping for M1 on the STP (Surface Treatment Plant), same method as the other books. Sits between annealing and drawing; prepares the tube surface for cold draw.
- **Position on route**: Tube mill -> Annealing -> STP (this) -> Draw bench. Re-entered between draw passes to re-lubricate.
- **What STP does**: Degrease, pickle (HCl), activate, phosphate, neutralize, lubricate, dry. The phosphate coat carries draw lubrication only; it is NOT a final-product criterion.
- **L2 candidate**: STP is SCADA / auto: overhead crane in auto mode, dip time and bath temperature preset. Controller is Siemens ET200S (IM151) + TP700 Comfort HMI (OPC UA capable). Bath temps + dip times are AUTO.
- **Split**: AUTO: bath temperatures, dip times, crane/wagon state (from ET200S / TP700). MANUAL: bath analysis (lab titration - TA/FA/pH/acid%), phosphate coating weight, bath-change history.
- **Sheets**: STP Production cum Process Monitoring (STP-FT-01A) + Bath Process History Card (STP-FT-04B) + Phosphate Coating Weight (STP-FT-06).
- **LEGEND . capture class**
- **AUTO**: Machine reports it (ET200S / TP700 - bath temp, dip time, crane). No typing.
- **DERIVED**: Pre-filled from the work order (ERP). Operator confirms.
- **MANUAL**: Operator / lab measures or judges it (bath analysis, coating).
- **MASTER**: One-time reference / master data (bath table spec, change frequency).
- **SYSTEM**: Generated by the platform (ids, rollups).
- **Tabs**: Sheet Map | Field Register | ERP-WO Fields | PLC Connectivity | Bath Table (spec) | Bath History (STP-04B) | Codes & Enums | Data Flow | Required Documents
- **Source docs**: GLI-FT-STP-01A R3 (production cum monitoring); GLI-FT-PRD-STP-04B R2 (bath history); GLI-FT-PRD-STP-06 R0 (coating); WI GLI-WI-PRD59-STP-01 R09; bath-testing WI GLI-WI-PRD59-STP-02; A-59 PLC survey (STP ET200S).
- **Note**: STP PLC connect status was 'in progress' on the survey. Shift check GLI-ST-PRD-STP-02 is referenced in the WI but not in the Formats set yet.
- **Field counts**
- **AUTO**: =COUNTIF('Field Register'!$H$4:$H$31,"*AUTO*")
- **DERIVED**: =COUNTIF('Field Register'!$H$4:$H$31,"*DERIVED*")
- **MANUAL**: =COUNTIF('Field Register'!$H$4:$H$31,"*MANUAL*")
- **MASTER**: =COUNTIF('Field Register'!$H$4:$H$31,"*MASTER*")
- **SYSTEM**: =COUNTIF('Field Register'!$H$4:$H$31,"*SYSTEM*")
- **Total fields**: =COUNTA('Field Register'!$A$4:$A$31)

## Sheet Map

| Plant sheet | Format / doc no. | Rev | In hand? | Nature | Digital target | Capture summary |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Production cum process monitoring | GLI-FT-STP-01A (STP-FT-01A) | R3 | Yes | Per lot | txn.prod_stp_lot + txn.stp_bath_analysis | Bath temps + dip times AUTO (crane auto); bath analysis MANUAL (lab); chemical additions MANUAL |
| 2. Bath process history card | GLI-FT-PRD-STP-04B (STP-FT-04B) | R2 | Yes | Per bath (calendar) | txn.stp_bath_history | Change frequency MASTER; planned vs executed per day MANUAL |
| 3. Phosphate coating weight | GLI-FT-PRD-STP-06 (STP-FT-06) | R0 | Yes | Weekly / sample | txn.stp_coating | Coating weight g/m2 MANUAL (lab); spec 4.0-8.0 |
| Work Instruction (A-59) | GLI-WI-PRD59-STP-01 | R09 | Yes | Process logic + bath table | - | auto crane, dip time/temp preset |
| Bath testing WI | GLI-WI-PRD59-STP-02 | - | Yes | Titration methods | - | how bath analysis is done |
| Shift check sheet | GLI-ST-PRD-STP-02 | - | Referenced, not shared | Per shift start | txn.stp_shift_check | gap |

## COMPLETE Field Register

| Field ID | Sheet | Paper field | Canonical field (DB) | Target schema.table | Type | Unit | Class | Source | Req | Validation / spec | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STP-01 | Lot header | Lot / run id | lot_no | txn.prod_stp_lot | text | - | SYSTEM | STP + ts | Y | unique per tenant | batch on crane |
| STP-02 | Lot header | Customer | customer_code | txn.prod_stp_lot | text | - | DERIVED | work order | N | FK master.customer |  |
| STP-03 | Lot header | Grade | grade_code | txn.prod_stp_lot | text | - | DERIVED | work order | Y | FK master.grade |  |
| STP-04 | Lot header | OD x THK x Len | size | txn.prod_stp_lot | json | mm | DERIVED | work order | Y | - |  |
| STP-05 | Lot header | Work Order No | work_order_no | txn.prod_stp_lot | text | - | DERIVED | work order (BC) | Y | - |  |
| STP-06 | Lot header | Qty (No / MT) | qty_no / qty_mt | txn.prod_stp_lot | number | pcs,MT | DERIVED/MANUAL | work order / operator | Y | - |  |
| STP-07 | 1 Process monitor | Degreasing temp + time | degrease_temp_c / time_min | txn.prod_stp_lot | number | C,min | AUTO | bath sensor / crane auto | Y | 75-85 C, 10-15 min | G-390 |
| STP-08 | 1 Process monitor | De-scaling / pickling time | pickle_time_min | txn.prod_stp_lot | number | min | AUTO | crane auto | Y | 8-13 min | HCl tanks |
| STP-09 | 1 Process monitor | Phosphating temp + time | phos_temp_c / time_min | txn.prod_stp_lot | number | C,min | AUTO | bath sensor / crane | Y | 65-75 C, 6-11 min | 3510E/3510A |
| STP-10 | 1 Process monitor | Neutralizer temp / dip | neut_temp_c | txn.prod_stp_lot | number | C | AUTO | bath / crane | Y | 50-60 C, 1 flash dip |  |
| STP-11 | 1 Process monitor | Lubrication temp + time | lube_temp_c / time_min | txn.prod_stp_lot | number | C,min | AUTO | bath / crane | Y | 70-75 C, 7-12 min | G-3005 |
| STP-12 | 1 Process monitor | Dryer temp + time | dryer_temp_c / time_min | txn.prod_stp_lot | number | C,min | AUTO | dryer / crane | Y | 80-120 C, 12-17 min | Thermopac |
| STP-13 | 1 Process monitor | Reactive oil dip time | reactive_oil_time_min | txn.prod_stp_lot | number | min | AUTO | crane | N | ambient, 8-10 min | Bondrite (if oil route) |
| STP-14 | 1 Process monitor | Surface finish | surface_finish | txn.prod_stp_lot | text | - | MANUAL | operator | Y | visual |  |
| STP-15 | 1 Process monitor | Crane / wagon state | crane_state | plc.sample | text | - | AUTO | ET200S / TP700 | N | - | auto-mode sequence |
| STP-16 | 1 Bath analysis | Degreasing TA | ta_degrease_ml | txn.stp_bath_analysis | number | ml | MANUAL | lab titration | Y | 78-90 ml | G-390 |
| STP-17 | 1 Bath analysis | HCl pickling: HCl con | hcl_con_pct | txn.stp_bath_analysis | number | % | MANUAL | lab | Y | 6-22 % | HCl-30% min top-up |
| STP-18 | 1 Bath analysis | HCl pickling: Fe content | fe_pct | txn.stp_bath_analysis | number | % | MANUAL | lab | Y | 10 % max |  |
| STP-19 | 1 Bath analysis | Activation pH | activation_ph | txn.stp_bath_analysis | number | pH | MANUAL | lab | Y | 7-8 | GV-6521 |
| STP-20 | 1 Bath analysis | Phosphating TA / FA / ACC / OXTA | phos_ta/fa/acc/oxta | txn.stp_bath_analysis | number | ml | MANUAL | lab | Y | TA 32-38, FA 4-6, ACC 3-5, OXTA 18-22 | 3510E/3510A/GB-14 |
| STP-21 | 1 Bath analysis | Neutralizer pH | neut_ph | txn.stp_bath_analysis | number | pH | MANUAL | lab | Y | 8-10 | G-21 |
| STP-22 | 1 Bath analysis | Lube con / FA / pH | lube_con/fa/ph | txn.stp_bath_analysis | number | %,pH | MANUAL | lab | Y | con 4-6%, FA 0-1.0%, pH 8-10 | G-3005 |
| STP-23 | 1 Bath analysis | Water rinse pH (1-4) | rinse_ph | txn.stp_bath_analysis | number | pH | MANUAL | lab | Y | 1 deg 7-10, 2 acid 2-5, 3 acid 5-7, 4 phos 5-8 |  |
| STP-24 | 1 Bath analysis | Oil bath water content / acid no | oil_water_pct / acid_no | txn.stp_bath_analysis | number | %,- | MANUAL | lab | N | water 1-2 %, acid no 100-200 | Bondrite LR 06021 |
| STP-25 | 1 Process monitor | Chemical addition (name/qty/batch) | chem_add | txn.prod_stp_lot | json | - | MANUAL | operator | N | name, quantity, batch no/date |  |
| STP-26 | 1 Process monitor | Break down & remarks | breakdown_remark | txn.prod_stp_lot | text | - | MANUAL | operator | N | - |  |
| STP-27 | 3 Coating | Phosphated coating weight | coating_gm2 | txn.stp_coating | number | g/m2 | MANUAL | lab | Y | 4.0-8.0 g/m2 | 2 samples, weekly (STP-06) |
| STP-28 | 2 Bath history | Bath change frequency + execution | bath_change | txn.stp_bath_history | json | - | MASTER/MANUAL | schedule / operator | Y | per Bath History tab | planned vs executed calendar |

## ERP / WO Fields

| ERP / WO field | Canonical field | Target table | Read now (plan) | Write back (later) | Notes |
| --- | --- | --- | --- | --- | --- |
| Work order number | work_order_no | txn.prod_stp_lot | Yes | - |  |
| Customer | customer_code | txn.prod_stp_lot | Yes | - |  |
| Grade | grade_code | txn.prod_stp_lot | Yes | - |  |
| Size (OD x THK x Len) | size | txn.prod_stp_lot | Yes | - |  |
| Quantity (No / MT) | qty_no / qty_mt | txn.prod_stp_lot | Yes | - |  |
| Incoming tube ref (from furnace) | input_tube_ref | txn.prod_stp_lot | Yes | - | route card genealogy |
| Route / next operation (draw) | route_ref | (genealogy) | Yes | - |  |
| Treated qty (actuals) | qty_mt | txn.prod_stp_lot | - | Yes | write-back phase |

## Codes & Enums

| Group | Value | Notes |
| --- | --- | --- |
| STP route (A-59) | Soap / phosphate draw (105A) | oil draw 105B is A-51 only |
| Bath sequence | Degrease -> HCl pickle -> rinse -> activate -> phosphate -> neutralize -> lube -> dry | + reactive oil on oil route |
| Chemicals | G-390, GV-6521, 3510E/3510A, GB-14, G-21, G-3005, Bondrite LR 06021, Gardoline-R 1683 | supplier: Chemetall/Gardo |
| Coating spec | 4.0-8.0 g/m2 phosphate | weekly, 2 samples |
| Capture | bath temp + dip time AUTO; analysis + coating MANUAL (lab) |  |
| Record status | DRAFT \| SUBMITTED \| APPROVED \| LOCKED | capture lifecycle |

## Data Flow

| Step | Source | To | What moves |
| --- | --- | --- | --- |
| 1 Plan | Dynamics 365 BC (ERP) | Lot header | WO, customer, grade, size, qty |
| 2 Machine | STP crane / ET200S / TP700 (auto mode) | Collector -> Server | bath temps + dip times + crane state AUTO (preset recipe) |
| 3 Lab | STP lab (titration) | Tablet / server | bath analysis: TA/FA/pH/HCl%/Fe%/coating - MANUAL, per bath-testing WI |
| 4 Confirm | Server (live API) | Tablet | confirm lot, surface finish, chemical additions; band-check bath temp/time vs recipe; break-down note |
| 5 Assemble | Server rollups | Sheets (views) | STP-01A monitoring + bath history + coating assemble |
| 6 Write-back (later) | Server | Dynamics 365 BC + next process | treated qty; release to draw bench |
| Note | - | - | Phosphate is for draw lubrication only. STP is re-entered between draw passes to re-lubricate. |

## Required Documents

| Ref | Document / item needed | Why it matters | Status / owner |
| --- | --- | --- | --- |
| D-1 | GLI-FT-STP-01A Production cum Monitoring | Sheet 1 (bath temps/times + analysis) | RESOLVED - received (R3) |
| D-2 | GLI-FT-PRD-STP-04B Bath History Card | Sheet 2 (change frequency) | RESOLVED - received (R2) |
| D-3 | GLI-FT-PRD-STP-06 Coating Weight | Sheet 3 (phosphate g/m2) | RESOLVED - received (R0) |
| D-4 | GLI-ST-PRD-STP-02 shift check sheet | Start-of-shift STP checks | Pending - Goodluck |
| D-5 | STP ET200S / TP700 tag map (O-2) | Which bath-temp/dip-time/crane tags; OPC UA on TP700 | Pending - tag survey (connect in progress) |
| D-6 | GLI-WI-PRD59-STP-02 bath-testing methods | How each titration is done (already have doc) | In hand |
| D-7 | Chemical spec sheets (G-390, GV-6521, 3510E/A, G-21, G-3005, Bondrite) | Bath make-up + acceptance ranges | Pending - Goodluck |

## Extra / supporting sheets

### PLC Connectivity (1 rows)

| Machine | Controller / PLC | Model | Comms | Read protocol / driver | Ease | Status | What it yields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STP line | Siemens SIMATIC ET 200S (IM151 CPU) | + HMI TP700 Comfort (6AV2 124-0GC01-0AX0) | Ethernet + Siemens SCADA | S7comm on CPU (Snap7) OR OPC UA from TP700 Comfort panel | Easy | In progress (survey) | tank temps, dip times, wagon/crane state |

### Bath Table (spec) (12 rows)

| Stage / bath | Spec temp | Spec time | Chemical | Bath analysis (spec) |
| --- | --- | --- | --- | --- |
| Coolant | - | - | - | - |
| Degreasing | 75-85 C | 10-15 min | GARDOCLEAN G-390 | TA 78-90 ml |
| De-scaling / HCl pickling | ambient | 8-13 min | HCl | HCl con 6-22 %; Fe 10 % max; top-up HCl 30% min |
| Water rinse (1-4) | - | - | water | 1 deg 7-10 pH; 2 acid 2-5; 3 acid 5-7; 4 phos 5-8 pH |
| Activation | - | - | GARDOCLEAN-V 6521 | pH 7-8 |
| Phosphating | 65-75 C | 6-11 min | 3510E / 3510A (GB-14) | TA 32-38; FA 4-6; ACC 3-5; OXTA 18-22 ml |
| Neutralizer | 50-60 C | 1 flash dip | GARDOCLEAN 21 | pH 8-10 |
| Lubrication | 70-75 C | 7-12 min | GARDOLUBE 3005 | con 4-6 %; FA 0-1.0 %; pH 8-10 |
| Dryer (Thermopac) | 80-120 C | 12-17 min | - | - |
| Reactive oil (oil route) | ambient | 8-10 min | Bondrite LR 06021 | water 1-2 %; acid no 100-200 |
| Neutralizer (oil route) | - | - | Gardoline-R 1683 | pH 6.5-7.5 |
| Phosphate coating (STP-06) | - | weekly | - | 4.0-8.0 g/m2 (2 samples) |

### Bath History (STP-04B) (11 rows)

| Bath | Min. change frequency | Capture |
| --- | --- | --- |
| Coolant | 1 month +/- 10 days | planned vs executed calendar (STP-04B) |
| Degreasing | 1 month +/- 10 days |  |
| Water rinse | 10 days +/- 3 days |  |
| Pickling-1 / Pickling-2 | 10 days +/- 5 days |  |
| Water rinse-2 HCL-1 / rinse-3 HCL-2 | 10 days +/- 3 days |  |
| Activation | 2 days +/- 1 day | most frequent |
| Phosphate | 10 days +/- 5 days |  |
| Water rinse-Phosphate | 10 days +/- 3 days |  |
| Neutralizer | 10 days +/- 3 days |  |
| Lube | 30 days +/- 10 days |  |
| Reactive oil (oil STP) | clean / filter at 100 MT |  |

---

# DrawBench

**File:** `Zedral_A59_DrawBench_M1_Data_Mapping.xlsx`
**Sheets (10):** `Cover & Legend`, `Sheet Map`, `Field Register`, `ERP-WO Fields`, `PLC Connectivity`, `Bench Capability (Table-C)`, `Special Controls (Table-A)`, `Paint & Swaging`, `Data Flow`, `Required Documents`
**Field Register count:** **58**

## Capture class counts

- **MANUAL**: 35 _(fill: FFFCE7C9)_
- **DERIVED**: 17 _(fill: FFD6E3F0)_
- **AUTO**: 4 _(fill: FFD6EAD6)_
- **MASTER**: 1 _(fill: FFE4E4E7)_
- **SYSTEM**: 1 _(fill: FFEADCF2)_

## Target tables / child entities

- `txn.prod_db_lot` — **24** fields: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09, PR-01, PR-02, PR-03, PR-04, PR-05, PR-06, PR-07, PR-08, PR-09, PR-10, PR-11, PR-12, PR-13, PR-14, PR-19
- `txn.db_shift_check` — **7** fields: MC-01, MC-02, MC-03, MC-04, MC-05, MC-06, MC-07
- `txn.db_inspection` — **4** fields: PR-15, PR-16, PR-17, PR-18
- `txn.db_tooling_issue` — **7** fields: IS-01, IS-02, IS-03, IS-04, IS-05, IS-06, IS-07
- `master.db_tooling` — **2** fields: DP-01, DP-02
- `txn.db_tooling_usage` — **6** fields: DP-03, DP-04, DP-05, DP-06, DP-07, DP-08
- `txn.prod_db_swage` — **8** fields: SW-01, SW-02, SW-03, SW-04, SW-05, SW-06, SW-07, SW-08

## Sheet / form groups

- **Lot header** — 9: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09
- **5 Machine check** — 7: MC-01, MC-02, MC-03, MC-04, MC-05, MC-06, MC-07
- **1 Production report** — 19: PR-01, PR-02, PR-03, PR-04, PR-05, PR-06, PR-07, PR-08, PR-09, PR-10, PR-11, PR-12, PR-13, PR-14, PR-15, PR-16, PR-17, PR-18, PR-19
- **2 Issue slip** — 7: IS-01, IS-02, IS-03, IS-04, IS-05, IS-06, IS-07
- **3 Die history** — 8: DP-01, DP-02, DP-03, DP-04, DP-05, DP-06, DP-07, DP-08
- **4 Swaging** — 8: SW-01, SW-02, SW-03, SW-04, SW-05, SW-06, SW-07, SW-08

## Cover & Legend

- **ZEDRAL  .  A-59 DRAW BENCH + SWAGING  .  M1 DATA MAPPING**
- **Goodluck India Limited . Sikandrabad . Cold-draw + swaging (A-51 / A-59 / A59-LDP) . v1.0**
- **Purpose**: Data mapping for M1 on the draw bench and swaging stages, same method as the tube-mill book: every shop-floor sheet field mapped to its digital field, capture class, source and target.
- **Contrast with tube mill**: The draw bench is a batch, multi-machine, operator-recorded (L1) process. There is no continuous hourly parameter sheet and no auto downtime sheet. Draw speed is fixed by motor rpm, not logged. Dimensions are measured by hand.
- **The sheets**: Machine check sheet (start of shift), Production + 1st-off/last-off inspection report, Die and plug history card, Swaging production report. Plus reference tables A (special controls), B (paint colour), C (bench capability).
- **Multi-pass**: Drawing is a repeated cycle: Furnace, STP, Swage, Draw bench, Centreless straighten, repeated for 1st / 2nd / 3rd draw to final size. Capture keys on lot + work order + draw pass.
- **PLC reality**: Draw-bench PLCs (DB-01..07) give production count, cycle time, pulling load and motor rpm only. Quality (OD/ID/THK/surface) stays MANUAL measurement. Connect DB-05/06/07 first (Ethernet-native).
- **Update 20 Sep 2026**: Formats folder received. The production report is GLI-FT-PRD-DRW-01 (DB-FT-01, R6) with FROM/TO dims and accepted/rejected/drawn-meter; die history is DRW-03; a die & plug issue slip DRW-08 and swaging reports SWG-FT-01/02 are now in hand. Only the machine check sheet DRAW-07 is still missing.
- **LEGEND . capture class**
- **AUTO**: Machine reports it (bench PLC counter / load / cycle). No typing.
- **DERIVED**: Pre-filled from the work order (ERP) or a master table. Operator confirms.
- **MANUAL**: Operator measures or judges it (most draw-bench fields).
- **MASTER**: One-time reference / master data (capacity, swage-end, pointing set).
- **SYSTEM**: Generated by the platform (ids, rollups).
- **Tabs**: Sheet Map | Field Register | ERP-WO Fields | PLC Connectivity | Bench Capability (Table-C) | Special Controls (Table-A) | Paint & Swaging | Data Flow | Required Documents
- **Source docs**: GLI-WI-PRD-DRW-01 R13 (drawing); GLI-WI-PRD-SWG-01 R04 (swaging); GLI-WI-QA-13 (ID); A-59 PLC survey (DB-01..07).
- **Note**: GLI-FT-PRD-DRAW-07 (check sheet) and GLI-FT-PRD-DRW-02 (production/1st-off report) formats are referenced in the WI but not yet shared as separate files; fields below are read from the WI. Table-C main grid is a merged-cell scan; confirm exact splits on the hard copy.
- **Field counts**
- **AUTO**: =COUNTIF('Field Register'!$H$4:$H$61,"*AUTO*")
- **DERIVED**: =COUNTIF('Field Register'!$H$4:$H$61,"*DERIVED*")
- **MANUAL**: =COUNTIF('Field Register'!$H$4:$H$61,"*MANUAL*")
- **MASTER**: =COUNTIF('Field Register'!$H$4:$H$61,"*MASTER*")
- **SYSTEM**: =COUNTIF('Field Register'!$H$4:$H$61,"*SYSTEM*")
- **Total fields**: =COUNTA('Field Register'!$A$4:$A$61)

## Sheet Map

| Plant sheet | Format / doc no. | Rev | In hand? | Nature | Digital target table(s) | Capture summary |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Production + inspection report | GLI-FT-PRD-DRW-01 Draw Bench Production Report (DB-FT-01) | R6 | Yes (now in hand) | Per lot / bench | txn.prod_db_lot | FROM/TO OD-ID-TH-LEN, inter/final, accepted/rejected/drawn meter, breakdown; dims MANUAL, count/load AUTO if bench PLC |
| 2. Die & plug issue slip | GLI-FT-PRD-DRW-08 (DB-FT-08) | R3 | Yes (now in hand) | Per die/plug issue | txn.db_tooling_issue | Die/plug code, stage, size per history, actual OD at 1st off, condition; MANUAL |
| 3. Die history card | GLI-FT-PRD-DRW-03 (DB-FT-03) | R4 | Yes (now in hand) | Per die instance | master.db_tooling + txn.db_tooling_usage | OD at previous drawn size, tubes produced, input size, polishing, oversized; MANUAL |
| 4. Swaging production report | GLI-FT-PRD-SWG-01 (SWG-FT-01) / SWG-FT-02 | R1 / R0 | Yes (now in hand) | Per lot | txn.prod_db_swage | Swaging die used, draw size, tag length & length after die, quantity; MANUAL |
| 5. Machine check sheet (start of shift) | GLI-FT-PRD-DRAW-07 | - | Still referenced, not shared | Per shift start | txn.db_shift_check | Operator checks MANUAL; only remaining format gap |
| Drawing Work Instruction | GLI-WI-PRD-DRW-01 | R13 | Yes | Process logic + tooling mgmt | - | Tables A/B/C embedded |
| Swaging Work Instruction | GLI-WI-PRD-SWG-01 | R04 | Yes | Swage-end + pointing sets | - | Capacity charts A51/A59/LDP |
| Identification & Traceability | GLI-WI-QA-13 | R11 | Yes | Tag + coil/lot id | - | tag colour by grade/stage |

## COMPLETE Field Register

| Field ID | Sheet | Paper field | Canonical field (DB) | Target schema.table | Type | Unit | Class | Source | Req | Validation / rule | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DB-01 | Lot header | Lot / run id | lot_no | txn.prod_db_lot | text | - | SYSTEM | bench + ts | Y | unique per tenant |  |
| DB-02 | Lot header | W.O. No | work_order_no | txn.prod_db_lot | text | - | DERIVED | work order (BC) | Y | - | from PPC |
| DB-03 | Lot header | Customer | customer_code | txn.prod_db_lot | text | - | DERIVED | work order | N | FK master.customer |  |
| DB-04 | Lot header | Grade / source | grade_code | txn.prod_db_lot | text | - | DERIVED | work order / tube | Y | FK master.grade | paint colour per Table-B |
| DB-05 | Lot header | Tube size ordered (OD/ID/THK/Len) | size (jsonb) | txn.prod_db_lot | json | mm | DERIVED | work order / customer drawing | Y | profile round/oval/rect/square |  |
| DB-06 | Lot header | Draw bench No (machine) | bench_code | txn.prod_db_lot | text | - | DERIVED | load plan (Table-C) | Y | FK master.machine | assigned by capacity |
| DB-07 | Lot header | Draw pass | draw_pass | txn.prod_db_lot | enum | - | MANUAL | operator | Y | 1ST\|2ND\|3RD | multi-pass cycle |
| DB-08 | Lot header | Incoming tube ref (from mill/STP) | input_tube_ref | txn.prod_db_lot | text | - | DERIVED | route card / journey | Y | - | genealogy |
| DB-09 | Lot header | Shift / date | shift_ref / prod_date | txn.prod_db_lot | text | - | DERIVED | shift context | Y | FK master.shift |  |
| MC-01 | 5 Machine check | Machine cleanliness | clean_ok | txn.db_shift_check | bool | - | MANUAL | operator | Y | - |  |
| MC-02 | 5 Machine check | Die & plug selected/condition/fitment | die_plug_ok | txn.db_shift_check | bool | - | MANUAL | operator (issue slip) | Y | verify OD & condition before fix |  |
| MC-03 | 5 Machine check | Machine lubrication ok | lube_ok | txn.db_shift_check | bool | - | MANUAL | operator | Y | - |  |
| MC-04 | 5 Machine check | Air / hydraulic pressure sufficient | pressure_ok | txn.db_shift_check | bool | - | MANUAL | operator | Y | - | AUTO if bench PLC pressure tag |
| MC-05 | 5 Machine check | Incoming tube lubrication condition | input_lube_ok | txn.db_shift_check | text | - | MANUAL | operator | Y | thin uniform soap/oil from STP | reject to STP if non-uniform |
| MC-06 | 5 Machine check | Draw speed setting (motor rpm) | draw_speed_set | txn.db_shift_check | number | - | MASTER | motor rpm (fixed) | N | by motor capacity | not continuously logged |
| MC-07 | 5 Machine check | Abnormal noise / vibration check | noise_ok | txn.db_shift_check | bool | - | MANUAL | operator | Y | stop + inform SIC if abnormal |  |
| PR-01 | 1 Production report | DB No (bench) | bench_code | txn.prod_db_lot | text | - | DERIVED | load plan | Y | FK master.machine | GLI-FT-PRD-DRW-01 |
| PR-02 | 1 Production report | Operator name | operator_ref | txn.prod_db_lot | text | - | MANUAL | operator | Y | - |  |
| PR-03 | 1 Production report | Work order / grade / customer | work_order_no / grade / customer | txn.prod_db_lot | text | - | DERIVED | work order | Y | - |  |
| PR-04 | 1 Production report | Final size (OD/ID/TH/LEN) | final_size | txn.prod_db_lot | json | mm | DERIVED | work order | Y | - |  |
| PR-05 | 1 Production report | FROM size (incoming OD/TH/LEN) | from_size | txn.prod_db_lot | json | mm | MANUAL | operator measure | Y | 1st-off incoming | record |
| PR-06 | 1 Production report | TO size (drawn OD/ID/TH/LEN) | to_size | txn.prod_db_lot | json | mm | MANUAL | operator measure | Y | per WO tolerance | 1st-off drawn |
| PR-07 | 1 Production report | Draw plan length | draw_plan_len_mm | txn.prod_db_lot | number | mm | DERIVED | work order | N | >0 |  |
| PR-08 | 1 Production report | Inter / Final stage | stage | txn.prod_db_lot | enum | - | MANUAL | operator | Y | INTER\|FINAL | draw pass |
| PR-09 | 1 Production report | Accepted qty (Nos / MT) | accepted_nos / accepted_mt | txn.prod_db_lot | number | pcs,MT | MANUAL | operator count | Y | >=0 | AUTO count if bench PLC |
| PR-10 | 1 Production report | Rejected qty (Nos) | rejected_nos | txn.prod_db_lot | int | pcs | MANUAL | operator | N | >=0 | set-up tubes to reject bin |
| PR-11 | 1 Production report | Drawn meter | drawn_meter | txn.prod_db_lot | number | m | AUTO | bench PLC if wired | N | - | throughput |
| PR-12 | 1 Production report | Draw / pulling load | pull_load | txn.prod_db_lot | number | ton | AUTO | bench PLC if wired | N | - | DB-05/06/07 easiest |
| PR-13 | 1 Production report | Cycle time | cycle_time_s | txn.prod_db_lot | number | s | AUTO | bench PLC if wired | N | - | throughput / OEE |
| PR-14 | 1 Production report | Break down / remarks | breakdown_remark | txn.prod_db_lot | text | - | MANUAL | operator | N | - | embedded downtime note |
| PR-15 | 1 Production report | Ovality / circularity / concentricity | form_dev | txn.db_inspection | number | mm | MANUAL | operator / QA | N | critical -> cross-verify QA | WI 1st-off |
| PR-16 | 1 Production report | Surface finish (visual) / Ra | surface / ra_value | txn.db_inspection | text | - | MANUAL | operator / lab | N | Ra: 100 mm sample to lab |  |
| PR-17 | 1 Production report | Re-first-off trigger | refirstoff_flag | txn.db_inspection | bool | - | MANUAL | operator | N | >2 hr same material; shift/lot/operator change | Table-A |
| PR-18 | 1 Production report | Last-off result | last_off_result | txn.db_inspection | enum | - | MANUAL | operator | Y | fail -> HOLD, NC | keep 1st/last-off samples |
| PR-19 | 1 Production report | Tag (size/customer/grade) forward | tag_no | txn.prod_db_lot | text | - | MANUAL | operator | Y | per GLI-WI-QA-13 | release to next process |
| IS-01 | 2 Issue slip | Tube size to draw (OD/ID/THK) | issue_size | txn.db_tooling_issue | json | mm | DERIVED | work order | Y | - | GLI-FT-PRD-DRW-08 |
| IS-02 | 2 Issue slip | Die code | die_code | txn.db_tooling_issue | text | - | MANUAL | tool room | Y | FK master.db_tooling |  |
| IS-03 | 2 Issue slip | Stage for use (final/inter) | stage | txn.db_tooling_issue | enum | - | MANUAL | operator | Y | FINAL\|INTER |  |
| IS-04 | 2 Issue slip | Die size (per history card) | die_size_mm | txn.db_tooling_issue | number | mm | DERIVED | history card | Y | - |  |
| IS-05 | 2 Issue slip | Tube OD actual at 1st off | actual_od_1stoff | txn.db_tooling_issue | number | mm | MANUAL | operator | Y | - |  |
| IS-06 | 2 Issue slip | Die condition | die_condition | txn.db_tooling_issue | text | - | MANUAL | operator | Y | no score/scratch/crack |  |
| IS-07 | 2 Issue slip | Plug stage / size / condition | plug_stage_size_cond | txn.db_tooling_issue | mixed | mm | MANUAL | operator | Y | actual at issue |  |
| DP-01 | 3 Die history | Die code / history card no | die_code | master.db_tooling | text | - | MANUAL | tool room | Y | - | GLI-FT-PRD-DRW-03 |
| DP-02 | 3 Die history | Received date / supplier / OD req | received / supplier / od_req | master.db_tooling | mixed | mm | MANUAL | tool room | Y | receiving inspection |  |
| DP-03 | 3 Die history | Date (each use) | use_date | txn.db_tooling_usage | date | - | MANUAL | operator | Y | - |  |
| DP-04 | 3 Die history | OD observation at previous drawn tube size | prev_draw_od | txn.db_tooling_usage | number | mm | MANUAL | operator measure | Y | within tube OD + tol | bearing size |
| DP-05 | 3 Die history | No. of tubes produced | tubes_produced | txn.db_tooling_usage | int | pcs | AUTO | counter if wired else MANUAL | Y | - | tooling life |
| DP-06 | 3 Die history | Input tube size | input_size_mm | txn.db_tooling_usage | number | mm | DERIVED | lot / route | N | - |  |
| DP-07 | 3 Die history | Die polishing | die_polish | txn.db_tooling_usage | text | - | MANUAL | operator | N | 220 grit + D3 diamond |  |
| DP-08 | 3 Die history | Die oversized / disposition | oversized / disposition | txn.db_tooling_usage | text | - | MANUAL | operator | N | reject to supplier if oversized |  |
| SW-01 | 4 Swaging | M/C No (HYD / PUSH / rotary) | swg_machine | txn.prod_db_swage | text | - | MANUAL | operator | Y | HYD-1/2, PUSH-1/2 | GLI-FT-PRD-SWG-01/02 |
| SW-02 | 4 Swaging | Work order / customer / grade | work_order_no / customer / grade | txn.prod_db_swage | text | - | DERIVED | work order | Y | - |  |
| SW-03 | 4 Swaging | Size (OD/ID/THK/LEN) | size | txn.prod_db_swage | json | mm | DERIVED | work order | Y | - |  |
| SW-04 | 4 Swaging | Swaging die used | swg_die | txn.prod_db_swage | text | - | MANUAL | operator | Y | push-pointer/hydraulic(2pc)/rotary(4pc) | crack -> reject full set |
| SW-05 | 4 Swaging | Draw size (next) | draw_size | txn.prod_db_swage | json | mm | DERIVED | draw plan | Y | - | size to be drawn next |
| SW-06 | 4 Swaging | Total tag length & length after die | tag_len / len_after_die | txn.prod_db_swage | number | mm | MANUAL | operator (scale) | Y | min swage-end by tonnage | 10/20T=80+/-10; 40/80T=100+/-10; 120T=120+/-10; LDP 190-225 |
| SW-07 | 4 Swaging | Quantity | pieces | txn.prod_db_swage | int | pcs | MANUAL | operator | Y | >=0 |  |
| SW-08 | 4 Swaging | Tag re-applied to swaged lot | tag_no | txn.prod_db_swage | text | - | MANUAL | operator | Y | - | carry lot identity |

## ERP / WO Fields

| ERP / WO field | Canonical field | Target table | Read now (plan) | Write back (later) | Notes |
| --- | --- | --- | --- | --- | --- |
| Work order number | work_order_no | txn.prod_db_lot | Yes | - | from PPC to draw |
| Customer | customer_code | txn.prod_db_lot | Yes | - |  |
| Grade / source | grade_code | txn.prod_db_lot | Yes | - | drives paint colour (Table-B) |
| Tube size ordered (OD/ID/THK/Length) | size (jsonb) | txn.prod_db_lot | Yes | - | or customer drawing |
| Profile / special dims (oval/rect/square, CC) | spec_ref | txn.db_inspection | Yes | - | customer drawing / control plan |
| Draw plan (number-wise per bench capacity) | bench_code / draw_pass | txn.prod_db_lot | Yes | - | distribute load per Table-C |
| Incoming tube ref (from mill / STP) | input_tube_ref | txn.prod_db_lot | Yes | - | route card genealogy |
| Die / plug issue (tool room) | die_id / plug_id | master.db_tooling | Yes | - | issue slip |
| Route / next operation | route_ref | (genealogy) | Yes | - | straightening, cutting, honing |
| Produced / drawn quantity (actuals) | pieces | txn.prod_db_lot | - | Yes | write-back phase |
| Disposition (OK / HOLD / reject) | disposition | txn.db_inspection | - | Yes | write-back phase |
| Dispatch / lot tags | tag_no | txn.prod_db_lot | - | Yes | packing/dispatch phase |

## Data Flow

| Step | Source | To | What moves |
| --- | --- | --- | --- |
| 1 Plan | Dynamics 365 BC (ERP) | Draw plan | WO, customer, grade, tube size / drawing; distribute load per Table-C capacity |
| 2 Setup | Tool room + STP | Bench | die & plug issue slip (verify OD & condition); confirm incoming tube lubrication from STP |
| 3 Draw | Draw bench (motor rpm fixed) | Operator | operator measures 1st-off OD/ID/THK/surface, records Min/Max; sets to reject bin if not OK |
| 4 Machine (optional) | Bench PLC (DB-05/06/07 Ethernet) | Collector -> Server | piece count, cycle time, pulling load, motor rpm (throughput / OEE only) |
| 5 Confirm / measure | Server (live API) | Tablet | 1st-off / last-off dims, die-plug history, swage-end length, HOLD / NC, special controls (Table-A) |
| 6 Assemble | Server rollups | The sheets (views) | machine check, production + inspection, die & plug history, swaging report assemble themselves |
| 7 Traceability / write-back | Server | Next process + ERP | tag lot (size/customer/grade) forward; drawn qty + disposition write-back later |
| Contrast | - | - | Draw bench is L1 (operator-recorded) first; PLC augments with counts/cycle/load only; quality stays manual. Multi-pass: same tube cycles Furnace -> STP -> Swage -> Draw -> Centreless per pass. |

## Required Documents

| Ref | Document / item needed | Why it matters | Status / owner |
| --- | --- | --- | --- |
| D-1 | GLI-FT-PRD-DRW-01 Production Report (DB-FT-01) | Sheet 1 (FROM/TO dims, accepted/rejected) | RESOLVED - received (R6) |
| D-2 | GLI-FT-PRD-DRW-08 Die & Plug Issue Slip | Die/plug issue + 1st-off OD | RESOLVED - received (R3) |
| D-3 | GLI-FT-PRD-DRW-03 Die History Card | Tooling life | RESOLVED - received (R4) |
| D-4 | GLI-FT-PRD-SWG-01 / SWG-FT-02 Swaging reports | Swage-end + tag length | RESOLVED - received (R1/R0) |
| D-4b | GLI-FT-PRD-DRAW-07 machine check sheet | Start-of-shift checks (only remaining format gap) | Pending - Goodluck |
| D-5 | Table-C exact MH vs finished split (DB-45/80/120) | Capacity assignment accuracy | Confirm hard copy |
| D-6 | DB PLC tag / register maps (DB-05/06/07 first) | Decides which counts/load/cycle are AUTO | Pending - tag survey |
| D-7 | Customer drawings / critical dimension specs | Ovality, circularity, concentricity, Ra, CC items | Pending - Goodluck QA |
| D-8 | ID mandrel / plug gauge list per critical size | ID acceptance for critical tubes | Pending - Goodluck |
| D-9 | Straightening + cutting/chamfering/honing WIs | Downstream stages referenced in Table-A | Pending - Goodluck |
| D-10 | Route card + tag colour scheme (GLI-WI-QA-13) | Release to next operation + genealogy | Partial |

## Extra / supporting sheets

### PLC Connectivity (7 rows)

| Bench | Controller / PLC | Model | Comms (as installed) | Read protocol / driver | Ease | Connect status | What it yields (no quality data) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DB-01 | Fatek (FBs series) | (confirm) | Serial RS-232/485 (Ethernet if module) | Modbus RTU/TCP (WinProladder to map) | Medium | Not connected | pull load, cycle time, counts |
| DB-02 | Siemens S7-200CN | (confirm) | PPI / RS-485 serial (legacy) | PPI / Modbus RTU / CP243-1 (Micro/WIN v4) | Hard | Flagged connectable | counts, cycle, load |
| DB-03 | Siemens S7-200CN | (confirm) | PPI / RS-485 serial | PPI / Modbus RTU / CP243-1 | Hard | Flagged connectable | counts, cycle, load |
| DB-04 | Siemens S7-200CN | (confirm) | PPI / RS-485 serial | PPI / Modbus RTU / CP243-1 | Hard | Flagged connectable | counts, cycle, load |
| DB-05 | Siemens S7-200 SMART | CPU ST40 (6ES7 288-1ST40) | Built-in Ethernet | Snap7 / Modbus TCP (Micro/WIN SMART) | Easy | Not connected | counts, cycle, load, motor rpm |
| DB-06 | Siemens ET200S (IM151) + KTP700 Basic | 6AV2 123-2GB03 (HMI) | Ethernet | S7comm on CPU via Snap7 (read CPU, not panel) | Easy | Not connected | counts, cycle, load |
| DB-07 | Siemens S7-200 SMART + Exor eSMART07M | EM DT08 6ES7 288-2DT08 | Built-in Ethernet | Snap7 / Modbus TCP or OPC UA via Exor | Easy | Flagged connectable | counts, cycle, load |

### Bench Capability (Table-C) (8 rows)

| Draw bench | Pulling load (TON) | Mother hollow OD (mm) | Mother hollow THK (mm) | Finished OD (mm) | Finished THK (mm) | col_7 |
| --- | --- | --- | --- | --- | --- | --- |
| DB-10 TON | 10 | 11 to 38.10 | 0.89 to 2.50 | 6.50 to 25.40 | 0.70 to 2.00 |  |
| DB-20 TON | 20 | 22.23 to 44.45 | 1.4 to 5.80 | 12.7 to 60.30 | 0.80 to 5.00 |  |
| DB-40 TON | 40 | 28.58 to 88.9 | 2.00 to 6.40 | 38.10 to 76.20 | 1.00 to 6.40 |  |
| DB-45 TON (3 tube) | 45 | 25.40 to 50.80 | 2.00 to 3.00 | confirm (scan) | 2.00 to 3.60 |  |
| DB-80 TON | 80 | 38.1 to 127 | 2.00 to 7.5 | 50.80 to 114.30 | confirm (scan) |  |
| DB-120 TON | 120 | 63.50 to 114.30 | 7.50 to 9.50 | 7.00 to 9.00 | confirm (scan) |  |
| DB-180 TON (LDP) | 180 | 88.9 to 168.3 | 4 to 13 | 63.5 to 140 | 3 to 12.7 |  |
| DB-250 TON (LDP) | 250 | 88.9 to 219.1 | 4 to 15 | 63.5 to 212.0 | 3 to 14 |  |

### Special Controls (Table-A) (5 rows)

| Control type | New size / 1st production (critical dim) | 4M / engineering change lot (major) | First 3 supply / customer concern | Mass production | Shift change / power failure |
| --- | --- | --- | --- | --- | --- |
| First-off inspection (draw bench, straightening, cutting & chamfering): OD/ID/THK/LEN + visual surface | 3 sample/lot/size (two first-off at start & middle, one last-off) | 1 sample/lot/size (first off) | 2 sample/lot/size (first off & last off) | 2 sample/lot/size (first off & last off) | 1 sample/lot/size (first off at shift change & after power failure or any restart) |
| Mechanical properties (critical requirements) | 1 sample (first off) | X | 2 sample (first off & last off) | 1 sample (first off) | X |
| Roughness testing | 1 sample (first off) | X | 2 sample (first off & last off) | 1 sample (first off) | X |
| Deformation at defined load & other CSR | 1 sample (first off) | X | 2 sample (first off & last off) | 1 sample (first off) | X |
| Special / critical characteristics (CC item) | 1 sample (first off) | X | 2 sample (first off & last off) | 1 sample (first off) | X |

### Paint & Swaging (24 rows)

| Group | Item | Value / rule |
| --- | --- | --- |
| Paint colour (Table-B) | 1008 / 1010 | White |
| Paint colour (Table-B) | 1020 | Yellow |
| Paint colour (Table-B) | 1026 | Smoke grey |
| Paint colour (Table-B) | St 52 | Pink |
| Paint colour (Table-B) | BSK 46 | Brown |
| Paint colour (Table-B) | CORTON | Blue |
| Paint colour (Table-B) | SAE-1541 | Light blue + white |
| Paint colour (Table-B) | SPL-K3 | Orange |
| Paint colour (Table-B) | GRADE-50 | Light pink + white |
| Paint colour (Table-B) | OPEN + JOINT tube | Red |
| Paint colour (Table-B) | Any rejected tubes | Red |
| Paint colour (Table-B) | Application | Side wraps of coil + one side of tube OD; tags per GLI-WI-QA-13 |
| Min swage-end length | DB-10T & DB-20T | 80 +/- 10 mm |
| Min swage-end length | DB-40T & DB-80T | 100 +/- 10 mm |
| Min swage-end length | DB-120T | 120 +/- 10 mm |
| Min swage-end length | DB-180T & DB-250T (LDP) | 190 to 225 mm |
| Swaging rule | Measure & record | Measure swage length by scale on 1st tube; if excess/less reset; write swage-end length in production report |
| Die types | Push-pointer / Hydraulic (2-piece) / Rotary (4-piece) | Crack in any piece -> reject full die set; ear plugs required |
| Pointing set (LDP, 1st/2nd/3rd push mm) | 63.5 | 54 / 49 / 45 |
| Pointing set (LDP) | 101.6 | 86 / 78 / 72 |
| Pointing set (LDP) | 114.3 | 103 / 96 / 90 |
| Pointing set (LDP) | 127 | 118 / 112 / 109 |
| Pointing set (LDP) | 139.7 | 130 / 123 / 120 |
| Pointing set note | Full A51 / A59 / A59-LDP charts | In swaging WI; several sizes; confirm remaining rows on controlled copy (scan) |
