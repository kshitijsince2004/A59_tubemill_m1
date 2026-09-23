# ZEDRAL — M1 · ERP Integration Implementation Plan

**Goodluck India Limited · A-59 CEW/CDW line · ERP: Microsoft Dynamics 365 Business Central · Canonical: on-prem PostgreSQL via Manifold**
**Audience:** developers / IDE agent (backend, integration, frontend), with a section the ERP/IT team consumes. Grounded in the real repo (`zedral_test-share-the-code`) and the ERP Data Matrix v1.0 (194 requirements, 40 API objects, 20 open questions).

Source of truth for field-level detail: `Zedral_A59_M1_ERP_API_Data_Requirement_Matrix.xlsx` (sheets 1–10). This plan turns that matrix into a buildable integration, keyed to actual Zedral primitives. It does **not** restate all 194 rows; it groups them, binds each group to storage, sync and screen, and defines the build.

---

## 0. Principles (fixed)

- **ERP is system of record; Zedral is the shopfloor system of record.** Read from BC is day-one value and low risk; write into live BC is high blast radius, phased in after trust (Manifold's read/write asymmetry).
- **Read-first.** Phase 1 pulls masters + orders and captures on the floor; write-back (Output/Consumption/Scrap journals) is staged and switched on after sign-off (OQ-13).
- **The spine is Lot + WO.** ERP `Production Order No` = plant WO; ERP `Lot No` = plant coil ID `AA-BB-CC-D-EEEE`. These bind every M1 record to the plant genealogy and map onto the existing `coil.coil` spine + `planning.order_journey` (OQ-05).
- **`data_source` everywhere.** Every captured value carries `MANUAL|PLC|SCADA|SENSOR|API` (default MANUAL). ERP-sourced fields are marked `API`; the record shape never changes when PLC arrives in Phase 2.
- **Do not duplicate ERP masters.** Mirror what M1 needs, key back to BC ids, and let BC stay authoritative; Zedral owns only what BC does not hold (allocation, capture, quality, tooling, roles).

---

## 1. Where this lands in the codebase

Reuse the existing integration primitives; do not invent a parallel stack.

```
packages/connectors/                         Manifold — the ERP ingress
  src/framework/ base.ts, registry.ts        connector base + registry (exists)
  src/plugins/bc-business-central/           NEW — the D365 BC connector plugin
    client.ts       OData/REST client (auth, paging, retry)
    entities/       one puller per API object group (masters, orders, ledgers, codes)
    mappers.ts      BC field -> canonical field (Manifold field-mapping)
    watermarks.ts   delta cursors per entity
packages/platform/src/
  canonical/        entities.ts, eventContracts.ts   extend with ERP-sourced entities
  writeback/WritebackClient.ts               the Zedral -> ERP poster (exists) — add BC journal posters
  registry/                                  register the BC connector + creds
packages/server/src/
  routes/importRoutes.ts, canonRoutes.ts     ingest + canonical endpoints (exist)
  services/                                  ErpSyncService, ErpWritebackService (NEW)
  modules/m1-collection/                     capture -> emits the events write-back consumes
  migrations/modules/erp/                    NEW — erp landing schema + watermarks + outbox
```

New DB schema **`erp`** (landing + control), feeding the existing `master` / `coil` / `planning` / `txn` schemas. Nothing about capture changes; ERP data flows *into* the same masters M1 already reads.

---

## 2. Data ownership matrix (summary)

Full per-field classification is in the workbook's `Source Classification` column. Condensed:

| Class | Who owns | Direction | Examples | Count (approx) |
|---|---|---|---|---|
| **ERP Required** | Business Central | ERP → Zedral (read) | company, location, work/machine centers, items, UoM, routing, BOM, production orders, lot info, calendars, stop/scrap codes, employees, standard cost, ledgers | ~95 |
| **Shopfloor System** | Zedral (M1) | captured; some → ERP | actual qty, good/reject/scrap, start/end, run/setup, downtime events, bath/zone params, draw dims, allocation, crew, PIN login | ~70 |
| **Derived** | Zedral (M1) | computed, never requested | OEE (A/P/Q/overall), cycle time, idle, yield, MTBF/MTTR, loss-in-INR | ~25 |
| **External Source** | outside ERP+M1 | read if present | maintenance WO/PM (CMMS or Zedral M2), attendance, skill matrix, QMS certs/defects | ~10 |
| **Write-back (Zedral → ERP)** | Zedral generates | Zedral → ERP | output journal, consumption journal, scrap, order finish, WIP reclass, lot disposition | 6 objects |

Rule of thumb: **ERP owns the plan and the identity; Zedral owns what happened on the floor; derived and OEE are Zedral's; write-back returns actuals to close the loop.**

---

## 3. ERP → Zedral read plan (the 34 inbound objects)

Grouped by cadence and exposure. **Standard API v2.0** = ready in BC; **Custom API page** = BC dev work the ERP team must build (the largest dependency, OQ-03). Target = where it lands in Zedral; Screen = where M1 uses it.

### 3.1 Masters — daily batch (low churn)
| API | Object | Exposure | Zedral target | M1 use |
|---|---|---|---|---|
| 001 | Company Information | Std | `security.tenant` map | tenant anchor |
| 002/003 | Location, Dimension values | Std | `master.plant` / `master.section` | plant/section hierarchy |
| 004–008 | Work Center (Group), Machine Center, Shop Calendar, Calendar Entry | **Custom** | `master.machine` / `machine_spec`, `master.work_center` | machine tree, OEE hierarchy, available time |
| 009–014 | Item, Variant, UoM, Category, Item Attribute, SKU | Std (+Custom for attributes) | `master.item` / `master.grade` / spec master | material master, tube spec |
| 016/017 | Production BOM, Routing (Header/Line) | **Custom** | `master.routing`, `master.bom` | operation order, standard times |
| 018 | Customers | Std | `master.customer` | order → customer |
| 031 | Employees | Std | `master.operator` (mirror) | operator master |
| 032/033/034 | Stop codes, Scrap codes, Base calendar | **Custom** | `master.stoppage_code`, `master.scrap_code` | downtime/reject reason masters |

### 3.2 Orders & plan — 15 min batch (P1, the live spine)
| API | Object | Exposure | Zedral target | M1 use |
|---|---|---|---|---|
| 020–024 | Production Order (header, line, routing line, component, capacity need) | **Custom** | `planning.plan_order` + `planning.order_journey` | the WO queue, machine allocation, planned qty/schedule, expected consumption |
| 015 | Lot No. Information | **Custom** | `coil.coil` (lot = coil ID) | coil identity + genealogy |
| 019 | Sales Orders (header/line) | Std | `planning` (link) | make-to-order priority |
| 026 | Reservation Entries | Custom | `planning` | coil→WO reservation |

### 3.3 Ledgers & actuals — hourly/daily batch (reconciliation, P2)
| API | Object | Exposure | Zedral target | M1 use |
|---|---|---|---|---|
| 027/030 | Item Ledger, Warehouse/Bin | Custom | `erp.item_ledger` (mirror) | stock, WIP, reconciliation |
| 028 | Capacity Ledger | Custom | `erp.capacity_ledger` | ERP time vs captured time |
| 029 | Value Entries | Custom | `erp.value_entry` | actual cost (loss valuation) |
| 025 | Requisition/Planning worksheet | Custom | `planning` (look-ahead) | forward plan (P3) |
| 040 | Change notifications / webhooks | Confirm | sync trigger | near-real-time refresh |

**Master churn is low → poll daily; orders are the freshness-critical stream → 15 min (or webhook if OQ-15 confirms change-tracking).** Only `Released` production orders are executable on the floor (dictionary), so the order puller filters on status.

---

## 4. Zedral → ERP write-back plan (the 6 outbound objects)

Capture emits a canonical event; `ErpWritebackService` consumes it, builds the BC payload, posts via `WritebackClient`, and records the result in `erp.writeback_job` (outbox pattern, at-least-once, idempotent on `entryId`). **Phase 1 default = staged** (write to outbox, hold for manual/batch posting) until OQ-13 approves live posting.

| API | Trigger (M1 event) | BC destination | Payload | Validation | On failure | Phase |
|---|---|---|---|---|---|---|
| 035 | operation submitted/approved | Item Journal Line (T83) Output | goodQty, runTime, setupTime, prodOrder+op | qty ≤ planned; op is Released | retry+backoff → outbox → alert | P1 (staged→live) |
| 036 | coil consumed | Item Journal Line (T83) Consumption | item, lotNo, qty | lot exists; reserved to WO | same | P1 |
| 037/019 | scrap logged | Output journal scrapQuantity + scrapCode | scrapQty, scrapCode | scrapCode in master | same | P1 |
| 037 | operation finished | Production Order (T5405) status | set Finished | all ops confirmed | same | P2 |
| 038 | WIP moved | Item Reclass Journal (T83) | lot, from/to location | bin tracked in BC | same | P3 |
| 039 | quality disposition | Lot No. Information (T6505) PATCH | lot hold/quality status | disposition ∈ enum | same | P2 |

Every write-back row is audit-logged (`audit.lineage_ref` + `erp.writeback_job`): trigger, payload, BC response, status, retries. No write-back fires without a successful prior read of the same WO/lot (guard against orphan posts).

---

## 5. Storage design (minimal new tables)

Reuse `master` / `coil` / `planning` / `txn` as the working store. Add one control schema:

```sql
CREATE SCHEMA erp;                                   -- BC landing + control
erp.sync_watermark(entity, last_cursor, last_run_at, status)   -- delta cursors per API object
erp.raw_landing(entity, bc_id, payload jsonb, fetched_at)      -- durable, replayable raw (Manifold landing)
erp.item_ledger / erp.capacity_ledger / erp.value_entry        -- mirrors used only for reconciliation
erp.writeback_job(id, entry_id, api, payload jsonb,            -- outbox
   bc_response jsonb, status, attempts, if_version, created_at)
erp.code_map(zedral_code, bc_code, kind)                       -- Stop/Scrap/UoM/section crosswalk
```

Masters land in their existing homes (`master.machine`, `master.item`, `master.routing`, `master.customer`, `master.stoppage_code`, …) carrying a `bc_id` + `source='API'`. Orders land in `planning.plan_order` / `order_journey` (the queue M1 already consumes). Lots land in `coil.coil`. Nothing new in capture. This keeps ERP data flowing into the tables M1 screens already read.

---

## 6. Field-level mapping (approach + representative rows)

The workbook's sheets 2–8 are the full field list (BC table/object, data type, unit, id, FK, sample). The dev mapping adds four columns: **Zedral target table.field · transformation · sync direction · frequency.** Representative rows (build the rest the same way from the workbook):

| ERP object.field | Type | Zedral target | Transformation | Dir | Freq |
|---|---|---|---|---|---|
| Machine Center.machineCenterNo | Code | `master.machine.machine_code` | map BC code → plant tag via `erp.code_map` | IN | daily |
| Machine Center.workCenterNo (parent) | Code | `master.machine.work_center` | build tree | IN | daily |
| Routing Line.runTimePerUnit | Dec min | `master.routing_line.ideal_cycle` | unit normalise → min/pc | IN | on change |
| Item Attribute OD/ID/THK/grade | Dec/Str | `master.grade_spec` | attribute→spec cols (or Zedral owns if absent, OQ-06) | IN | on change |
| Production Order.no + status | Code/Enum | `planning.plan_order` | filter status=Released | IN | 15 min |
| Prod Order Component.lotNo | Code | `coil.coil.coil_no` | lot = coil ID (parse AA-BB-CC-D-EEEE) | IN | 15 min |
| Stop (T99000752).code | Code | `master.stoppage_code` | crosswalk to canonical loss taxonomy | IN | daily |
| Item.standardCost | Dec INR | `master.item.std_cost` | costing method per OQ-17 | IN | weekly |
| — captured — goodQty | Dec | `txn.prod_*.good_qty` | — | (capture) | RT |
| goodQty+runTime → Output journal | Dec | Item Journal Line (T83) | aggregate per op, map ids | OUT | on event |
| disposition → lot status | Enum | Lot No. Information (T6505) | enum→BC hold flag | OUT | on event |

UoM: quantities cross KG↔MTR↔PCS↔MT along the route; use BC Item UoM conversion factors (API-011, OQ-20) — never hardcode. Dates/times ISO 8601 Asia/Kolkata (+05:30).

*(Optional companion: I can emit the full 194-row mapping as an Excel that mirrors the workbook plus these four columns.)*

---

## 7. Sync strategy

- **Cadence by volatility:** masters daily (on-change poll), reason/UoM daily, orders + lots + routing lines 15 min, capacity/reservation 30 min, ledgers hourly/daily, cost weekly, base calendar monthly.
- **Delta first:** each entity keeps a cursor in `erp.sync_watermark` (BC `Last Modified Date Time` / change-tracking). Full refresh only on first load or drift.
- **Change tracking / webhooks (OQ-15):** if BC exposes them (API-040), switch orders/lots to push for sub-minute freshness; else batch polling at the cadences above.
- **Durability:** raw payload lands in `erp.raw_landing` before transform, so a mapping fix can replay without re-hitting BC.
- **Idempotency:** upserts on `bc_id`; write-back idempotent on `entry_id` with `if_version` guard.
- **Backfill (OQ-18):** history durations in the workbook (orders 24 mo, lots 36 mo, ledgers 12–24 mo) pulled by bulk export or API paging as the ERP team confirms.

---

## 8. Authentication & security

- **Connection (OQ-01/02/04):** on-prem BC → OData v4 / SOAP web services; cloud BC → REST + OAuth2/Entra ID. Use a **non-interactive, renewable service credential** (client-credentials or Web Service Access Key). Store in the platform secret store; never in code.
- **Least privilege:** read scopes for the inbound objects; a separate, narrowly-scoped credential for write-back, enabled only when Phase-1 write-back is signed off.
- **Tenanting:** BC company → Zedral tenant; all landed rows carry `tenant_id`; RLS as elsewhere. Run the app as `m1_app` (not superuser) before this onboards live (carry-over audit fix).
- **Sandbox (OQ-19):** validate reads and especially write-back against a BC UAT company before touching production.
- **PII (OQ-16):** pull minimal Employee fields; operator auth stays Zedral SuperTokens/PIN, never sourced from or written to ERP.

---

## 9. M1 screen data usage (where ERP data appears)

| Screen | ERP-sourced data | Zedral-owned |
|---|---|---|
| Order/WO queue + assignment | production order, line, status, planned qty, schedule, machine allocation, customer | operator allocation, actual machine confirm |
| Capture header (all 4 processes) | WO, item/grade/spec, lot/coil, UoM, routing op order | shift, operator, data_source, entries |
| Furnace/STP/Draw/Tube forms | item spec + tolerance (1st/last-off check), standard times | measured params, quality, downtime |
| Machine Head review | machine tree (work/machine center), planned vs actual | submitted records, approvals |
| Plant Head / OEE | calendar/available time, ideal cycle time, standard cost | OEE (derived), loss-in-INR (ERP cost × derived loss) |
| Reconciliation | item ledger, capacity ledger, value entry | captured qty/time vs ERP-posted |

ERP reads are cached in the Zedral masters/planning tables (not fetched per screen); screens read Zedral tables. Only reconciliation views touch the `erp.*` mirrors.

---

## 10. Validation & error handling

- **Ingest validation:** schema-check each payload; reject rows missing a required id; UoM present; unknown codes → quarantine + alert (do not silently drop).
- **Reconciliation jobs:** daily compare M1 captured output/consumption vs BC Item + Capacity Ledger; flag drift beyond tolerance to a reconciliation queue.
- **Error taxonomy:** transient (network/429/timeout) → retry with backoff; permanent (auth, 4xx schema) → dead-letter + alert; write-back conflict (order not Released, qty over plan) → hold in outbox with reason, surface to supervisor.
- **Observability:** every sync + write-back writes to `erp.sync_watermark` / `erp.writeback_job` and the platform observability layer; a health endpoint shows last-success-per-entity and outbox depth.
- **No user-facing DB errors:** operators see plain messages; developers get structured logs.

---

## 11. Phases (mapped to the matrix P1/P2/P3)

- **Phase A — Read masters + orders (P1):** BC connector, auth, masters (company/location/work+machine centers/items/UoM/routing/employees/stop+scrap codes), production orders + lot info on 15-min sync. M1 queue and capture headers now ERP-fed. No write-back.
- **Phase B — Capture + staged write-back (P1):** floor capture (the four processes) with `data_source=MANUAL`; Output/Consumption/Scrap posted to the **outbox** (staged, not live). OEE derived from ERP calendar + routing standards + captured actuals.
- **Phase C — Live write-back (P1→P2, gated by OQ-13/19):** switch outbox to live BC journal posts against UAT then production; add order-finish and lot-disposition write-back.
- **Phase D — Ledgers, reconciliation, cost (P2):** item/capacity/value ledgers; reconciliation jobs; loss-in-INR.
- **Phase E — Enhancements (P3):** reservations/warehouse bins, requisition look-ahead, serialized product, base-calendar holidays, external CMMS/QMS/attendance links.

---

## 12. Dependencies & risks (the 20 open questions are the critical path)

The integration cannot be scoped precisely until the ERP team answers OQ-01…20. The blockers, ranked:

- **OQ-03 (biggest):** manufacturing entities (Production Orders, Routing, BOM, Work/Machine Centers, Capacity, Stop/Scrap, Lot Info) are **not in standard API v2.0** → BC **custom API pages** are required. This is the largest dependency and gates Phase A. Hand the ERP team the API Requirement Matrix (sheet 1) as the build list.
- **OQ-01/02/04:** deployment (on-prem vs cloud), BC version, auth method — decide the connector's protocol and credential.
- **OQ-05:** coil ID stored as Lot No. and slit-ID handling — the genealogy spine; if not, Zedral owns lot mapping.
- **OQ-06/07/10:** where item spec, shift master, and quality/lot-status live — each either an ERP read or a Zedral-owned master.
- **OQ-13/19:** write-back scope and a UAT environment — blast radius of live posting; keep staged until agreed.
- **OQ-09/17:** reason-code configuration (TM-FT-03 code list still missing) and costing method — needed for OEE loss and loss-in-INR.
- **OQ-08/16:** CMMS and HR/attendance existence — decide External Source reads vs Zedral M2/allocation ownership.
- **Platform risks:** custom-API-page delivery timeline on the ERP side; write-back reconciliation; run-as-`m1_app` before live; ISO-8601/timezone consistency; UoM conversion authority (OQ-20).

---

## 13. Development task breakdown

**Integration (Manifold / connectors)**
1. `bc-business-central` connector: OData/REST client with auth, paging, retry, rate-limit handling.
2. Entity pullers per group (masters, orders+lots, ledgers, codes) with `erp.sync_watermark` cursors and `erp.raw_landing`.
3. `mappers.ts` BC→canonical, `erp.code_map` crosswalks, UoM conversion via Item UoM.
4. `ErpSyncService` scheduler (cadences §7) + webhook subscriber (if OQ-15).

**Backend (write-back + storage)**
5. `erp` schema migration (watermark, raw_landing, mirrors, writeback_job, code_map).
6. Extend `WritebackClient` with BC journal posters (Output/Consumption/Scrap/Status/Reclass/LotPATCH).
7. `ErpWritebackService` outbox consumer (staged→live flag, idempotency, `if_version`).
8. Reconciliation job (captured vs Item/Capacity ledger); health endpoint.
9. Map masters into `master.*`/`planning.*`/`coil.coil` with `bc_id`+`source='API'`.

**Frontend**
10. Bind order queue, capture headers, machine tree, spec-check, OEE and reconciliation views to the Zedral tables now ERP-fed (§9). No per-screen ERP calls.

**ERP team (hand-off)**
11. Build the BC **custom API pages** per sheet-1 list; provide endpoints, auth, sample responses; configure Stop/Scrap codes; confirm Lot=coil ID; provide UAT.

**QA**
12. Unit (mappers, UoM, code map), integration (each puller against UAT), write-back (staged then live in UAT), reconciliation (M1 vs ledgers), E2E (order→capture→write-back→ledger), and ERP–Zedral reconciliation sign-off.

---

## 14. Recommended sequence

1. ERP team answers OQ-01…20; agree the custom-API-page build list (sheet 1).
2. Stand up the `bc-business-central` connector + auth against **UAT**; land Company/Location/Item/UoM/Employee via standard API to prove the pipe.
3. Deliver the master custom API pages → land Work/Machine Center, Routing, Stop/Scrap codes, Calendar.
4. Land Production Orders + Lot Info on 15-min sync → M1 queue and capture headers go live (Phase A).
5. Turn on floor capture with `data_source=MANUAL`; post Output/Consumption/Scrap to the **outbox** (Phase B).
6. Validate write-back in UAT, then enable live posting in production (Phase C, gated by OQ-13/19).
7. Add ledgers + reconciliation + loss-in-INR (Phase D), then P3 enhancements (Phase E).

---

## Bottom line

The matrix is already a clean, prioritised request to the BC team; this plan binds it to Zedral's existing Manifold connector framework, canonical model, `WritebackClient`, planning/coil spine and capture tables, adds one `erp` control schema, and sequences it read-first with staged write-back. The single gating dependency is BC exposing manufacturing objects as custom API pages (OQ-03); everything else is standard connector, mapping and outbox work in the existing architecture. Nothing about the four-process M1 capture changes — ERP data simply flows into the masters and order queue M1 already reads, and actuals flow back when the write-back is signed off.

*Grounded in `zedral_test-share-the-code` (real primitives cited) and the ERP Data Matrix v1.0. Field-level detail lives in the workbook; open questions OQ-01…20 are the critical path.*
