# ZEDRAL STP M1 — SURFACE TREATMENT PLANT
## Full UI / Production Console / Process Monitoring Implementation Specification

> **Purpose:** This document is the implementation specification for the STP M1 module in the CURRENT STP codebase.
>
> **Important:** STP is a DIFFERENT codebase from the Furnace/Annealing application. Do not copy Furnace implementation directly and do not import ANN/Annealing code.

---

# 1. PROJECT CONTEXT

Build the STP M1 module using the existing STP repository architecture.

Reuse where available:

- Existing layout
- Existing sidebar
- Existing header
- Existing design system
- Existing authentication
- Existing RBAC
- Existing API conventions
- Existing database conventions
- Existing form components
- Existing modal/drawer components
- Existing table components
- Existing notification system
- Existing state-management patterns

Do not create duplicate architecture when equivalent functionality already exists.

PLC/SCADA integration is **NOT required** unless it is already implemented in the current STP repository.

The M1 UI must support manual data entry wherever the STP mapping defines a MANUAL source.

Do not invent fields that are not supported by the STP data mapping.

---

# 2. PRIMARY STP INFORMATION ARCHITECTURE

The STP application must have exactly four primary navigation areas:

```text
ORDER
CAPTURE
MONITORING
HISTORY
```

Conceptually:

```text
STP
│
├── ORDER
│   ├── Work Orders
│   └── Production Console
│
├── CAPTURE
│   ├── Production
│   ├── Bath Analysis
│   ├── Chemical Addition
│   └── Remarks / Stoppage
│
├── MONITORING
│   └── Process Monitoring
│
└── HISTORY
    ├── Production
    ├── Process
    ├── Bath Analysis
    ├── Chemical Addition
    └── Stoppage
```

The four areas answer four different questions:

```text
ORDER
"What am I supposed to process?"

CAPTURE
"What information do I need to record?"

MONITORING
"What is happening in the STP process?"

HISTORY
"What happened previously?"
```

Do not merge these responsibilities into one giant form.

---

# 3. SIDE NAVBAR

Create a simple STP-specific sidebar.

Target:

```text
┌──────────────────────┐
│ ZEDRAL               │
│ STP                  │
├──────────────────────┤
│                      │
│  ORDER               │
│                      │
│  CAPTURE             │
│                      │
│  MONITORING          │
│                      │
│  HISTORY             │
│                      │
├──────────────────────┤
│                      │
│  ADMIN               │
│  LOGOUT              │
└──────────────────────┘
```

Use the existing application's icon system.

Do not create a second sidebar if one already exists.

---

# 4. ORDER

`ORDER` is responsible for work-order selection and production execution.

Under ORDER:

```text
ORDER
├── Work Orders
└── Production Console
```

Use the existing application's submenu, tabs, routes, or secondary navigation pattern.

---

# 5. WORK ORDERS

The physical STP work order contains multiple production lines.

Therefore the data model and UI must support:

```text
Work Order
    ↓
Work Order Line
    ↓
STP Production Run
```

Do NOT model the UI as:

```text
WO → one product
```

Example:

```text
WO 26081750

Line 1
OD: 50.8
Slit Width: 155
TH: 3.6
Length: 4900
Qty: 105 NOS
Grade: 1020 HRPO
Coil: 01-2608B-0290

Line 2
...
```

The user must select the specific work-order line before starting a production run.

---

# 6. WORK ORDER LIST

Create an operator-friendly work-order list.

Example:

```text
WORK ORDERS

Search Work Order
[________________________]

Filters:
[All] [Released] [Assigned] [Running] [Completed]

┌──────────────────────────────────────────────────────────────┐
│ WO 26081750                                                  │
│ MARMON/KEYSTONE CANADA INC.                                 │
│ Grade: 1020 HRPO                                            │
│ 105 NOS / 2.134 MT                                          │
│                                                              │
│ 1 Production Line                                            │
│                                                              │
│ [VIEW] [ASSIGN]                                              │
└──────────────────────────────────────────────────────────────┘
```

For multiple lines:

