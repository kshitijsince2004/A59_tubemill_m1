# ZEDRAL — TypeScript → JavaScript Migration · Implementation Plan

**Repo:** `zedral_test-share-the-code` (npm-workspaces monorepo). **Audience:** developers / IDE agent.
Grounded in the real codebase, not the generic brief. Preserves behaviour; changes only the source language. Per the brief §14, every destructive step below carries a *what / why / what-breaks / how-protected* note.

---

## 0. Read this first — reality check and recommendation

Two facts change how this should be done:

**A. The runtime is already JavaScript.** The server ships as `node dist/index.js` (compiled by `tsc -b`); the client is built by Vite/esbuild, which strips types at build time. TypeScript here is a **build-time and author-time** tool, not a runtime one. So "migrate to JavaScript" is a *source-language* change, not a shipping-artifact change — the deployed app is already JS.

**B. The type layer is load-bearing, and an independent audit already flagged latent bugs.** The server is **Kysely** (a TypeScript-first, compile-time-safe SQL builder) across **354 files**, with **449 `as any`** casts. The prior pre-prod audit found real bugs those casts were hiding (H-1 `carryForward.ts` writing non-existent tables; H-2 RLS-bypass; M-1 token/tenant). Removing TypeScript deletes the one mechanism that can catch this class of bug at author time.

