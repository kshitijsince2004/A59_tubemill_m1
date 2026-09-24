# ZEDRAL Machine Head and Plant Head Dashboards, Graphs Implementation Plan

Audience: dev team and IDE. Scope: rebuild the Machine Head and Plant Head dashboards in the A59 Tube Mill M1 build so they carry the graphs each role actually needs, backed by the data each role acts on. Grounded in the uploaded `A59_tubemill_m1-dev` code (`Code/client`, `Code/server`). This document is standalone.

## 0. What exists today, checked in the code

Both dashboards are a KPI strip plus plain HTML tables. There is no chart anywhere and no charting library in `Code/client/package.json` (only react, react-router, react-query, supertokens). So the honest starting point is: the roles have numbers, they do not have graphs.

| Surface | File | Today |
|---|---|---|
| Machine Head desk | `client/src/pages/machinehead/MachineHeadDashboard.jsx` | KPI strip (Processes, Running, Submitted, Hold, Pending) and a per process status table |
| Plant Head overview | `client/src/pages/planthead/PlantHeadDashboard.jsx` | KPI strip (Prime MT, Yield, OEE, Downtime, Backlog, Holds, Alerts), a process status table, a top defects table, a top stoppages table |
| Machine Head menu | `client/src/components/layout/machinehead/MachineHeadNav.jsx` | Desk, Review, Orders, Crew, Quality, Trace, Exports |
| Plant Head menu | `client/src/components/layout/planthead/PlantNav.jsx` | Overview, Live, Production, Orders, Defects, Downtime, Alerts, Exports, Users, Lines, Audit |

The data comes from `server/src/services/PlantReportingService.js` (Plant Head) and `server/src/services/MhReviewService.js` (Machine Head), exposed by `server/src/routes/reportRoutes.js`.

Two facts from the data layer shape everything below.

1. The reporting services return snapshot aggregates for a window, not a time series. `getPlantHeadDashboard(windowDays)` gives one set of totals for the whole window. `getDailyReport(date)` gives one single day. Nothing returns a day by day array. So no trend chart can be drawn until a series endpoint exists.
2. The raw material for real graphs already exists in the production tables: `txn.prod_tm_run` (prime, raw, scrap, yield, speed observed vs spec, weld params), `txn.prod_ann_run` (furnace output, zone temperatures), `txn.prod_stp_lot` (bath analysis), `txn.prod_db_lot` (draw dimensions, passes), `txn.stoppage_entry`, `txn.tm_defect`. The gap is aggregation and exposure, not capture.

## 1. Approach in one line

Add a small chart library, add the missing time series and per machine metric endpoints, and replace the two table dashboards with a graph led layout, one built from a shared chart component set so both roles and their sub pages look like one system.

## 2. Decision: charting library

Recommendation: **Recharts** (`recharts`, React SVG, declarative). It covers every graph named below (line, area, bar, composed for Pareto, radial for the OEE gauge, and `ReferenceArea` / `ReferenceLine` for spec bands), it is themeable with the existing CSS tokens, and it fits the React 18 plus Vite stack with one dependency. `ResponsiveContainer` handles the tablet and desk widths already used in the shells.

Alternatives considered: uPlot (smallest and fastest, best for dense control charts, but more manual), Chart.js with react-chartjs-2 (canvas, good perf, less React idiomatic), hand rolled SVG (zero dependency, fine for a sparkline or a gauge, too much work for the full set). If bundle size is a hard constraint, use Recharts for the dashboards and hand rolled SVG only for the tiny inline sparklines. Do not mix two chart libraries beyond that.

Install once: add `recharts` to `Code/client/package.json`, and wrap every chart in a `ChartFrame` (section 5) so the library stays swappable.

## 3. Backend additions (the real work)

The dashboards cannot show trends until the service layer returns series. Add these to `PlantReportingService.js` and `MhReviewService.js`, and register them in `reportRoutes.js`. All reads stay tenant scoped, Plant Head unfiltered by machine, Machine Head filtered by machine access exactly as `getMachineHeadDashboard(user)` already does.