```text
WO 26081750

┌──────┬────────┬────────┬──────┬────────┬──────────────┐
│ Line │ OD     │ Slit   │ TH   │ Length │ Quantity     │
├──────┼────────┼────────┼──────┼────────┼──────────────┤
│ 1    │ 50.8   │ 155    │ 3.6  │ 4900   │ 105 / 2.134 │
│ 2    │ ...    │ ...    │ ...  │ ...    │ ...          │
└──────┴────────┴────────┴──────┴────────┴──────────────┘
```

---

# 7. WORK ORDER DETAIL

When opening a work-order line, show structured sections.

## Product

```text
OD
Slit Width
TH
Length
Quantity NOS
Quantity MT
```

## Material

```text
TDC No.
Grade
Coil No.
Pass
```

## Customer

```text
Customer
Customer Code
SO Due Date
```

## Final Product

```text
Wt / Tube
Final Size
Tube Shape
Next Process
```

## Rolling / Production Requirements

```text
Rolling Instruction
Tensile
Yield
Elongation
FDS/BRSR
TOD
TID
TTH
FD Draw Length
Soap Draw
```

## Remarks

Display existing work-order remarks.

All ERP/work-order information is READ-ONLY to the Operator.

---

# 8. PRODUCTION CONSOLE

The Production Console is the primary shop-floor workspace.

It answers:

```text
What am I producing?
What order am I running?
What production data do I need to record?
What is the production status?
```

Do not turn the Production Console into a PLC/process-monitoring dashboard.

---

# 9. PRODUCTION CONSOLE HEADER

For RUNNING:

```text
STP-01 · A-59 · RUNNING

ACTIVE ORDER
26081750 · LINE 1

[ LIVE ]
[ REMARKS ]
[ BATH ANALYSIS ]
[ CHEMICAL ADDITION ]

[ END ]
[ STOPPAGE ]
[ SAVE ]
[ SUBMIT ]
```

For IDLE:

```text
STP-01 · A-59 · IDLE

[ LIVE ]
[ REMARKS ]

[ START ]
```

For STOPPAGE:

```text
STP-01 · A-59 · STOPPAGE

[ LIVE ]
[ REMARKS ]
[ BATH ANALYSIS ]
[ CHEMICAL ADDITION ]

[ END STOPPAGE ]
[ SAVE ]
[ SUBMIT ]
```

Use the existing header/button design system.

---

# 10. GLOBAL HEADER

The global STP header should always show the active context.

Example:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ STP ▼ │ STP-01 │ Shift A │ ACTIVE ORDER 26081750 · LINE 1 │ RUNNING │ LIVE │
└─────────────────────────────────────────────────────────────────────────────┘
```

Keep these synchronized:

```text
STP
Shift
Work Order
Work Order Line
Production Status
```

---

# 11. ACTIVE WORK ORDER SUMMARY

The Production Console must show the selected work-order line as a read-only summary.

Example:

```text
RUNNING ORDER

WO
26081750

LINE
1

CUSTOMER
MARMON/KEYSTONE CANADA INC.

GRADE
1020 HRPO

OD
50.8 mm

SLIT WIDTH
155 mm

TH
3.6 mm

LENGTH
4900 mm

QUANTITY
105 NOS / 2.134 MT

TDC
TDC-23899

COIL
01-2608B-0290

PASS
1

FINAL SIZE
44.45 × 38.354 × 3.048 × 6096

TUBE SHAPE
ROUND

NEXT PROCESS
HANL, STPS, SWAG
```

Do not make these fields editable.

---

# 12. PRODUCTION INPUTS

Only fields classified as manual/operator inputs may be edited.

Example:

```text
PRODUCTION

Produced Quantity
[____________] NOS

Produced Weight
[____________] MT

Surface Finish
[________________________________]

Disposition
[ ACCEPT ▼ ]
```

Use the exact fields defined by the current STP mapping.

Do not invent additional production fields.

---

# 13. DERIVED / READ-ONLY FIELDS

These must remain derived/read-only wherever supplied by ERP, work order, configuration or calculation:

```text
Date
Shift
STP
Work Order
Work Order Line
Customer
Customer Code
Grade
OD
Slit Width
TH
Length
TDC
Coil
Pass
SO Due Date
Original Quantity
Final Size
Tube Shape
Next Process
Recipe / Specification
```

The Operator must not have editable inputs for these values.

---

# 14. PRODUCTION STATE MACHINE

Implement:

```text
IDLE
  ↓
START
  ↓
