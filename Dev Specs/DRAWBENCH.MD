# DRAW BENCH M1 — PRODUCTION MODULE
## Work Order → Capture → History

Build the Draw Bench M1 production module as a production-floor application.

The primary operator navigation must contain ONLY three items:

1. Work Order
2. Capture
3. History

Do not add unnecessary top-level navigation items.

---

# 1. GLOBAL SIDEBAR

Create a persistent left sidebar:

DRAW BENCH M1

- Work Order
- Capture
- History

The active section must be visually highlighted.

Keep the interface industrial, clean, dense and production-oriented.

Use the attached Work Order UI screenshot as the visual reference for the Work Order page.

Do not redesign the visual language into a generic SaaS dashboard.

---

# 2. WORK ORDER

## Purpose

The Work Order page is the operator's entry point.

All work orders received from the ERP must be displayed here.

The ERP is the source of truth for work-order information.

Do not create fake/static work orders if an ERP/API/database integration already exists.

Use the existing project architecture and data layer.

---

## WORK ORDER LIST UI

Recreate the structure and information hierarchy of the provided screenshot.

The page should have:

### Header

Left:

DRAW BENCH / MACHINE NAME

Example:

Machine
6HI · Draw Bench

Right:

- Date selector
- Refresh
- Current time
- Production/process mode if applicable

---

## SEARCH

Provide a large search field.

Search should support:

- Work Order No.
- Batch No.
- Customer
- Grade
- Product/size
- Coil/material reference
- Draw Bench

Example placeholder:

Search work order, customer, batch, grade...

---

## STATUS FILTERS

Use horizontal filter pills similar to the supplied screenshot.

Example:

- All
- Pending
- Preparing
- In Progress
- Completed
- On Hold

The counts must come from actual application data.

Do not hard-code counts.

---

# WORK ORDER CARDS

Every ERP work order must be displayed as a production card.

Follow the visual structure of the supplied screenshot.

Each card should clearly show:

- Work Order No.
- Work Order suffix/sequence if applicable
- Batch No.
- Customer Name
- Grade
- Product / material
- Input size
- Final size
- Planned quantity
- Planned date
- Shift
- Route / process route
- Assigned Draw Bench
- Current status
- Backlog information where applicable

The exact fields must come from the ERP/work-order data model.

Do not invent values.

---

# WORK ORDER SELECTION

When the operator clicks a work-order card:

DO NOT immediately open the production form.

First open/load the WORK ORDER INFORMATION CARD / DETAIL PANEL.

The detail panel should contain the complete information for the selected work order.

---

# WORK ORDER DETAIL CARD

Use a right-side detail panel similar to the supplied screenshot.

Display:

## Identification

- Work Order No.
- Batch No.
- Customer
- Grade
- Material/Product

## Process

- Process Route
- Assigned Draw Bench
- Planned Date
- Shift
- Production status

## Dimensions

Display the relevant dimensions available from ERP:

- Input OD
- Input ID
- Input Thickness
- Input Length
- Final OD
- Final ID
- Final Thickness
- Final Length
- Finish
- Draw Plan Length

Only display fields that actually exist in the source data.

---

# LOAD / START PRODUCTION

At the bottom of the Work Order Detail Card provide the primary action:

LOAD WORK ORDER

or

MOVE TO PRODUCTION

depending on the existing terminology in the application.

When the operator clicks this:

1. Validate the work order.
2. Load the work order into the production session.
3. Determine the applicable Draw Bench.
4. Load all mapped production parameters.
5. Load the applicable production/log-sheet fields.
6. Load mapped PLC values where available.
7. Pre-fill fields that are already known.
8. Keep operator-entered fields editable only where manual input is required.
9. Open the production capture form.

Do NOT duplicate information that is already available from ERP.

---

# 3. PRODUCTION CAPTURE

The Capture section is the actual production-floor console.

The Capture page must NOT be a simple data-entry table.

It should be a machine-oriented production console.

---

# CAPTURE LANDING PAGE

Initially show small machine cards for each Draw Bench.

Example:

DRAW BENCH 01
Status: Running
Current WO: DB-2026-001
Operator: —
Production: 1250 / 2000 m
PLC: Connected

DRAW BENCH 02
Status: Idle
Current WO: —
Operator: —
PLC: Connected

DRAW BENCH 03
Status: Running
Current WO: DB-2026-003
Operator: —
PLC: Connected

...

Create one card for every configured Draw Bench.

The cards must use real machine state where available.

Do not hard-code machine status.

---