### 3.1 Plant Head series

| New method | Route | Returns |
|---|---|---|
| `getPlantHeadTrend(windowDays)` | `GET /reports/plant-head/trend` | daily array `[{ date, primeMt, rawMt, scrapMt, yieldPct, downtimeMin, oee }]` over the window. Same SQL as `getDailyReport` but grouped by day across the range, one row per day |
| `getStageThroughput(windowDays)` | `GET /reports/plant-head/stages` | per process MT and count for the route Tube Mill, Furnace, STP, Draw Bench, Swage `[{ process, inputMt, outputMt, count }]` |
| already present | `GET /reports/downtime`, `/reports/defects` | top stoppages and top defects, already ranked, ready for Pareto |

`getPlantHeadTrend` is a range group by: reuse the `txn.prod_tm_run` and `txn.stoppage_entry` queries from `getDailyReport`, replace the single day bounds with `>= since`, and `GROUP BY date_trunc('day', ...)`. Compute yield and OEE per day the same way `getPlantHeadDashboard` does today.

### 3.2 Machine Head series and quality

| New method | Route | Returns |
|---|---|---|
| `getMachineHeadTrend(user, { process, machine })` | `GET /reports/machine-head/trend` | per shift or per day output for the machine head's machines `[{ date, mt, yieldPct, runs }]` |
| `getProcessQualitySeries(user, { process, machine })` | `GET /reports/machine-head/quality` | the process specific control chart data, spec band plus readings (see 3.3) |
| already present | `GET /reports/machine-head`, `/reports/machine-head/pending` | status counts and the review queue |

### 3.3 Process quality series, the shape per process

This is what makes the Machine Head dashboard useful rather than decorative. Each returns readings against a spec band so the chart can draw the band and flag the excursion.

| Process | Source | Series shape |
|---|---|---|
| Furnace (FUR) | `txn.prod_ann_run` zone temperatures | `[{ at, zone1..zone6, min, max }]` per run, so the chart draws each zone reading against its recipe min and max band (ANN-FT-01) |
| Tube Mill (TM) | `txn.prod_tm_run` speed | `[{ at, speedObs, speedMin, speedMax }]`, observed line speed against the spec band; a second series for weld current if wanted |
| STP | `txn.prod_stp_lot` bath rows | `[{ at, bathCode, observed, specMin, specMax }]`, bath concentration observed vs spec (STP-FT-01A) |
| Draw Bench (DRW) | `txn.prod_db_lot` | `[{ passNo, odFrom, odTo, target, tol }]`, OD reduction per pass against target and tolerance (DB-FT-01) |

## 4. Plant Head dashboard, the graphs

Plant Head is plant wide oversight. The question the dashboard answers is: are we producing enough, at quality, efficiently, across the whole line. Keep the KPI strip, then lead with graphs. Menu stays as is; the graphs live on Overview and the matching sub pages (Production, Defects, Downtime).

| # | Graph | Form | Why this form | Data |
|---|---|---|---|---|
| 1 | Prime MT trend | area or line, one series, days on x | change over time of the headline output | `getPlantHeadTrend.primeMt` |
| 2 | Yield trend vs target | line, one series, with a 90% `ReferenceLine` | yield is a rate, a line reads the direction; the target line gives the pass or fail read at a glance | `getPlantHeadTrend.yieldPct` |
| 3 | OEE gauge plus A P Q | one radial gauge for current OEE, and a small three bar breakdown of Availability, Performance, Quality | a single headline number plus its three drivers; never a dual axis | `kpi.oee`, `kpi.availability`, `kpi.performance`, `kpi.quality` |
| 4 | Stage throughput | horizontal bar in route order Tube Mill, Furnace, STP, Draw Bench, Swage | magnitude by category, ordered by the physical route so the manager sees where volume drops between stages | `getStageThroughput` |
| 5 | Downtime Pareto | bars sorted by minutes, highest first | the few stoppage codes that cause most downtime | `getDowntimeIntelligence.topStoppages` |
| 6 | Defect Pareto | bars sorted by count (toggle to MT) | the few defects that cause most rejection | `getDefectIntelligence.topDefects` |
| 7 | Machine status | donut or single stacked bar, Running, Idle, Hold | one glance at how much of the line is live right now | `kpi.machinesRunning/Open/Hold` |