RUNNING
  ↓
END
  ↓
COMPLETE
```

Stoppage is temporary:

```text
RUNNING
   ↓
STOPPAGE
   ↓
END STOPPAGE
   ↓
RUNNING
```

A stoppage must NOT complete the production run.

---

# 15. START

When production is IDLE:

```text
[ START ]
```

Starting must:

1. Validate selected work-order line.
2. Validate required production context.
3. Create/start production run.
4. Record start timestamp.
5. Record operator.
6. Set production status to RUNNING.
7. Update STP Board.
8. Update Production Console.

---

# 16. END

When production is RUNNING:

```text
[ END ]
```

Ending must:

1. Validate required final production information.
2. Save final values.
3. Record end timestamp.
4. Record operator.
5. Close the production run.
6. Set production status to COMPLETE.
7. Update STP Board.

Do not show START again for the completed run.

---

# 17. STOPPAGE

Do NOT place a permanent Stoppage form inside the Production Console.

Use:

```text
[ STOPPAGE ]
```

Clicking opens:

```text
OPEN STOPPAGE

Code
[ Select Code ▼ ]

Reason
[____________________________]

[ Cancel ] [ Start Stoppage ]
```

After confirmation:

```text
Production = ACTIVE
Machine = STOPPAGE
```

The action changes to:

```text
[ END STOPPAGE ]
```

Ending the stoppage:

```text
STOPPAGE
    ↓
END STOPPAGE
    ↓
RUNNING
```

Record:

```text
start timestamp
end timestamp
duration
code
reason
operator
production run
```

---

# 18. REMARKS

Do not create a large permanent Remarks section.

Use:

```text
[ REMARKS ]
```

Clicking opens:

```text
PRODUCTION REMARKS

Work Order: 26081750
Line: 1

Remarks
┌─────────────────────────────────────┐
│                                     │
│                                     │
└─────────────────────────────────────┘

[Cancel] [Save Remarks]
```

Load existing remarks when opening.

Save against the current production run.

---

# 19. BATH ANALYSIS

Bath Analysis is a separate Capture function.

It must NOT be embedded into the main Production Console.

Access through:

```text
CAPTURE → Bath Analysis
```

and:

```text
[ BATH ANALYSIS ]
```

from the active Production Console.

Use a popup, drawer or dedicated capture view according to the existing application architecture.

Organize by bath/process.

Example:

```text
BATH ANALYSIS

DEGREASING
TA
[____]

HCl PICKLING
HCl Concentration
[____]

Fe Content
[____]

ACTIVATION
pH
[____]

PHOSPHATING
TA
[____]

FA
[____]

ACC
[____]

OXTA
[____]

NEUTRALIZER
pH
[____]

LUBRICATION
Concentration
[____]

FA
[____]

pH
[____]

RINSE
Rinse 1 pH
[____]

Rinse 2 pH
[____]

Rinse 3 pH
[____]

Rinse 4 pH
[____]

OIL BATH
Water Content
[____]

Acid Number
[____]
```

Use exact fields/specifications from the current STP mapping.

Do not invent laboratory parameters.

---

# 20. CHEMICAL ADDITION

Chemical Addition is a separate Capture function.

Access through:

```text
CAPTURE → Chemical Addition
```

and:

```text
[ CHEMICAL ADDITION ]
```

from Production Console.

Example:

```text
CHEMICAL ADDITION

Process / Bath
[ Select ▼ ]

Chemical
[ Select ▼ ]

Quantity
[________]

Unit
[________]

Batch / Reference
[________]

Remarks
[________________________]

[Cancel] [Save]
```

Use the exact STP mapping for the final fields.

---

# 21. CAPTURE NAVIGATION

The second primary sidebar item is:

```text
CAPTURE
```

It provides access to manual/operator data capture.

Conceptually:

```text
CAPTURE
│
├── Production
├── Bath Analysis
├── Chemical Addition
└── Remarks / Stoppage
```

Do not create a duplicate Production Console.

`CAPTURE → Production` should open the canonical Production Console.

---

# 22. MONITORING

The third primary sidebar item is:

```text
MONITORING
```

This is completely separate from Production Console.

Its purpose is:

```text
What is happening inside the STP process?
```

Do not put the entire monitoring interface inside the Production Console.

---

# 23. PROCESS MONITORING FLOW

Create a visual STP process flow using the actual configured STP stages.

Conceptually:

```text
DEGREASING
      ↓