**Recommendation (state it, then follow the user's call):** do the migration the **compiler way, not the hand-editing way** — strip types automatically with Babel so behaviour is provably preserved, keep **Zod** (runtime validation, already in the codebase) as the boundary guard, and add **JSDoc + `checkJs`** so editors keep *some* safety. Do it **package by package, leaf-first, server last**, behind a branch, with the existing test/smoke suites as the gate. And fix H-1/H-2/M-1 **before** starting, because the migration removes the net that would otherwise catch a regression.

If the goal was only "ship JS" — that is already true and no migration is needed. If the goal is "the team writes JS, not TS" — the plan below delivers that with the least risk. This document assumes the migration proceeds.

---

## 1. Codebase facts (grounding)

| Package | Files | Role | Build / run | Migration risk |
|---|---|---|---|---|
| `@m1/shared-validation` | 54 .ts | Zod contracts + helpers | `tsc` → dist, consumed by client+server | **Low** (Zod is runtime; drop `z.infer` types) |
| `@zedral/platform` | 17 .ts | event bus, canonical, writeback, registry | `tsc` → dist | Low–med (interfaces → JSDoc) |
| `@zedral/connectors` | 5 .ts | Manifold framework | `tsc` → dist | Low |
| `@zedral/m1-collection` | 2 .ts | capture module | `tsc` → dist | Low |
| `@m1/server` | 354 .ts | API, Kysely DB, services, export | **`tsc -b`** → `dist`, prod `node dist/index.js`, dev `tsx watch` | **High** (Kysely type loss; build swap) |
| `@m1/client` | 165 .ts + 225 .tsx | React PWA + Capacitor | **Vite** (esbuild) + vite-plugin-pwa | Med (volume; behaviour preserved by esbuild) |

**Stack correction:** the brief mentions Supabase; **this codebase does not use Supabase.** It is **PostgreSQL + Kysely + node-pg-migrate + SuperTokens (self-hosted) + Elasticsearch**. Auth is SuperTokens sessions + scrypt/PIN. Treat those as the "backend integrations" to preserve.

**Constructs that affect the strip (measured):** enums **2 files / 6 uses** (no `const enum`), `namespace` **1 file**, decorators **0**, `abstract` **0**, **constructor parameter properties 6 files** (the only non-trivial transform), `import type` **314 uses / 242 files** (pure strip), `as any` **449** (pure strip, runtime-neutral), hand-written `.d.ts` **2**, `db-types.ts` = kysely-codegen output (pure types), vitest configs **5 (.ts)**. Module systems: **server + root = CommonJS**, **client = ESM** (`type: module`). Path aliases: `@zedral/platform`, `@zedral/m1-collection`, `@zedral/connectors`, `@m1/shared-validation` (tsconfig `paths` + Vite).

---

## 2. Approach: automated type-strip, not hand-editing 665 files

Hand-converting 665 files is slow and error-prone. Use **Babel `@babel/preset-typescript`** to erase types file-by-file, emitting `.js`/`.jsx` with identical runtime semantics, then hand-fix the small measured residue. Babel is a faithful type-eraser (it does not type-check; it deletes annotations), which is exactly what "preserve behaviour" requires.

**One-time strip config** (`babel.detype.cjs`, used only for the conversion run):
```js
module.exports = {
  presets: [
    ['@babel/preset-typescript', { allowDeclareFields: true, onlyRemoveTypeImports: true, isTSX: true, allExtensions: true }],
    ['@babel/preset-react', { runtime: 'automatic' }], // for .tsx → .jsx
  ],
  plugins: [
    ['@babel/plugin-transform-typescript', { allowDeclareFields: true }], // ensures parameter properties emit this.x = x
  ],
  // keep everything else untouched; do NOT enable other syntax transforms
  retainLines: true,   // minimise diff noise
};
```

**Per-file conversion** (run per package, `.ts`→`.js`, `.tsx`→`.jsx`):
```bash
# example for one package; script it with a small node walker that also git-mv's
npx babel src --config-file ./babel.detype.cjs \
  --extensions .ts,.tsx --out-dir src --out-file-extension .js --keep-file-extension=false
# then rename .tsx outputs to .jsx, delete the original .ts/.tsx, and run prettier
```
Use a tiny driver script (`scripts/detype.mjs`) that: walks a package, runs Babel per file, writes `.js`/`.jsx` beside the source, `git rm` the original, and rewrites import specifiers that carried extensions. Then `prettier --write` the package to normalise formatting once.

**Manual residue to verify after each package (measured, small):**
- **Parameter properties (6 files):** confirm `constructor(private foo)` emitted `this.foo = foo`. This is the one construct that changes behaviour if mis-handled — diff each of the 6 by hand and add an explicit assignment if Babel dropped it.
- **Enums (2 files):** Babel compiles `enum` to a runtime object — verify the object is emitted and imports still resolve.
- **`namespace` (1 file):** convert to a plain exported object or module.
- **Type-only import lines (242 files):** `import type {...}` lines are removed; verify no *value* import was accidentally in a `type` line (mixed `import { type A, b }` keeps `b`).
- **`db-types.ts`:** pure types — see §7.

---

## 3. Conversion order (dependency-first, risk-last)

Convert in build-dependency order so each package's consumers still resolve, and so the riskiest package (server) is last, on top of already-verified dependencies. Commit and run the gate (§8) after each.

1. **`shared-validation`** (leaf, Zod-heavy, lowest risk). Drop exported `z.infer` types; consumers that did `import type { M1CTLForm }` lose those imports (strip them). Validation runtime is unchanged. Build: keep `tsc`? No — switch this package's build to Babel emit or ship `src` directly (it's ESM/CJS dual-consumed; see §4).
2. **`platform`** (event bus, canonical, writeback). Canonical `interface`/`type` files become JSDoc `@typedef` (or comments). Event bus runtime unchanged.
3. **`connectors`**, **`m1-collection`** (tiny).
4. **`client`** (390 files). Vite already esbuild-strips types, so runtime behaviour is preserved by construction; the change is source `.tsx`→`.jsx`. Lowest *semantic* risk despite highest volume.
5. **`server`** (354 files, Kysely). Highest risk. Do last, alone, with the full smoke/integration suite. Swap the build (§4).

Rationale: shared-validation and platform are imported by everything; converting them first means every later package is compiled against final JS deps. Server last isolates the Kysely risk to one reviewable step.

---

## 4. Build & runtime changes per package

