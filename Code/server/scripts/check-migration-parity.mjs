#!/usr/bin/env node
/**
 * Migration parity check (audit F13).
 *
 * Compares basenames (numeric prefix stripped) between:
 *   Code/server/migrations
 *   Code/netlify/database/migrations
 *
 * Known intentional differences (allowlisted):
 *
 * Server-only (local Docker bootstrap / RLS / ops; Netlify uses combined seeds):
 *   - plc_and_idempotency
 *   - consumables
 *   - security
 *   - ops_schema
 *   - phase_complete
 *
 * Netlify-only (seed/reference packs applied by Netlify Database, not server migrate):
 *   - reference_data
 *   - fifty_queue_orders
 *   - phase1_reference
 *
 * Exit 0 when every non-allowlisted server migration has a Netlify counterpart
 * (match by suffix name). Exit 1 and print missing names otherwise.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '../migrations');
const netlifyDir = path.resolve(__dirname, '../../netlify/database/migrations');

/** @type {Set<string>} */
const SERVER_ONLY_ALLOWLIST = new Set([
  'plc_and_idempotency',
  'consumables',
  'security',
  'ops_schema',
  'phase_complete',
]);

/** @type {Set<string>} */
const NETLIFY_ONLY_ALLOWLIST = new Set([
  'reference_data',
  'fifty_queue_orders',
  'phase1_reference',
  'demo_seed_logins_orders_graphs',
]);

function listSuffixNames(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Missing migrations directory: ${dir}`);
    process.exit(1);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/^\d+_/, '').replace(/\.sql$/i, ''));
}

const serverNames = listSuffixNames(serverDir);
const netlifyNames = listSuffixNames(netlifyDir);
const netlifySet = new Set(netlifyNames);

const missing = serverNames.filter(
  (name) => !SERVER_ONLY_ALLOWLIST.has(name) && !netlifySet.has(name)
);

if (missing.length) {
  console.error('Migration parity failed — server migrations missing on Netlify:');
  for (const name of missing) console.error(`  - ${name}`);
  process.exit(1);
}

console.log(
  `Migration parity OK (${serverNames.length} server, ${netlifyNames.length} netlify; ` +
    `${SERVER_ONLY_ALLOWLIST.size} server-only / ${NETLIFY_ONLY_ALLOWLIST.size} netlify-only allowlisted).`
);
process.exit(0);
