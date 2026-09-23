# ZEDRAL — Multi-Furnace Operator Console Implementation Prompt

## Purpose

Implement a new **Furnace / Roller-Hearth Furnace (RHF) operator workflow** in the Zedral factory application.

The Furnace workflow must work **similarly to the existing Annealing operator workflow** in terms of:

- operator shell
- navigation
- orders queue
- production capture
- history
- stoppage handling
- shift context
- API patterns
- validation
- export/reporting
- reusable UI components

However, **do not treat Furnace as the existing ANN process internally**.

The A-59 furnace is a **continuous Roller-Hearth Furnace (RHF)** with multiple furnaces and a different production data model. The implementation must support multiple furnace machines such as:

- `RHF-03`
- `RHF-04`
- `RHF-05`

The architecture must allow additional furnaces later without rewriting the UI or database model.

---

# 1. SOURCE-OF-TRUTH AND CROSS-CODEBASE RULE

IMPORTANT:

**The existing ANN implementation is in a DIFFERENT CODEBASE.**

Therefore, the ANN code is a **reference implementation only**. It is NOT part of this repository and must NOT be imported, copied blindly, linked as a dependency, or assumed to exist locally.

Use the supplied ANN documentation/specification to understand the intended operator UX and process patterns.

Before changing code, inspect the CURRENT Furnace repository first.

Primary sources for this Furnace repository:

1. `Zedral_A59_Furnace_M1_Data_Mapping.xlsx`
2. `ZEDRAL_FURNACE_PROCESS_IMPLEMENTATION_PLAN.md`
3. The existing code in the CURRENT Furnace repository.
4. The existing generic operator components already available in the CURRENT repository.
5. The existing order/planning/production architecture in the CURRENT repository.
6. The actual Furnace Production Report (`ANN-FT-01`) reference.

The ANN codebase is only a behavioral/UI reference.

Do not assume any ANN file such as:

```text
AnnChargePage.tsx
AnnChargeBoard.tsx
AnnBaseCard.tsx
AnnBatchingWorkspace.tsx
annSchema
txn.ann_charge
```

exists in this repository.

If equivalent generic components exist locally, reuse those.

If they do not exist, implement the required Furnace behavior using the conventions of THIS repository.

Do not invent fields when a field exists in the Furnace mapping workbook.

The workbook identifies the Furnace as a Roller Hearth Furnace and identifies the current A-59 furnace list as `RHF-03 | RHF-04 | RHF-05`.

---

# 2. IMPORTANT ARCHITECTURAL DECISION

## Furnace is a new process in THIS codebase

Create/use a dedicated process code:

```text
FUR
```

Do NOT create an ANN dependency.

The ANN application is a different codebase and is only being used as a reference for:

- operator UX
- navigation pattern
- production workflow
- status presentation
- capture interaction
- history pattern
- stoppage pattern
- reusable design ideas

The A-59 Furnace itself is:

```text
furnace → running order → lot → continuous production reading
```

Therefore:

```text
ANN REFERENCE
     ↓
understand UX/process pattern
     ↓
CURRENT FURNACE CODEBASE
     ↓
implement using LOCAL architecture
     ↓
FUR-specific data model
```

Do not modify or depend on the external ANN codebase.

Do not copy ANN database tables.

Do not copy ANN-specific business concepts such as:

```text
Base
Charge
Annealing Batch
Roster
Bell-furnace stages
```

unless the Furnace requirements independently require an equivalent concept.

All Furnace-specific logic should use:

```ts
processCode === 'FUR'
```

or the equivalent process architecture already present in THIS repository.

---

# 3. CORE PRODUCT MODEL

The Furnace workflow should use these concepts.

## Furnace

A physical RHF machine.

Example:

```text
RHF-03
RHF-04
RHF-05
```

Each furnace has its own:

- current status
- current running order
- current lot
- line speed
- zone temperatures
- production quantity
- gas/atmosphere information
- stoppage state

## Running Order

The production order currently assigned/running on a furnace.

The operator must NOT manually type customer/order/specification when that information already exists in the active order.

The running order should populate production identity fields automatically.

## Lot

A production lot/run under the work order.

One work order may produce multiple lots/runs.

## Reading

A production/process reading captured for a running furnace lot.

## Furnace Status

Use a clear machine status model such as:

```text
IDLE
PREPARING
RUNNING
STOPPAGE
COMPLETE
```