Notes that follow the chart standards in section 6. The Pareto charts are ranked bars; if a cumulative percentage is wanted, show it as point labels rather than a second y axis, because a dual axis is not allowed. OEE availability, performance and quality are each a 0 to 100 percentage, so the three bar breakdown shares one axis. Today `performance` is hardcoded to 85 and `quality` falls back to yield in `PlantReportingService.js`; label the OEE tile "estimated" until a real cycle time performance factor lands, so the gauge is not read as measured.

Sub page enrichment, same components:
- `PlantProduction.jsx`: graph 1 and 4 at full width, plus a per machine daily output bar from `getDailyReport`.
- `PlantStoppages.jsx` (Downtime): graph 5 plus a downtime minutes trend line.
- `PlantDefects.jsx`: graph 6 plus a scrap MT trend line.

## 5. Machine Head dashboard, the graphs

Machine Head is machine scoped operations. The question is: are my machines running to spec and are shifts clear to approve. The graphs are more control chart than KPI. Everything is filtered to the head's `machineAccess`, which `getMachineHeadDashboard(user)` already enforces.

| # | Graph | Form | Why this form | Data |
|---|---|---|---|---|
| 1 | Process status | small stacked bar per process, Open, Running, Submitted, Hold | replaces the wall of numbers with one compact read across TM, FUR, STP, DRW, SWG | `/reports/machine-head` byProcess |
| 2 | Shift output vs target | grouped bar per shift or day, produced MT with a target `ReferenceLine` | did my machines hit target this shift | `getMachineHeadTrend.mt` |
| 3 | Yield trend | line vs a target `ReferenceLine` | quality direction on my machines | `getMachineHeadTrend.yieldPct` |
| 4 | Process quality control chart | line with a shaded spec band (`ReferenceArea` min to max), a point per reading, out of band points flagged | this is the core Machine Head graph: it shows at a glance whether the process ran inside spec and where it broke, which is exactly the gate the head signs | `getProcessQualitySeries` per 3.3 |
| 5 | Pending review aging | horizontal bar of pending items bucketed by age (under 1h, 1 to 4h, over 4h) | shows not just how many are waiting but how stale, so the head clears the oldest first | `/reports/machine-head/pending` with created_at |

Graph 4 is process aware. On the Furnace desk it draws the six zone temperatures against their recipe bands. On the Tube Mill desk it draws observed line speed against the speed band. On STP it draws bath concentration against limits. On Draw Bench it draws OD reduction per pass against target and tolerance. The desk pages already exist (`MhProcessLivePage.jsx`, routes `/machine-head/{tm,fur,stp,drw,swg}/live`); mount the matching control chart on each.

## 6. Chart standards (apply to every graph)

These come straight from the visualization method and prevent the usual dashboard mistakes.

1. Pick the form by the data's job first, color last.
2. One axis per chart. Never a dual axis. Two measures of different scale, for example MT and yield percent, are two charts, not one with two y scales. This is why production trend and yield trend are separate charts above.
3. Categorical colors follow the entity in a fixed order, never cycled and never repainted when a filter changes the series count. Use the Zedral brand tokens for the categorical set, and reserve status colors (good, warning, serious, critical) for state only, never as a fifth series color.
4. Spec bands are a `ReferenceArea` (min to max) behind the reading line; the target is a `ReferenceLine`. Out of band points get a status color plus a marker shape, never color alone.
5. Every line and bar chart ships a hover tooltip and a crosshair; a single series needs no legend (the title names it), two or more always get a legend and up to four are also direct labeled.
6. Dark mode is a selected set of steps, not an automatic invert; a table view of the same data is available behind each chart for accessibility and export.
7. Validate the categorical palette with the script in the dataviz skill (`scripts/validate_palette.js`) before shipping; do not eyeball colorblind safety.