# DRAW BENCH CARD

Each Draw Bench card should show:

- Draw Bench number/name
- Machine status
- PLC connection status
- Current Work Order
- Current production status
- Current operator
- Current shift
- Production progress
- Current running parameter summary
- Last update time
- Alarm/fault indicator if available

Possible machine states:

- Running
- Idle
- Stopped
- Fault
- Offline
- Maintenance
- Setup

Use the application's existing machine-state model where available.

---

# CLICKING A DRAW BENCH

When the operator clicks a Draw Bench card:

Open that machine's production console.

The production console must automatically identify:

- Machine
- Running Work Order
- Current production session
- Current shift
- Current operator
- PLC connection
- Production state

If a running work order exists, load it automatically.

If there is no running work order, clearly show:

NO ACTIVE WORK ORDER

with an appropriate action to load a Work Order.

---

# PRODUCTION CONSOLE

The production console should be divided into logical sections.

Recommended structure:

## Header

Show:

- Draw Bench No.
- Work Order No.
- Batch No.
- Customer
- Grade
- Current shift
- Operator
- Machine status
- PLC connection
- Production session status

---

# SECTION 1 — WORK ORDER / PRODUCT

Show the production information loaded from ERP.

Examples:

- Work Order No.
- Customer
- Grade
- Input Size
- Final Size
- Planned Length
- Planned Quantity
- Route
- Draw Plan Length
- Material information

These values should normally be READ-ONLY.

The operator should not manually modify ERP-controlled information.

---

# SECTION 2 — PARAMETERS

This section must use:

1. The Draw Bench M1 Excel data mapping
2. The production/log-sheet format
3. The existing application data model
4. PLC data where mapped
5. Manual operator input where required

IMPORTANT:

Do NOT invent parameter names.

Inspect:

`Zedral_A59_DrawBench_M1_Data_Mapping.xlsx`

and use the actual mapped parameters.

For every parameter determine its source:

- ERP
- PLC
- Manual
- Calculated
- System

Display the source where useful.

Example:

Parameter       Value       Source
--------------------------------------
Speed            125        PLC
Draw Length      2500       ERP
Accepted Qty     120        Manual
Current Meter    1850       PLC
Remarks          —          Manual

---

# PARAMETER AUTO-FILL RULE

If a value is available from PLC:

    PLC value → automatically populate field

If a value is available from ERP:

    ERP value → automatically populate field

If a value is calculated:

    System calculates it automatically

If a value requires operator confirmation/input:

    Show manual input field

DO NOT ask the operator to manually enter information that can already be obtained from ERP or PLC.

---

# FIELD SOURCE PRIORITY

Use this conceptual priority:

ERP
  ↓
PLC / Machine Data
  ↓
Calculated Data
  ↓
Manual Operator Input

However, do NOT overwrite a manual value with a PLC update after the operator has intentionally edited/confirmed it unless the existing application architecture explicitly requires this.

Clearly distinguish:

- Auto-filled
- Live PLC
- Manual
- Calculated

---

# PRODUCTION LOG / REPORT FIELDS

The production capture form must support the fields represented in the Draw Bench Production Report.

The report includes information such as:

- Date
- Shift
- Draw Bench No.
- Operator Name
- Work Order No.
- Grade
- Customer Name
- Final Size
- From Size
- Draw Plan Length
- Accepted Quantity
- Rejected Quantity
- Drawn Meter
- Remarks
- Break Down / Remarks
- Supervisor
- Shift Incharge

Use the supplied production report as the reference for production-record structure.

Do not blindly reproduce the paper form as a UI.

Convert it into a usable digital production console.

---

# SECTION 3 — PRODUCTION QUANTITY

Provide production quantity controls for:

- Planned quantity
- Produced quantity
- Accepted quantity
- Rejected quantity
- Remaining quantity

Where possible, calculate:

Remaining = Planned - Accepted - Rejected

Use the actual application's unit of measure.

If the source data distinguishes:

- Nos
- MT
- Meter

keep those units separate.

---

# SECTION 4 — DRAWN METER

Display:

- Planned Draw Length
- Current Drawn Meter
- Session Drawn Meter
- Remaining Meter

If the PLC provides the live meter value, display it as LIVE PLC DATA.

Do not allow manual editing of a live PLC value unless explicitly required.

---

# SECTION 5 — BREAKDOWN / STOPPAGE

Provide a dedicated section for:

- Breakdown reason
- Stoppage reason
- Start time
- Stop time
- Duration
- Remarks

The operator must be able to record the reason for production interruption.