Do not create unnecessary statuses unless the existing application already requires them.

---

# 4. MULTI-FURNACE REQUIREMENT

This is a mandatory requirement.

The UI must not assume there is only one furnace.

The main Furnace screen should show a **Furnace Board / Furnace Cards**.

Example:

```text
┌──────────────────────┐
│ RHF-03               │
│ RUNNING              │
│ WO: 45001234         │
│ Customer: ABC        │
│ Grade: XXXX          │
│ 6 zones              │
│ Speed: 32.5 m/hr     │
│ [OPEN]               │
└──────────────────────┘

┌──────────────────────┐
│ RHF-04               │
│ IDLE                 │
│ No active order      │
│                      │
│ [ASSIGN ORDER]       │
└──────────────────────┘

┌──────────────────────┐
│ RHF-05               │
│ STOPPAGE             │
│ WO: 45001241         │
│ Reason: Maintenance  │
│ [OPEN]               │
└──────────────────────┘
```

The number of cards must come from the configured furnace master/station list.

Do NOT hardcode three cards into the component.

---

# 5. FURNACE MASTER / MACHINE CONFIGURATION

Use machine/master configuration for furnace identity.

At minimum:

```text
machine_code
machine_name
process_code
furnace_type
gas_type
enabled
display_order
```

Current A-59 configuration:

| Furnace | Type | Atmosphere |
|---|---|---|
| RHF-03 | Roller Hearth Furnace | EXO |
| RHF-04 | Roller Hearth Furnace | N2-PSA |
| RHF-05 | Roller Hearth Furnace | N2-PSA |

The UI must obtain this from the server/master configuration where possible.

Do not scatter:

```ts
if (machine === 'RHF-03')
```

throughout the UI.

Create a central furnace configuration/metadata layer.

---

# 6. OPERATOR INFORMATION ARCHITECTURE

Reuse the existing operator shell.

Recommended navigation:

```text
Furnaces
Orders
Capture
Stoppage
History
```

If the existing generic process navigation already provides Orders/Capture/History, reuse it instead of creating a second navigation framework.

The Furnace landing page should be the Furnace Board.

Do not add the ANN-specific:

```text
Base
Charge
Annealing Batch
```

terminology to Furnace.

Use:

```text
Furnace
Running Order
Lot
Production
Reading
```

---

# 7. FURNACE LANDING PAGE

Create:

```text
Furnace Board
```

Purpose:

- show all enabled furnaces
- show current machine status
- show running order
- show current customer
- show grade
- show size
- show current speed
- show current zone temperatures
- show quantity
- show stoppage state
- allow operator to open a furnace
- allow assignment/opening of a production order where permitted

Recommended layout:

```text
[Furnace Board]                         [Refresh]

[All] [Running] [Stoppage] [Complete] [Idle]

[ RHF-03 ] [ RHF-04 ] [ RHF-05 ]
[ RHF-06 ] [ RHF-07 ] ...
```

Polling/refresh should follow the existing process convention.

Do not introduce aggressive polling without checking the existing application pattern.

---

# 8. RUNNING ORDER AUTO-PREFILL

This is critical.

When an operator opens a furnace, determine the current/running order first.

Production-related identity fields must be populated automatically from the running order.

The operator should not re-enter:

- Work Order / PO No.
- Customer
- Specification / Grade
- OD × THK × Length
- route/input reference
- other ERP-derived fields

unless the workflow explicitly permits override.

Example:

```text
Running Furnace:
RHF-04

Running Order:
WO-100234

Customer:
ABC STEELS

Size:
25.4 × 2.0 × 6000 mm

Grade:
IS 1239

Heat Treatment:
ANNEAL
```

These should be loaded from the existing order/planning/ERP spine.

Use the application's existing order journey rather than creating a duplicate order table.

---

# 9. FURNACE CAPTURE SCREEN

The Furnace capture screen should be structurally similar to the existing production capture experience but must contain Furnace-specific fields.