**Client — minimal.** Vite already compiles JSX and strips types; after `.tsx`→`.jsx` it simply compiles `.jsx`. Actions: rename `vite.config.ts`→`vite.config.js` (and `vite.operator.config.ts`, `vitest.config.ts`) — keep contents, drop `as const`/type imports; convert `tsconfig.app/node/json` to a loose `jsconfig.json` (for editor path-alias + `checkJs`). **PWA (vite-plugin-pwa/Workbox), Capacitor Android (`android:apk`, `build:operator`) and the offline runtime are unaffected** because the emitted bundle is identical. Keep `@vitejs/plugin-react`.

**Server — the real work.** Today: `tsc -b` compiles `src` → `dist`, prod runs `node dist/index.js`, dev runs `tsx watch src/index.ts`. After migration there is no `tsc`. Two viable targets, pick one:
- **(preferred) Run JS directly, transpile only if needed.** Server is CommonJS; converted `.js` can run under Node directly. Replace `dev` with `node --watch --env-file=../../.env src/index.js`; replace `build` with a copy/transpile step (Babel `src`→`dist`, plus the existing layout-JSON copy the current build already does). `start` stays `node dist/index.js`.
- **(alt) esbuild bundle** if a single-file dist is wanted. Either way, **path aliases** (`@zedral/*`, `@m1/*`) must resolve at Node runtime — today tsc resolves them; in JS use Node **subpath `imports`** in `package.json` or keep them as real workspace packages (they already are) so Node resolves `@m1/shared-validation` to that package's entry. Confirm each alias resolves before declaring server done (§7 alias note).
- **`tsx` in scripts** (`reindex-traceability.mjs`, dev) → replace with `node`.

**Migrations & scripts — already JS.** 118 migrations are `.js`; all `seed:*`/`smoke:*` scripts are `.mjs`. **No change** beyond removing any `tsx` invocation. `db:codegen` (kysely-codegen) → see §7.

**Workspace build order** (`npm run build`) stays the same sequence; each package's `build` script swaps `tsc` for Babel-emit (or "no build, ship src").

---

## 5. Config & dependency changes

- **Delete/convert tsconfigs:** `tsconfig.base.json`, per-package `tsconfig*.json`, `packages/client/tsconfig.app/node.json`. Replace each with a loose **`jsconfig.json`** carrying only `compilerOptions.paths` (the aliases) + `allowJs: true`, `checkJs: true` (loose) so editors keep alias resolution and light checking. Do **not** keep `composite`/project-refs.
- **Babel:** keep a runtime `babel.config.cjs` only if the server build uses Babel; the client keeps Vite.
- **ESLint:** `packages/client/eslint.config.js` (flat) and `packages/shared-validation/eslint.config.cjs` — remove `@typescript-eslint` parser/plugin and TS rules; keep JS rules. You lose type-aware lint (documented trade-off).
- **dependency-cruiser** (`.dependency-cruiser.cjs`, `arch:check`): update rules to `.js/.jsx` globs; it works on JS. Keep the architecture tests — they guard the "modules don't write each other's tables / import canonically" rules that survive the migration.
- **Remove TS-only deps only after green build:** `typescript`, `tsx`, `@types/*`, `@typescript-eslint/*`, `kysely-codegen` (if codegen dropped), `ts-*`. Keep everything runtime: **Zod, Kysely (runtime works untyped), React, Vite, vite-plugin-pwa, Capacitor, SuperTokens, node-pg-migrate, Elasticsearch client, ExcelJS/export libs.** No version bumps to React/Vite/Node/Supertokens/UI/backend libs.
- **Do not** introduce new libraries to "replace TypeScript." PropTypes are optional and not required; prefer Zod + JSDoc.

---

## 6. Compensating for lost compile-time safety

Preserve safety without TS syntax:
- **Zod at every boundary** — already present (`m1Forms`, the new validation engine). Keep and lean on it: API inputs, form submits, and ERP/import payloads validate at runtime. This is the primary net after migration.
- **JSDoc + `checkJs`** — annotate exported functions and service signatures with `@param`/`@returns` JSDoc; a loose `jsconfig` with `checkJs` gives editor squiggles without TS files. Apply to the DB layer and services first (highest risk).
- **Keep the DB shape visible** — either keep `kysely-codegen` emitting a `db-types.js` JSDoc typedef file (`@typedef`), or retire it and rely on Zod row-guards on critical writes. Decide per §7.
- **Runtime guards where casts hid assumptions** — the 449 `as any` sites were unchecked at author time; where one guarded a DB row shape or an external payload, add a small runtime check. Do this as a *follow-up hardening pass*, not during the mechanical strip (keep the strip behaviour-neutral).

