# A-59 Tube Mill · M1 Dev Specs

Developer documentation for the Zedral Module M1 (Data Capture) build on the Goodluck India A-59 ERW tube mill. These docs are written to be **self-sufficient for the IDE**: the working, the architecture, the data model, the contracts and the API are all here, keyed to real paths in the Zedral monorepo. No other document is required to understand or build the feature.

## Reading order

1. **`ZEDRAL_TUBEMILL_M1_A59_ARCHITECTURE.md`** — read first.
   The platform this plugs into (stack, monorepo, event bus, canonical model, Manifold connectors, RLS, offline PWA) and the new PLC-first runtime (collector → server → tablet), with data-flow diagrams, event contracts and deployment topology.

2. **`ZEDRAL_TUBEMILL_M1_A59_IMPLEMENTATION_SPEC.md`** — the buildable plan.
   Domain model (run / coil-input / bundle), full DDL for every new table, the TM-02 master seed, Zod contracts, the six-form AUTO/DERIVED/MANUAL field map, autofill + band-check logic, the mill state machine, the HTTP API, services and client components with file paths, RBAC/RLS, phased build order, acceptance tests, and open questions.

## The idea in one line

Track everything against the **production run** (not the coil), let the welder and line controls **report their own** speed, power, stops and counts, use the **TM-02 chart** to pre-fill tooling and flag out-of-range power, **force the first-tube check** before counting good output, and leave the operator only what a person must measure or judge. The six paper forms then assemble themselves.

## Build order (demo reachable at step 2)

1. Master + model + contracts (migrations, TM-02 seed, `tubeMillForms.ts`)
2. Operator run console with mocked machine values  ← demo point
3. Collector (real PLC/welder tags), hourly rollup, auto stoppage + count, band exceptions
4. Consumables/tooling life, yield reconciliation, DPR/Shift Summary export
5. Dynamics 365 BC plan read + actuals write-back; security hardening (run as `m1_app`, audit fixes H-1/H-2/M-1)

## Open questions that gate schema freeze

O-1 stoppage code list · O-2 which PLC tags actually exist on A-59 · O-3 missing referenced formats (TM-05/09/07, route card, control plan) · O-4 quality-class rules · O-5 full size/section list + SWG↔mm · O-6 tube weight formula · O-7 time-series retention · O-8 upstream lineage scope. Detail in the implementation spec §14.

## Related material (not in this folder)

- Client-facing demo and the plain-language explainer: `../../Claude outputs/`
- The existing product code: the shared `Zedral Code` repo (kept separate from these Goodluck specs). Its `PROJECT_STRUCTURE.md` is the fuller platform map.