Recommended structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ RHF-04   RUNNING                                             │
│ WO-100234 | Customer | Grade | Size                          │
├──────────────────────────────────────────────────────────────┤
│ Production Information                                       │
│                                                              │
│ Heat Treatment     [ ANNEAL ]                                │
│ Tube Quantity      [ 120 ] Nos                               │
│ Quantity MT        [ AUTO ]                                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ TEMPERATURE ZONES                                            │
│                                                              │
│ Zone I      MIN [ ]   MAX [ ]                                │
│ Zone II     MIN [ ]   MAX [ ]                                │
│ Zone III    MIN [ ]   MAX [ ]                                │
│ Zone IV     MIN [ ]   MAX [ ]                                │
│ Zone V      MIN [ ]   MAX [ ]                                │
│ Zone VI     MIN [ ]   MAX [ ]                                │
│                                                              │
│ Line Speed        [ ] m/hr                                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ GAS / ATMOSPHERE                                             │
│ N2-PSA / EXO                                                 │
│ PNG / NH3 / gas parameters                                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Batch / Process Checks                                       │
│ Gap status                                                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Disposition                                                  │
│ [ ACCEPT ] [ QUARANTINE ]                                    │
│                                                              │
│ Remarks                                                      │
│ [........................................................]   │
│                                                              │
│                         [ SAVE PRODUCTION READING ]           │
└──────────────────────────────────────────────────────────────┘
```

---

# 10. FIELD MAPPING

Use the Furnace mapping workbook as the source of truth.

## Run identity

```text
charge_no / lot id
furnace_code
customer_code
size
work_order_no
grade_code
```

Classification:

```text
SYSTEM / DERIVED
```

## Production

```text
tube_count
ht_type
zone1_min_c
zone1_max_c
zone2_min_c
zone2_max_c
zone3_min_c
zone3_max_c
zone4_min_c
zone4_max_c
zone5_min_c
zone5_max_c
zone6_min_c
zone6_max_c
line_speed_mhr
total_nos
total_mt
png_consumption
nh3_consumption
remarks
batch_gap_ok
disposition
```

The mapping workbook identifies:

- six temperature zones
- Min/Max for each zone
- line speed in m/hr
- heat-treatment type
- tube quantity
- gas consumption
- batch-gap check
- disposition

Do not reduce the Furnace to four zones.

---

# 11. TEMPERATURE ZONES

There are exactly six zones in the current A-59 Furnace report:

```text
ZONE I
ZONE II
ZONE III
ZONE IV
ZONE V
ZONE VI
```

Each has:

```text
MIN
MAX
```

Therefore the UI must render:

```text
12 temperature values
```

Example:

```text
Zone I     Min [____] Max [____]
Zone II    Min [____] Max [____]
Zone III   Min [____] Max [____]
Zone IV    Min [____] Max [____]
Zone V     Min [____] Max [____]
Zone VI    Min [____] Max [____]
```

The system must validate:

```text
0 <= temperature <= 1200
MAX >= MIN
```

---

# 12. AUTOMATIC PLC / SCADA DATA

The mapping indicates that Furnace zone temperatures and line speed are candidates for AUTO data.

Known A-59 PLC/SCADA mapping:

```text
RHF-03 -> Siemens S7-300 CPU 315-2 PN/DP
RHF-04 -> Siemens S7-300 CPU 315-2 PN/DP
RHF-05 -> Siemens ET200SP / CPU 1510SP-1 PN
```

The existing SCADA/historian may already collect:

```text
zone temperatures
line speed
batch information
```

Implement the UI/data model so that the source can later switch between:

```text
MANUAL
PLC
SCADA
HISTORIAN
```

Use:

```text
data_source
```

instead of hardcoding manual input.

For Phase 1, manual capture may remain the default.

---

# 13. DATA SOURCE BEHAVIOUR

Each production value should have an identifiable source.

Example:

```text
zone1_min:
  value: 850
  source: SCADA
  timestamp: ...
```

or:

```text
zone1_min:
  value: 850
  source: MANUAL
  timestamp: ...
```

Do not create a UI that makes AUTO values look like manually typed values.

For automatic fields:

- display live/current value
- show source badge where appropriate
- prevent accidental manual editing when source is AUTO
- preserve captured snapshot in the production record

---

# 14. HEAT TREATMENT

Supported values:

```text
ANNEAL
NORMALIZE
SRA
```

Heat-treatment type should normally be derived from the order/grade/recipe.

The operator can confirm it if the existing workflow requires confirmation.

Do not create arbitrary values.

---

# 15. QUANTITY

Tube quantity:

```text
tube_count
```

Quantity in MT should be derived from the existing product/order weight logic where available.

Do not make operators manually calculate MT if the system already has the necessary weight information.

Example:

```text
No. of Tubes: 120
MT: 4.860
```

Total should be derived from production data.

---

# 16. BATCH GAP RULE

The Furnace process has a specific production-control check:

```text
300 mm minimum between lots
6000 mm between batches
```

This is a process advisory/check.

Display something like:

```text
Batch Gap
✓ OK
```

or:

```text
⚠ Batch gap below recommended limit
```

Do not silently block production unless the server/business rules explicitly require a hard error.

The existing plan identifies this as a WARN condition.

---

# 17. RECIPE / TEMPERATURE VALIDATION

Furnace recipe information should come from the recipe master.

At minimum:

```text
grade
size
heat_treatment
soaking_spec_c
speed_spec_m_hr
```

Validation:

```text
Soaking temperature tolerance:
±10 °C

