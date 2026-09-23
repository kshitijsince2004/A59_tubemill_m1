import fs from 'fs';
import path from 'path';
import { query } from '../db/pool';
import { config } from '../config';


import bundledMasters from '../../seeds/erp_masters.json';
import bundledOrders from '../../seeds/erp_orders.json';
import bundledCodes from '../../seeds/erp_codes.json';

function loadJsonFile(filename, fallback) {
  const candidates = [
  path.resolve(process.cwd(), 'seeds', filename),
  path.resolve(process.cwd(), 'server/seeds', filename),
  path.resolve(process.cwd(), '../server/seeds', filename)];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return fallback;
}

async function landRaw(entity, bcId, payload) {
  await query(
    `INSERT INTO erp.raw_landing (tenant_id, entity, bc_id, payload)
     VALUES ($1, $2, $3, $4)`,
    [config.tenantId, entity, bcId, JSON.stringify(payload)]
  );
}

/**
 * File BC stand-in: reads ERP JSON seeds, lands payloads into erp.raw_landing,
 * returns normalized rows for upsert. Replace with ODataBcConnector later.
 */
export class FileBcConnector {
  async pull(entity) {
    const fetchedAt = new Date().toISOString();
    let rows = [];

    if (entity === 'machines') {
      const masters = loadJsonFile('erp_masters.json', bundledMasters);
      rows = masters.machines ?? [];
      for (const r of rows) {
        await landRaw(entity, String(r.bcId ?? r.machineCode), r);
      }
    } else if (entity === 'customers') {
      const masters = loadJsonFile('erp_masters.json', bundledMasters);
      rows = masters.customers ?? [];
      for (const r of rows) {
        await landRaw(entity, String(r.bcId ?? r.code), r);
      }
    } else if (entity === 'grades') {
      const masters = loadJsonFile('erp_masters.json', bundledMasters);
      rows = masters.grades ?? [];
      for (const r of rows) {
        await landRaw(entity, String(r.bcId ?? r.code), r);
      }
    } else if (entity === 'codes') {
      const codes = loadJsonFile('erp_codes.json', bundledCodes);
      rows = [codes];
      await landRaw(entity, 'codes', codes);
    } else if (entity === 'orders') {
      rows = loadJsonFile('erp_orders.json', bundledOrders);
      for (const r of rows) {
        await landRaw(entity, String(r.bcId ?? r.workOrderNo), r);
      }
    }

    return { entity, rows, fetchedAt };
  }

  async postJournal(kind, payload) {
    const response = {
      source: 'FileBcConnector',
      kind,
      entryId: payload.entryId,
      acceptedAt: new Date().toISOString(),
      payload
    };
    await query(
      `INSERT INTO ops.bc_writeback_log (tenant_id, run_id, payload, status)
       VALUES ($1, $2, $3, 'LOGGED')`,
      [
      config.tenantId,
      payload.processCode === 'TM' ? payload.sourceId : null,
      JSON.stringify(response)]

    );
    return { ok: true, response };
  }
}