HCl PICKLING / DE-SCALING
      ↓
WATER RINSE
      ↓
ACTIVATION
      ↓
PHOSPHATING
      ↓
NEUTRALIZER
      ↓
LUBRICATION
      ↓
DRYER
      ↓
REACTIVE OIL
```

Do not add stages that are not supported by the current STP configuration/mapping.

---

# 24. PROCESS MONITORING STAGES

Each stage should have a visual state:

```text
PENDING
ACTIVE
COMPLETE
WARNING
FAULT
N/A
```

Example:

```text
┌───────────────────────┐
│ PHOSPHATING           │
│                       │
│ ● ACTIVE              │
│                       │
│ Temperature           │
│ 70.5 °C               │
│                       │
│ Dip Time              │
│ 08:21                 │
│                       │
│ Source: AUTO          │
└───────────────────────┘
```

---

# 25. PROCESS MONITORING DATA

For each monitored parameter display:

```text
PARAMETER
ACTUAL
TARGET
STATUS
SOURCE
LAST UPDATED
```

Example:

```text
Temperature

Actual
70.5 °C

Target
65–75 °C

Status
✓ NORMAL

Source
AUTO

Last Updated
10:15:22
```

---

# 26. AUTO / MANUAL SOURCE

Clearly distinguish data sources.

Automatic process value:

```text
Temperature
70.5 °C
[AUTO]
```

Manual laboratory value:

```text
pH
5.4
[MANUAL]
```

Do not display a value as PLC/SCADA data unless it actually comes from PLC/SCADA.

For M1, use the mapping-defined source.

---

# 27. PROCESS MONITORING DETAIL DRAWER

Clicking a process stage opens a detail drawer/panel.

Example:

```text
PHOSPHATING
────────────────────────────

STATUS
● ACTIVE

TEMPERATURE
70.5 °C

TARGET
65–75 °C

DIP TIME
08:21

TARGET
6–11 min

SOURCE
AUTO

LAST UPDATED
10:15:22

STATUS
✓ NORMAL

BATH ANALYSIS
TA     52
FA      8
ACC   1.8
OXTA   42

[ View Bath Analysis ]
```

The monitoring drawer must not create duplicate editable Bath Analysis fields.

Editing belongs to the canonical Bath Analysis interface.

---

# 28. ADD OPTION

Where the application has an:

```text
+ ADD OPTION
```

menu, include:

```text
+ ADD OPTION

Process Monitoring
Bath Analysis
Chemical Addition
```

`Process Monitoring` must open the same Monitoring module as the sidebar.

Do not create duplicate Monitoring implementations.

---

# 29. PRODUCTION VS MONITORING

This separation is mandatory.

## PRODUCTION CONSOLE

```text
Work Order
Production
Quantity
Surface Finish
Disposition
Start
End
Stoppage
Remarks
Submit
```

## PROCESS MONITORING

```text
Process Stage
Temperature
Time
Actual Value
Target
Source
Status
Alarm
Progress
```

## BATH ANALYSIS

```text
Laboratory / Bath values
```

## CHEMICAL ADDITION

```text
Chemical addition records
```

Do not merge these into one large form.

---

# 30. HISTORY

The fourth primary sidebar item is:

```text
HISTORY
```

Suggested structure:

```text
HISTORY