Line speed tolerance:
±2 m/hr
```

The system should show warnings when values are outside the configured tolerance.

Do not hardcode one universal temperature for all grades.

---

# 18. GAS / ATMOSPHERE

Support:

```text
N2-PSA
EXO
```

Current furnace assignment:

```text
RHF-03 -> EXO
RHF-04 -> N2-PSA
RHF-05 -> N2-PSA
```

The gas type should come from furnace configuration.

Do not ask the operator to select gas type every time if it is fixed by furnace configuration.

---

# 19. GAS CONSUMPTION

The production report contains:

```text
PNG consumption
NH3 consumption
```

The report layout also represents consumption columns:

```text
A
B
C
```

Do not discard these report-specific requirements.

Use the workbook/report template to determine whether A/B/C represent meter/channel values and preserve the controlled report layout.

If the database needs normalized gas readings, keep the production record and gas log separated rather than duplicating gas data in multiple unrelated tables.

---

# 20. GAS PLANT LOG

There are two gas plant paths:

```text
N2 PSA
EXO
```

The workbook specifies hourly gas parameters.

N2 PSA parameters include items such as:

- inlet water pressure
- discharge temperature
- air receiver pressure
- PSA tower pressure A/B
- raw N2 flow
- NH3 inlet pressure
- cracked NH3 flow
- deoxo temperature
- dryer tower pressure
- dryer tower temperature
- O2 product gas
- dew point
- final H2

EXO parameters include:

- main PNG pressure
- secondary PNG pressure
- PNG flow
- combustion air
- combustion chamber temperature
- inlet water pressure
- air blower pressure
- deoxo pressure
- chiller temperatures
- chiller pressures
- H2
- O2
- dew point

Do not put every gas-plant field directly into the main Furnace production form.

Use a dedicated Gas panel/log workflow.

---

# 21. STOPPAGE

Reuse the existing stoppage framework where possible.

A Furnace stoppage belongs to a specific furnace and running production context.

Example:

```text
RHF-04
WO-100234
STOPPAGE
Started: 14:22
Reason: Mechanical
Elapsed: 00:18:42
```

Operator must be able to:

```text
Open stoppage
End stoppage
View stoppage history
```

The furnace card must reflect the stoppage state.

---

# 22. HISTORY

Reuse the generic operator history framework.

Furnace history must allow filtering by:

```text
Date
Shift
Furnace
Work Order
Customer
Grade
Heat Treatment
Disposition
```

History row should expose:

```text
Furnace
Work Order
Customer
Grade
Size
HT type
Quantity
Zone I–VI
Speed
Disposition
Created time
```

Do not create a completely separate history architecture if the generic process history already supports FUR.

---

# 23. DATABASE

Follow the existing Furnace implementation plan.

Preferred dedicated tables:

```text
txn.prod_fur_run
txn.prod_fur_gas
```

Do not write Furnace data into:

```text
txn.ann_charge
txn.ann_charge_coil
```

unless the repository already has an explicitly approved Furnace migration that supersedes the plan.

The production row must contain furnace identity:

```text
furnace_code
```

and must remain linked to:

```text
tenant
work order
coil/lot
shift
```

Use:

```text
data_source
status
created_at
created_by
```

according to existing conventions.

---

# 24. API

Follow the existing service/route architecture.

Expected Furnace API surface:

```http
GET  /m1/fur/records
POST /m1/fur/records
GET  /m1/fur/records/:id
POST /m1/fur/records/:id/submit
POST /m1/fur/records/:id/approve
POST /m1/fur/export
```

If the repository's actual route convention differs, use the existing project convention rather than inventing a parallel API style.

The API must validate server-side.

Client validation is not sufficient.

---

# 25. FURNACE BOARD API

Provide a board endpoint or reuse the generic process board if one exists.

The response should be able to represent:

```ts
type FurnaceBoardRow = {
  furnaceCode: string;
  furnaceName?: string;
  status: 'IDLE' | 'PREPARING' | 'RUNNING' | 'STOPPAGE' | 'COMPLETE';
  runningOrder?: {
    workOrderNo: string;
    customerCode?: string;
    gradeCode?: string;
    size?: unknown;
  };
  lineSpeedMhr?: number;
  zones?: {
    min?: number;
    max?: number;
  }[];
  tubeCount?: number;
  totalMt?: number;
  gasType?: 'N2-PSA' | 'EXO';
  openStoppage?: boolean;
};
```

Do not force the UI to know database internals.

---

# 26. OPERATOR JOURNEY

## Journey A — Open running furnace

```text
Login
 ↓