## 7. Shared component set

Build one chart set so both dashboards and all sub pages match. Put it in `client/src/components/charts/`.

| Component | Wraps | Used by |
|---|---|---|
| `ChartFrame` | title, subtitle, legend slot, table toggle, empty and error states | every chart |
| `TrendLine` | Recharts LineChart or AreaChart, one series, optional target line | PH 1, 2; MH 3 |
| `BarSeries` | BarChart, grouped or stacked | PH 4, 7; MH 1, 2, 5 |
| `ParetoBar` | ranked BarChart, descending, optional cumulative labels | PH 5, 6 |
| `RadialGauge` | RadialBarChart for a single 0 to 100 value | PH 3 |
| `BandControlChart` | LineChart plus `ReferenceArea` band and flagged points | MH 4, the process quality chart |
| `StatTile` | the existing KPI cell, kept for the strip | both strips |

`ChartFrame` owns the empty state, the error strip and the table toggle, so no chart reimplements them. Feed all charts through react-query hooks keyed on the endpoint and window, so refresh and caching are consistent with the rest of the app.

## 8. Menu changes

Menus barely change; the graphs go where the data already lives.

- Machine Head nav: no new item needed. The Desk becomes graph led (graphs 1, 2, 3, 5), and each process live page gains its control chart (graph 4). Optionally rename Desk to "Desk" and keep it as the home.
- Plant Head nav: no new item needed. Overview becomes graph led (graphs 1 to 7). Production, Defects and Downtime sub pages gain their charts. If a single deep analytics view is wanted later, add one "Trends" item pointing at a page that stacks graphs 1, 2, 3, 4; not required for this phase.

## 9. Build order

1. Add `recharts` and build the `charts/` component set with `ChartFrame`, `TrendLine`, `BarSeries` first, against mock data.
2. Add the Plant Head series endpoints (`getPlantHeadTrend`, `getStageThroughput`) and wire graphs 1, 4, and the two Paretos, since their data is closest to ready.
3. Add the OEE gauge and machine status donut from the existing `kpi`.
4. Add the Machine Head trend and status graphs (1, 2, 3, 5).
5. Add `getProcessQualitySeries` and the `BandControlChart` last, one process at a time, Furnace first since its zone band is the clearest win.
6. Fill the sub pages (Production, Defects, Downtime) with the same components.
7. Fix the OEE performance factor or label it estimated.

## 10. QA and acceptance

- Every chart has a hover tooltip, a legend when two or more series, an empty state, and a table toggle.
- No chart uses two y axes. Production and yield are separate charts.
- The palette passes `scripts/validate_palette.js` in light and dark mode.
- Plant Head trends move day by day over the selected window; changing the window updates every chart.
- Machine Head charts show only the head's machines; a head with one machine never sees another's data.
- The Furnace control chart draws all six zones against their bands and flags an out of band reading; the same chart on Tube Mill, STP and Draw Bench shows the right process metric.
- OEE is labeled estimated until the performance factor is real.
- Dashboards degrade cleanly when a series endpoint returns empty (the `safeQuery` fallback pattern already used server side).

## 11. Bottom line

Today both roles have KPI strips and tables and no graphs, and the reporting layer returns snapshots with no time series. The plan adds one chart library, a small shared chart component set, and the missing series and quality endpoints (the raw data already exists in the production tables), then makes each dashboard graph led around what the role decides on. Plant Head gets production and yield trends, an OEE gauge, a stage throughput bar for the Tube Mill to Draw Bench route, and downtime and defect Paretos. Machine Head gets per process status bars, shift output and yield trends, pending aging, and the process control charts with spec bands that are the real point of the desk. Menus barely change; the work is the endpoints, the component set, and holding to one chart standard so it reads as one system.

Grounded in the uploaded `A59_tubemill_m1-dev` code.