Production
Process
Bath Analysis
Chemical Addition
Stoppage
```

Filters:

```text
Date
Shift
STP
Work Order
Work Order Line
Customer
Grade
Status
Process
```

Use existing table/filter components.

---

# 31. HISTORY — PRODUCTION

Display:

```text
Date
Shift
STP
WO
Line
Customer
Grade
Quantity
Status
Start Time
End Time
Operator
```

Clicking a record opens read-only details.

---

# 32. HISTORY — PROCESS

Display historical process execution:

```text
Production Run
Process
Start
End
Actual Parameters
Target
Source
Status
Warnings
```

---

# 33. HISTORY — BATH ANALYSIS

Display:

```text
Date
Bath
Parameter
Value
Specification
Status
Operator
```

Allow opening the complete bath-analysis record.

---

# 34. HISTORY — CHEMICAL ADDITION

Display:

```text
Date
Process/Bath
Chemical
Quantity
Unit
Batch
Operator
```

---

# 35. GLOBAL LIVE ACTION

If the current application has a `LIVE` button, keep it.

It should show current/latest STP status.

It must NOT falsely represent PLC connectivity.

Manual source:

```text
Source: MANUAL
```

Automatic source:

```text
Source: AUTO
```

Do not label manual values as real-time machine telemetry.

---

# 36. ROLE-BASED ACCESS

## Operator

Allowed:

```text
View Orders
Select Order
Start
End
Stoppage
End Stoppage
Enter Production Data
Bath Analysis
Chemical Addition
Remarks
Save
Submit
Monitoring
History
```

## Machine Head / Supervisor

Additionally:

```text
Approve
Hold
Review
Reports
Export
```

## Admin

Configuration and administrative functions according to existing RBAC.

Do not expose approval/export controls to Operator.

RBAC must be enforced at the backend API level as well as frontend.

---

# 37. RESPONSIVE UI

Production Console should prioritize operator readability.

Use:

```text
Cards
Sections
Two-column layouts
Drawers
Modals
Compact read-only information blocks
```

Work-order details may use expandable sections.

Process Monitoring should use:

```text
Process cards
Flow/timeline
Status indicators
Detail drawer
```

History should use:

```text
Data table
Filters
Detail drawer
```

Avoid a giant spreadsheet-like production form.

---

# 38. VISUAL HIERARCHY

The UI should clearly communicate:

```text
WHERE AM I?
    ↓
STP / STP-01

WHAT AM I RUNNING?
    ↓
WO + LINE

WHAT IS THE MACHINE DOING?
    ↓
Production Status

WHAT AM I RECORDING?
    ↓
Production / Bath / Chemical

WHAT IS THE PROCESS DOING?
    ↓
Monitoring

WHAT HAPPENED BEFORE?
    ↓
History
```

Avoid excessive cards and duplicated information.

---

# 39. FINAL INFORMATION ARCHITECTURE

```text
STP
│
├── ORDER
│   │
│   ├── Work Orders
│   │
│   └── Production Console
│       │
│       ├── Active Work Order
│       ├── Production
│       ├── Start / End
│       ├── Stoppage
│       ├── Remarks
│       ├── Bath Analysis
│       └── Chemical Addition
│
├── CAPTURE
│   │
│   ├── Production
│   ├── Bath Analysis
│   ├── Chemical Addition
│   └── Remarks / Stoppage
│
├── MONITORING
│   │
│   └── Process Monitoring
│       ├── Degreasing
│       ├── Pickling
│       ├── Rinse
│       ├── Activation
│       ├── Phosphating
│       ├── Neutralizer
│       ├── Lubrication
│       ├── Dryer
│       └── Reactive Oil
│
└── HISTORY
    │
    ├── Production
    ├── Process
    ├── Bath Analysis
    ├── Chemical Addition
    └── Stoppage
```

---

# 40. DATA RELATIONSHIP

Do not connect production records only to a WO number.

Use:

```text
Work Order
    ↓
Work Order Line
    ↓
STP Production Run
    ↓
Process Execution
    ├── Process Stage Data
    ├── Stoppages
    ├── Bath Analysis
    ├── Chemical Additions
    └── Remarks
```

This prevents data from one work-order line being mixed with another line on the same work order.

---

# 41. SOURCE OF TRUTH

ERP / Work Order:

```text
ERP
 ↓
Work Order
 ↓
Work Order Line
 ↓
Production Run
```

Process monitoring:

```text
Configured STP process
 ↓
Process stages
 ↓
Actual process values
```

Laboratory:

```text
Operator / Lab
 ↓
Bath Analysis
```

Chemicals:

```text
Operator / Lab
 ↓