---

## 7. Stop-and-explain: the destructive changes (per brief §14)

**(1) Kysely loses compile-time type safety.**
*What:* the `Database` generic and `db-types.ts` no longer constrain queries. *Why:* those are TypeScript types; JS cannot enforce them. *What breaks:* nothing at **runtime** — Kysely builds the same SQL; but a future wrong column/table name is no longer caught before running. *How protected:* keep `db-types` as JSDoc typedefs + `checkJs`; add Zod guards on the highest-risk writes; **fix H-1/H-2/M-1 before migrating**; lean on integration + smoke tests (§8).

**(2) The `tsc -b` server build is removed.**
*What:* replace with Node-direct run or Babel/esbuild emit. *Why:* no TS to compile. *What breaks:* build/start scripts, path-alias resolution, the dist layout-file copy. *How protected:* keep the exact `dist` layout (including the JSON layout copy the current `build` already does); verify `npm run build && npm start` and `migrate` before/after; preserve aliases via workspace packages or Node `imports`.

**(3) Path aliases (`@zedral/*`, `@m1/*`).**
*What:* tsconfig `paths` stops resolving. *Why:* not a Node runtime mechanism. *What breaks:* every cross-package import in server if unresolved. *How protected:* they already map to real workspace packages — ensure each package's `package.json` `main`/`exports` points to its JS entry so Node resolves the bare specifier; add `imports` subpaths only if needed; run `arch:deps` (dependency-cruiser) to confirm no broken/relative-escaping imports.

**(4) `db-types.ts` deletion and `db:codegen`.**
*What:* generated type file becomes dead. *Why:* pure types. *What breaks:* nothing at runtime; editor DB autocomplete. *How protected:* convert to JSDoc typedef output or retire with Zod guards; remove `db:codegen`/`db:codegen:check` scripts only after.

**(5) Parameter properties (6 files) and enums/namespace (3 files).**
*What:* the only constructs that are not pure erasure. *Why:* they carry runtime behaviour. *How protected:* hand-diff all 9 files post-strip; unit-test the affected services; do not batch them with the mechanical strip commit.

---

## 8. Testing checklist (mapped to the repo's real commands)

Run after **each package** conversion, and fully before merge. This is the migration's gate — nothing merges red.

- **Build:** `npm run build` (full workspace order); `npm run build -w @m1/client` incl. `build:operator`; `npm run android:apk` (offline APK still assembles).
- **Type/imports sanity:** `npm run arch:check` (`depcruise` — no broken/circular imports); grep for leftover `.ts`/`.tsx` and unresolved specifiers.
- **DB:** `npm run migrate` (up) and `migrate:down` on a scratch DB — schema untouched, all 118 migrations run.
- **Server unit + integration:** `npm run test -w @m1/server` (`vitest` unit + `run-integration-tests.mjs`), `test:arch`.
- **Smoke (their existing harness):** `npm run smoke:api`, `smoke:pilot`, `smoke:supervisor`; `seed:pilot` + `seed:process-queues` + `seed:admin` succeed.
- **Client tests:** `npm run test -w @m1/client` (vitest).
- **E2E:** `npm run e2e:smoke`.
- **Manual critical workflows (brief §12):** login/logout (SuperTokens + PIN), operator capture CRUD for a process, form validation (Zod fires), shift handover, an export/download (report .xlsx), an admin flow, offline PWA capture + sync, responsive UI. Check browser console + server logs for new errors/warnings.
- **Diff discipline:** the strip commit for a package should show **only type removals** in `git diff` (annotations, `import type`, `as any`, generics) — any logic change in a strip commit is a red flag to revert.