Furnace Board
 ↓
Select RHF-04
 ↓
Load current running order
 ↓
Order/customer/grade/size automatically populated
 ↓
Show current machine values
 ↓
Operator confirms/enters required manual values
 ↓
Save production reading
 ↓
History updated
```

## Journey B — Start production on idle furnace

```text
Furnace Board
 ↓
RHF-05 IDLE
 ↓
Orders
 ↓
Select pending Furnace order
 ↓
Assign order to RHF-05
 ↓
Open Capture
 ↓
Order data auto-populated
 ↓
Operator confirms process data
 ↓
Start / Save
 ↓
RHF-05 becomes RUNNING
```

## Journey C — Stoppage

```text
Furnace Board
 ↓
RHF-03 RUNNING
 ↓
Open furnace
 ↓
Open Stoppage
 ↓
Select category + reason
 ↓
Save
 ↓
RHF-03 = STOPPAGE
 ↓
End Stoppage
 ↓
RHF-03 = RUNNING
```

## Journey D — Complete production lot

```text
Running Furnace
 ↓
Capture final quantity
 ↓
Final zone/speed snapshot
 ↓
Disposition
 ↓
Submit
 ↓
Record becomes COMPLETE/SUBMITTED
 ↓
Next order can be assigned
```

---

# 27. UI DESIGN RULES

Reuse the existing operator design system.

Do not create a new visual language.

Follow the same:

- operator shell
- navigation rail
- status rail
- typography
- spacing
- cards
- buttons
- drawers
- modals
- form controls
- validation messages
- loading states
- error states
- offline handling

Use touch-friendly controls.

Primary operator controls should have approximately:

```text
44–56 px minimum touch target
```

Use monospaced presentation for:

- Work Order
- Furnace code
- numerical process values
- timestamps
- timers

---

# 28. RESPONSIVE / TABLET REQUIREMENT

Target:

```text
Landscape industrial tablet
APK WebView
```

Avoid page-level uncontrolled scrolling.

Follow the existing operator shell's viewport behavior.

The capture form may use internal scrolling if necessary.

Do not redesign the operator console as a desktop-only application.

---

# 29. IMPLEMENTATION STRATEGY

Work in this order.

## Phase 1 — Understand existing implementation

Inspect:

```text
ANN operator shell
ANN capture
generic ProcessHub
generic CaptureWorkspace
ProcessLayout
OperatorNavRail
StatusRail
ProcessOperatorHistoryPage
stoppage components
production services
processConfig
process route registration
```

Identify which pieces can be reused directly.

Do not copy entire ANN files blindly.

---

## Phase 2 — Register FUR

Add:

```text
FUR
```

to the process registry/configuration.

Add:

```text
label: Furnace
queue title: Furnace Queue
```

Seed the station/process.

Verify:

```text
Orders
Capture
History
```

appear correctly.

Do not break ANN, Tube Mill, Draw Bench, or other processes.

---

## Phase 3 — Furnace master

Create/verify machine configuration for:

```text
RHF-03
RHF-04
RHF-05
```

Add gas assignment.

Make the board dynamic.

---

## Phase 4 — Furnace Board

Implement:

```text
FurnaceBoard
FurnaceCard
```

The card must represent the current machine + production state.

Use API data.

Do not mock permanent production data in the UI.

---

## Phase 5 — Running Order integration

Connect Furnace to the existing order journey.

When a furnace has a running order, automatically populate:

```text
work_order_no
customer
grade
size
input reference
route information
heat-treatment recipe
```

Do not duplicate ERP data.

---

## Phase 6 — Furnace Capture

Implement:

```text
FurnaceBody
```

with:

1. Header/order identity
2. Production quantity
3. Heat treatment
4. Zone I–VI Min/Max
5. Line speed
6. Gas information
7. Batch-gap check
8. Disposition
9. Remarks
10. Save

---

## Phase 7 — Automatic data abstraction

Create a clean source abstraction:

```text
FurnaceDataSource
```

supporting:

```text
MANUAL
SCADA
PLC
HISTORIAN
```

Phase 1 can use:

```text
MANUAL
```

but the architecture must not make future SCADA integration require rewriting FurnaceBody.

---

## Phase 8 — Validation

Implement Furnace validation.

Required:

```text
work_order_no
tube_count
heat_treatment
zone values
disposition
```

Range:

```text
zone min/max: 0–1200 °C
```

Cross-field:

```text
zone max >= zone min
```

Tolerance warnings:

```text
soaking temp ±10 °C
line speed ±2 m/hr
```

Batch gap:

```text
300 mm lot gap
6000 mm batch gap
```

Server must enforce hard validation.

---

## Phase 9 — Persistence

Persist to Furnace-specific tables.

Ensure:

```text
tenant_id
furnace_code
work_order_no
shift
data_source
status
created_by
created_at
```

are correctly maintained.

Use idempotency where the existing platform requires it.

---

## Phase 10 — History

Verify saved Furnace records appear in generic history.

---

## Phase 11 — Export

Implement the controlled:

```text
ANN-FT-01
```

Furnace production report using the existing report/template injection mechanism.

Preserve:

- title
- date
- shift
- six zone columns
- speed
- total
- remarks
- footer
- consumption layout

Do not create a visually different spreadsheet when the controlled template exists.

---

# 30. ACCEPTANCE CRITERIA

Implementation is complete only when all of these work:

### Multi-furnace

- [ ] RHF-03 appears
- [ ] RHF-04 appears
- [ ] RHF-05 appears
- [ ] additional configured furnaces appear automatically
- [ ] each furnace has independent status
- [ ] each furnace can have its own running order

### Order integration

- [ ] running order is detected
- [ ] work order is auto-populated
- [ ] customer is auto-populated
- [ ] grade is auto-populated
- [ ] size is auto-populated
- [ ] heat-treatment recipe is resolved

### Capture

- [ ] six zones are present
- [ ] every zone has MIN and MAX
- [ ] line speed is present
- [ ] tube quantity is present
- [ ] MT is derived
- [ ] gas information is available
- [ ] batch-gap warning works
- [ ] disposition works
- [ ] remarks work

### Data source

- [ ] manual values work
- [ ] source is stored
- [ ] architecture supports future SCADA/PLC data
- [ ] automatic values are not accidentally editable

### Stoppage

- [ ] open stoppage
- [ ] end stoppage
- [ ] board reflects stoppage
- [ ] history records stoppage context

### Persistence

- [ ] Furnace data does not write into ANN charge tables
- [ ] Furnace record is linked to order
- [ ] furnace_code is persisted
- [ ] shift is persisted
- [ ] tenant/RLS conventions are preserved

### History

- [ ] Furnace records appear
- [ ] filtering by furnace works
- [ ] filtering by work order works
- [ ] filtering by shift/date works

### Export

- [ ] ANN-FT-01 export works
- [ ] six zones map correctly
- [ ] date/shift map correctly
- [ ] production rows map correctly
- [ ] controlled template layout is preserved

### Regression

- [ ] existing ANN remains unchanged
- [ ] Tube Mill remains unchanged
- [ ] Draw Bench remains unchanged
- [ ] generic operator shell remains unchanged
- [ ] existing CI/tests pass

---

# 31. IMPORTANT DO-NOT RULES

Do NOT:

1. Treat Furnace as the existing ANN charge/base process.
2. Reuse `ann_charge` for Furnace.
3. Hardcode RHF-03/RHF-04/RHF-05 into UI components.
4. Make customer/order/grade fields manually re-entered when ERP/order data exists.
5. Create duplicate order tables.
6. Reduce six temperature zones to four.
7. Put all gas-plant parameters into the main production form.
8. Hardcode recipe temperatures.
9. Make all values manual when SCADA/PLC integration is planned.
10. create a new unrelated UI framework.
11. change existing ANN behaviour while implementing FUR.
12. silently modify existing Tube Mill/Draw Bench logic.
13. invent fields that are not supported by the mapping.
14. bypass server-side validation.
15. use mock/static production records as the final implementation.

---

# 32. CURSOR EXECUTION INSTRUCTION

You are working inside the CURRENT Furnace codebase.

**Do NOT search for or assume access to the ANN codebase. ANN is a DIFFERENT repository.**

The ANN documentation supplied with this task is a REFERENCE SPECIFICATION only.

Before writing code:

1. Inspect the CURRENT Furnace repository structure.
2. Inspect the current operator shell in THIS repository.
3. Inspect the current navigation architecture.
4. Inspect the current order/planning flow.
5. Inspect the current production capture architecture.
6. Inspect process registration, if present.
7. Inspect production persistence.
8. Inspect migrations/schema.
9. Inspect history.
10. Inspect stoppage implementation.
11. Inspect report/export architecture.
12. Inspect `Zedral_A59_Furnace_M1_Data_Mapping.xlsx`.
13. Inspect `ZEDRAL_FURNACE_PROCESS_IMPLEMENTATION_PLAN.md`.
14. Use the ANN specification only to compare the desired UX/process behavior.

Then produce a short implementation plan listing:

```text
Files to modify
Files to create
Database changes
API changes
UI changes
Reuse points
Risk points
Test plan
```

After that, implement incrementally.

For every change, preserve existing conventions.

If an existing component can be reused, reuse it.

If ANN contains a component that is semantically specific to:

```text
base
charge
roster
annealing stages
```

do not reuse it as Furnace business logic.

Reuse only the generic shell/pattern.

---

# 33. FIRST IMPLEMENTATION TARGET

The first working vertical slice should be:

```text
Furnace Board
    ↓