Chemical Addition
```

Do not duplicate the same information into unrelated records.

---

# 42. DO NOT IMPLEMENT

Do NOT:

- Copy the Furnace UI one-to-one.
- Import ANN/Annealing code.
- Create six Furnace-style temperature zones.
- Put Process Monitoring inside Production Console.
- Put Bath Analysis into the main Production form.
- Put Chemical Addition into the main Production form.
- Make ERP work-order fields editable.
- Create duplicate Work Order state.
- Create duplicate Production Console.
- Create duplicate Monitoring pages.
- Invent PLC values.
- Show fake live telemetry.
- Create fake alarms.
- Add unsupported process stages.
- Add unsupported laboratory parameters.
- Allow Operator approval.
- Allow Operator restricted exports.

---

# 43. IMPLEMENTATION PROCESS

Before modifying code:

### STEP 1 — Inspect

Identify:

```text
Routes
Pages
Components
Layouts
Sidebar
Header
Models
API
Database
RBAC
Forms
Modals
Drawers
Tables
Notifications
```

### STEP 2 — Work Order

Identify the current Work Order model and confirm how these are represented:

```text
Work Order
Work Order Line
Customer
Grade
Quantity
Dimensions
```

### STEP 3 — Production

Identify existing Production Run functionality and reuse it.

### STEP 4 — Monitoring

Identify existing Process Monitoring functionality.

If it already exists, refactor it into the dedicated Monitoring module instead of rebuilding it.

### STEP 5 — Navigation

Implement:

```text
ORDER
CAPTURE
MONITORING
HISTORY
```

### STEP 6 — ORDER

Implement:

```text
Work Orders
Production Console
```

### STEP 7 — CAPTURE

Implement:

```text
Production
Bath Analysis
Chemical Addition
Remarks
Stoppage
```

### STEP 8 — MONITORING

Implement dedicated:

```text
Process Monitoring
```

### STEP 9 — HISTORY

Implement:

```text
Production History
Process History
Bath Analysis History
Chemical Addition History
Stoppage History
```

### STEP 10 — RBAC

Verify Operator, Machine Head/Supervisor and Admin permissions.

---

# 44. ACCEPTANCE CRITERIA

## Navigation

- [ ] Side navbar has ORDER.
- [ ] Side navbar has CAPTURE.
- [ ] Side navbar has MONITORING.
- [ ] Side navbar has HISTORY.
- [ ] No unnecessary top-level navigation is added.

## ORDER

- [ ] Work Orders exists.
- [ ] Production Console exists.
- [ ] Work Order supports multiple lines.
- [ ] Work Order Line is separately selectable.
- [ ] ERP-derived fields are read-only.

## PRODUCTION

- [ ] Production Console is separate from Monitoring.
- [ ] Start works.
- [ ] End works.
- [ ] Stoppage works.
- [ ] End Stoppage works.
- [ ] Remarks popup works.
- [ ] Production data can be saved.
- [ ] Production can be submitted.

## CAPTURE

- [ ] Production capture is available.
- [ ] Bath Analysis is available.
- [ ] Chemical Addition is available.
- [ ] Manual values are persisted correctly.
- [ ] No duplicate forms are created.

## MONITORING

- [ ] Dedicated Monitoring page exists.
- [ ] Process flow is visible.
- [ ] Process stages are represented individually.
- [ ] Actual values are visible.
- [ ] Target values are visible where configured.
- [ ] AUTO/MANUAL source is visible.
- [ ] Status is visible.
- [ ] Warning/fault states are supported.
- [ ] Process detail drawer/panel works.

## HISTORY

- [ ] Production history works.
- [ ] Process history works.
- [ ] Bath Analysis history works.
- [ ] Chemical Addition history works.
- [ ] Stoppage history works.
- [ ] Filtering works.

## RBAC

- [ ] Operator cannot approve.
- [ ] Operator cannot hold.
- [ ] Operator cannot export restricted reports.
- [ ] Machine Head retains appropriate administrative actions.
- [ ] Backend authorization is enforced.

---

# 45. FINAL UI PHILOSOPHY

The STP application must feel like an industrial production application, not a generic CRUD form.

The operator's mental model should be:

```text
ORDER
  ↓
SELECT WORK ORDER
  ↓
SELECT WORK ORDER LINE
  ↓
PRODUCTION CONSOLE
  ↓
START
  ↓
PRODUCTION
  ↓
PROCESS MONITORING
  ↓
BATH / CHEMICAL CAPTURE
  ↓
END
  ↓
SUBMIT
```

Keep these responsibilities separate throughout:

```text
ORDER
CAPTURE
MONITORING
HISTORY
```

The UI, routing, state management, API and database relationships should all follow this separation.

# END