---

## 9. Git strategy (brief §13)

- Branch `migrate/ts-to-js` off the stable TS `main`; never force-push `main`.
- **Pre-work commit:** fix H-1/H-2/M-1 on a `fix/pre-migration-audit` branch, merge first (with tests) so the safety-net loss is de-risked.
- **One package per commit series:** `detype(shared-validation)`, `detype(platform)`, … each = the mechanical strip commit + a separate `fix(...)` commit for the manual residue + a `chore(build)` commit for that package's script/config. Small, reviewable, revertible.
- Gate (§8) green before the next package. If a step breaks, **revert that commit**, don't patch forward on a broken tree.
- Keep `main` deployable throughout; the branch is only merged after the full gate passes end-to-end.
- Commit trailers per the repo convention.

---

## 10. Phased sequence and go/no-go gates

- **Phase 0 — Pre-work:** fix the audit bugs (H-1/H-2/M-1); set up `babel.detype.cjs` + `scripts/detype.mjs`; dry-run the strip on `shared-validation` in a throwaway branch and diff. **Gate:** clean diff, tests green.
- **Phase 1 — Leaves:** convert `shared-validation` → `platform` → `connectors` → `m1-collection`; swap their build scripts. **Gate:** each builds and is consumed by the still-TS server/client (they compile against the emitted JS + JSDoc).
- **Phase 2 — Client:** convert `.tsx`→`.jsx`, configs to `jsconfig`/`.js`; verify Vite build, PWA, operator APK, client tests. **Gate:** app runs, offline works, no console errors.
- **Phase 3 — Server:** convert 354 files; swap `tsc -b` for the chosen JS build; fix aliases; verify migrate/seed/smoke/integration/e2e. **Gate:** full checklist §8 green.
- **Phase 4 — Config & dependency cleanup:** delete tsconfigs, remove TS-only devDeps, update ESLint/depcruise, retire `db:codegen`. **Gate:** clean install + full build + full test on a fresh checkout.
- **Phase 5 — Hardening (separate, optional):** add Zod guards / JSDoc where the 449 casts hid assumptions. Documented as follow-up, not part of the behaviour-preserving migration.

---

## 11. Risks & the honest alternative

**Top risks:** (a) Kysely type-loss hiding a query bug that only surfaces in production — mitigated by fixing the audit bugs first, Zod guards, and the smoke/integration suite; (b) server build/alias breakage — mitigated by doing server last and running the full harness; (c) the 6 parameter-property files silently dropping assignments — mitigated by hand-diff; (d) scope creep turning the strip into a refactor — mitigated by the "type-removals-only diff" rule.

**Alternative worth putting on record:** since the shipped artifact is already JavaScript, the migration buys "no TS in source" at the cost of the codebase's main safety net, in a codebase the audit already flagged as buggy. A lower-risk path that meets most goals is to **keep TypeScript, fix the audit bugs, and reduce the 449 `as any`** — same JS output, more safety. If the driver is team preference or hiring, the full migration in this document is the way to do it safely; if the driver is "ship JS," it is already done. Recommend confirming the driver before Phase 1.

---

## Bottom line

Do it with the compiler, leaf-first, server last, on a branch, with the existing migrate/seed/smoke/integration/e2e suite as the gate — and fix H-1/H-2/M-1 first because the migration removes the net that catches that class of bug. Behaviour, DB schema, auth, APIs, offline PWA and the Android build are all preserved because the strip is type-erasure only and the runtime was already JavaScript. Keep Zod as the runtime guard and JSDoc + `checkJs` for author-time safety. The only genuinely non-mechanical work is 9 files (6 parameter-property, 2 enum, 1 namespace), the server build swap, and path-alias resolution — everything else is a faithful, reviewable strip.

*Grounded in `zedral_test-share-the-code` (measured counts and real scripts cited). Note: this codebase uses PostgreSQL + Kysely + SuperTokens, not Supabase; the plan targets the real stack.*