RHF-03 / RHF-04 / RHF-05
    ↓
Select Furnace
    ↓
Load Running Order
    ↓
Auto-populate WO + Customer + Grade + Size
    ↓
Furnace Capture
    ↓
6 Zone Min/Max
    ↓
Speed
    ↓
Quantity
    ↓
Heat Treatment
    ↓
Disposition
    ↓
Save
    ↓
Database
    ↓
History
```

Only after this vertical slice is stable should gas-plant detail, PLC/SCADA live values, advanced export, and additional automation be layered in.

---

# 34. KEY PRINCIPLE

The correct implementation is:

```text
                 ZEDRAL OPERATOR FRAMEWORK
                           │
             ┌─────────────┴─────────────┐
             │                           │
          ANN process                 FUR process
          existing                    new
             │                           │
       Base / Charge               Furnace / Lot
       Annealing                   RHF-03/04/05
             │                           │
       ANN tables                  FUR tables
             │                           │
       ANN workflow                Furnace workflow
```

The Furnace should **look and feel like the same Zedral operator platform**, but its production model must represent the real RHF process.

# END


---

# 35. CROSS-CODEBASE IMPLEMENTATION RULE

This requirement is critical.

There are TWO separate codebases:

```text
CODEBASE A
Existing ANN / Annealing application
        │
        │ REFERENCE ONLY
        ↓
CODEBASE B
Current Furnace application
        │
        └── Implement FUR here
```

Cursor is operating on **CODEBASE B**.

Therefore:

- Do not expect ANN source files to exist.
- Do not import ANN components.
- Do not add ANN as a package dependency.
- Do not copy ANN database migrations.
- Do not rename Furnace entities to ANN entities.
- Do not assume ANN API endpoints exist.
- Do not use ANN routes as actual Furnace routes.
- Do not modify another repository.
- Do not create references to files that are unavailable in this repository.

The ANN specification is useful only for understanding:

```text
how the operator experience should behave
how the screens should be organized
how production status can be represented
how history/stoppage/capture can work
```

The actual implementation must be native to the current Furnace codebase.

If the current repository has different names, patterns, routes, state management, ORM, API framework, or component architecture, follow the CURRENT repository conventions.

## Priority order

When sources conflict, use this priority:

```text
1. Current Furnace repository architecture
2. Furnace data mapping workbook
3. Furnace implementation plan
4. Actual Furnace report/template
5. ANN reference specification
```

Never let the external ANN codebase dictate the internal architecture of the Furnace repository.

# END OF CROSS-CODEBASE RULE
