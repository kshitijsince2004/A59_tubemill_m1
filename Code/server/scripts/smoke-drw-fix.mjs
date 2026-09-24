/**
 * Smoke: migration 034 columns + auth/me + productionGuard + drawbench/hold + handover preview.
 * Uses x-app-role header (AUTH_ALLOW_HEADER_ROLE / AUTH_MODE=dev).
 */
import 'dotenv/config';
import pg from 'pg';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const require = createRequire(import.meta.url);
const base = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';

async function checkColumns() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'txn' AND table_name = 'prod_db_lot'
         AND column_name IN ('production_started_at','production_ended_at','accepted_mt','shift_log_id')
       ORDER BY 1`
    );
    const cols = r.rows.map((x) => x.column_name);
    console.log('[db] prod_db_lot columns:', cols.join(', ') || 'NONE');
    for (const need of ['production_started_at', 'production_ended_at', 'accepted_mt']) {
      if (!cols.includes(need)) throw new Error(`Missing column ${need}`);
    }
  } finally {
    await pool.end();
  }
}

function checkGuardModule() {
  require('../dist/services/handover/productionGuard.js');
  console.log('[module] productionGuard loads OK');
}

async function http(method, pathName, headers = {}, body) {
  const res = await fetch(`${base}${pathName}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function checkRoutes() {
  const authHeaders = {
    'x-app-role': 'ADMIN',
    'content-type': 'application/json',
  };

  const me = await http('GET', '/api/auth/me', authHeaders);
  console.log('[http] GET /api/auth/me →', me.status);
  if (me.status !== 200) {
    throw new Error(`auth/me expected 200 got ${me.status}: ${JSON.stringify(me.body)}`);
  }

  const hold = await http(
    'POST',
    '/api/drawbench/lots/00000000-0000-0000-0000-000000000001/hold',
    authHeaders
  );
  console.log('[http] POST hold (missing lot) →', hold.status, JSON.stringify(hold.body).slice(0, 160));
  if (hold.status === 500) throw new Error(`hold 500: ${JSON.stringify(hold.body)}`);
  if (hold.status === 404) {
    const msg = JSON.stringify(hold.body);
    if (!/Not found/i.test(msg)) throw new Error(`unexpected hold 404: ${msg}`);
  }

  const preview = await http('GET', '/api/machines/handover/DB-120T/preview', authHeaders);
  console.log('[http] GET handover DB-120T/preview →', preview.status);
  if (preview.status >= 500) throw new Error(`preview 500: ${JSON.stringify(preview.body)}`);
  if (preview.status === 400) {
    const msg = JSON.stringify(preview.body);
    if (/qty_mt|column|Cannot find module/i.test(msg)) throw new Error(`preview bug: ${msg}`);
    console.log('[http] preview 400 (acceptable non-column):', msg.slice(0, 200));
  }

  const board = await http('GET', '/api/drawbench/board', authHeaders);
  console.log('[http] GET /api/drawbench/board →', board.status);
  if (board.status !== 200) throw new Error(`board expected 200 got ${board.status}`);

  const lots = await http('GET', '/api/drawbench/lots?status=DRAFT', authHeaders);
  const list = Array.isArray(lots.body?.data) ? lots.body.data : [];
  console.log('[http] DRAFT lots:', list.length);
  if (list.length) {
    const id = list[0].id;
    const start = await http('POST', `/api/drawbench/lots/${id}/start`, authHeaders);
    console.log('[http] POST start', id, '→', start.status, JSON.stringify(start.body).slice(0, 200));
    if (start.status === 500) throw new Error(`start 500: ${JSON.stringify(start.body)}`);
    if (
      start.status === 400 &&
      /Cannot find module|MachineSessionService/i.test(JSON.stringify(start.body))
    ) {
      throw new Error(`start still broken by productionGuard: ${JSON.stringify(start.body)}`);
    }

    if (start.status === 200 || start.status === 400) {
      // Try hold if still DRAFT-capable
      const hold2 = await http('POST', `/api/drawbench/lots/${id}/hold`, authHeaders);
      console.log('[http] POST hold real lot →', hold2.status, JSON.stringify(hold2.body).slice(0, 160));
      if (hold2.status === 500) throw new Error(`hold real 500: ${JSON.stringify(hold2.body)}`);
      if (hold2.status === 200) {
        const resume = await http('POST', `/api/drawbench/lots/${id}/resume`, authHeaders);
        console.log('[http] POST resume →', resume.status);
        if (resume.status === 500) throw new Error(`resume 500: ${JSON.stringify(resume.body)}`);
      }
    }
  }
}

await checkGuardModule();
await checkColumns();
await checkRoutes();
console.log('[smoke] OK');