If the machine/PLC already detects stop/start events, use those events where available.

Do not create duplicate stoppage records.

---

# SECTION 6 — REMARKS

Provide:

- Production Remarks
- Breakdown Remarks
- Special Remarks

Keep these separate if the backend supports separate categories.

---

# PRODUCTION SAVE / SUBMIT

The production console must support:

- Save Draft
- Save Production Entry
- Confirm Production
- Complete Work Order

Do not mark a work order Completed merely because the operator opened the form.

Completion must happen only through the appropriate production workflow.

---

# WORK ORDER STATE FLOW

Use a clear lifecycle:

PENDING
   ↓
PREPARING
   ↓
IN PROGRESS
   ↓
COMPLETED

Alternative states where supported:

ON HOLD
CANCELLED
REJECTED

Opening a work order does not mean it is completed.

Starting production changes it to IN PROGRESS only when the production session actually starts.

---

# 4. HISTORY

History is for completed and previously recorded production.

The main History page should show completed work orders in a table.

---

# HISTORY TABLE

Columns should include:

- Date
- Shift
- Work Order No.
- Batch No.
- Draw Bench
- Customer
- Grade
- Final Size
- Planned Quantity
- Accepted Quantity
- Rejected Quantity
- Drawn Meter
- Operator
- Status
- Completion Time

Do not show excessive columns by default.

Allow horizontal scrolling or column configuration if necessary.

---

# HISTORY FILTERS

Provide filters for:

- Date
- Date range
- Shift
- Draw Bench
- Work Order
- Customer
- Grade
- Operator
- Status

Provide search.

---

# HISTORY DETAIL

When the operator clicks a completed work order:

Open a detail drawer/page.

Show the FULL production record.

The detail must include:

## Work Order Details

- Work Order No.
- Batch
- Customer
- Grade
- Route
- Planned date
- Shift
- Draw Bench

## Product Details

- Input dimensions
- Final dimensions
- Draw plan length
- Product/material details

## Production

- Planned quantity
- Accepted quantity
- Rejected quantity
- Drawn meter
- Production duration

## Parameters

Show all captured production parameters.

For each parameter show:

- Parameter
- Value
- Unit
- Source
- Timestamp if available

Example:

Speed | 125 | m/min | PLC
Draw Length | 2500 | mm | ERP
Accepted Qty | 120 | Nos | Manual

## Breakdown / Stoppage

Show:

- Breakdown reason
- Start
- End
- Duration
- Remarks

## Remarks

Show:

- Operator remarks
- Production remarks
- Special remarks

## Audit Information

Show:

- Created by
- Started at
- Last updated
- Completed at
- Operator
- Supervisor where available

---

# 5. DATA SOURCE ARCHITECTURE

IMPORTANT:

Do not mix source responsibilities.

Use this model:

ERP
  │
  ├── Work Order
  ├── Customer
  ├── Grade
  ├── Planned Quantity
  ├── Planned Date
  ├── Product Dimensions
  └── Route
       │
       ▼
WORK ORDER
       │
       ▼
PRODUCTION SESSION
       │
       ├── PLC DATA
       │
       ├── MAPPED PARAMETERS
       │
       ├── CALCULATED VALUES
       │
       └── MANUAL OPERATOR INPUT
       │
       ▼
PRODUCTION RECORD
       │
       ▼
HISTORY

---

# 6. EXCEL MAPPING

Before implementing the parameter UI:

READ AND ANALYZE:

`Zedral_A59_DrawBench_M1_Data_Mapping.xlsx`

Do not assume the parameter names or PLC addresses.

For each mapped field determine:

- Parameter name
- Machine
- PLC source
- PLC address/tag
- Data type
- Unit
- Read/write capability
- Production relevance
- UI location
- Whether it is live or snapshot data
- Whether it should be editable
- Whether it belongs to Work Order, Production, Monitoring or History

Use the mapping as the canonical source for Draw Bench M1 parameter integration.

---

# 7. PRODUCTION LOG SHEET

Use the supplied Draw Bench Production Report as the reference for the digital production record.

The physical report contains Draw Bench production information including work order, operator, customer, grade, dimensions, draw plan length, accepted quantity, rejected quantity, drawn meter and remarks.

The digital application should preserve the same business meaning while providing a better operator workflow.

Do not force the operator to fill the same paper-form structure manually.

---

# 8. IMPORTANT DATA BEHAVIOR

### Existing data should be pre-filled.

If the application already knows:

Work Order = WO123
Customer = ABC
Grade = A
Final Size = X
Draw Plan Length = Y

then these fields must already be filled.

The operator should not enter them again.

---

### PLC data should be live where applicable.

If the parameter is mapped to a PLC tag/address:

show the current PLC value.

Display a small source indicator:

PLC

or

LIVE

---

### Manual fields remain manual.

Examples:

- Accepted Quantity
- Rejected Quantity
- Breakdown Reason
- Remarks

Only make them automatic if a reliable source exists.

---

# 9. UI/UX REQUIREMENTS

Follow the supplied Work Order screenshot for visual direction:

- Clean industrial UI
- White/light background
- Dark typography
- Green/dark-green primary action
- Yellow accent
- Rounded cards
- Compact information hierarchy
- Clear status badges
- Strong numeric values
- Dense but readable production information

Avoid:

- Marketing-style UI
- Excessive gradients
- Huge dashboard charts
- Unnecessary animations
- Excessive whitespace
- Generic SaaS widgets
- Too many navigation items

This is an operator production system.

Information density and speed of operation are more important than decorative UI.

---

# 10. RESPONSIVENESS

Primary target:

Desktop / industrial operator workstation.

Also support:

- 1366×768
- 1600×900
- 1920×1080

The production console must remain usable at 1366×768.

Do not require excessive scrolling for the primary production controls.

---

# 11. DO NOT BREAK EXISTING ARCHITECTURE

Before modifying code:

1. Inspect the existing routes.
2. Inspect existing components.
3. Inspect existing API services.
4. Inspect existing database models.
5. Inspect ERP integration.
6. Inspect PLC integration.
7. Inspect Draw Bench mapping.
8. Reuse existing components where appropriate.
9. Do not create duplicate API layers.
10. Do not create fake backend data if real data already exists.

Follow the existing project conventions.

---

# 12. IMPLEMENTATION ORDER

Implement in this order:

### Phase 1
Work Order UI

- ERP work-order list
- Search
- Filters
- Work-order cards
- Detail panel

### Phase 2
Load Work Order

- Work-order validation
- Production session creation
- Data prefill
- ERP data loading

### Phase 3
Capture

- Draw Bench cards
- Machine state
- PLC status
- Running work order
- Production console
- Parameter mapping
- Manual fields

### Phase 4
Production Recording

- Accepted quantity
- Rejected quantity
- Drawn meter
- Breakdown
- Remarks
- Save/submit
- Complete work order

### Phase 5
History

- Completed work-order table
- Search/filter
- Detail view
- Full production record

### Phase 6
Integration validation

Verify:

ERP → Work Order
Work Order → Production Session
PLC → Production Console
Manual Input → Production Record
Production Record → History

---

# 13. ACCEPTANCE CRITERIA

The implementation is complete only when:

[ ] Sidebar contains Work Order, Capture and History.

[ ] ERP work orders appear in Work Order.

[ ] Work Order UI follows the supplied screenshot's information hierarchy.

[ ] Clicking a work order opens its detail card.

[ ] Clicking LOAD / MOVE TO PRODUCTION opens the production console.

[ ] Existing ERP information is automatically pre-filled.

[ ] Draw Bench mapping is read from the actual Excel mapping.

[ ] PLC-mapped fields are populated from PLC data.

[ ] Manual fields remain available for operator input.

[ ] Every Draw Bench has a machine card in Capture.

[ ] Clicking a Draw Bench opens its production console.

[ ] Current running work order is automatically associated with the machine.

[ ] Production quantities are recorded correctly.

[ ] Breakdown/stoppage information can be captured.

[ ] Production remarks can be captured.

[ ] Completing a work order creates a production history record.

[ ] History displays completed work orders in a table.

[ ] Clicking a history row displays the complete production record.

[ ] Historical records show the values actually captured during production.

[ ] No ERP/PLC values are fabricated.

[ ] No parameter names or PLC addresses are invented.

[ ] Existing project architecture and APIs are reused.

[ ] No unrelated existing functionality is broken.

---

# CORE USER FLOW

The final operator workflow should be:

WORK ORDER
    ↓
Select Work Order
    ↓
Work Order Detail Card
    ↓
LOAD / MOVE TO PRODUCTION
    ↓
CAPTURE
    ↓
Select / Open Draw Bench
    ↓
Production Console
    ↓
ERP Data + PLC Data + Manual Input
    ↓
Save / Confirm Production
    ↓
Complete Work Order
    ↓
HISTORY
    ↓
Select Completed Work Order
    ↓
Full Production Record