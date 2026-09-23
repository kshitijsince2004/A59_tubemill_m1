import { query } from '../db/pool';
import { config } from '../config';
import { accessibleMachineCodes, assertMachineApproval } from '../auth/machineAccessPolicy';
import { approveRun, getRun, holdRun } from './RunService';
import { getAnnRun, setAnnStatus, assertFurnaceApprovable } from './FurnaceService';
import { getStpLot, setStpStatus, holdStpLot, assertStpBathSigned } from './StpService';
import { getDrwLot, setDrwStatus, assertDrwInspectionsDispositioned } from './DrawBenchService';
import { getSwageLot, setSwageStatus } from './SwageService';
import { recordAuditEvent } from './AuditTrailService';

function scopeParams(codes) {
  const tenant = config.tenantId;
  if (codes == null) return { millCol: (col) => 'TRUE', params: [tenant], tIdx: 1 };
  return {
    millCol: (col) => `${col} = ANY($1::text[])`,
    params: [codes, tenant],
    tIdx: 2,
  };
}

async function count(sql, params) {
  const rows = await query(sql, params);
  return Number(rows[0]?.n ?? 0);
}

/**
 * Dashboard counts scoped to machineAccess (null codes = all for ADMIN/PH).
 */
export async function getMachineHeadDashboard(user) {
  const codes = accessibleMachineCodes(user);
  const byProcess = {};
  const { millCol, params, tIdx } = scopeParams(codes);

  byProcess.TM = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND status IN ('DRAFT','OPEN','SETUP')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND run_state = 'RUNNING'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND hold_status = 'HELD'`,
      params
    ),
  };

  byProcess.FUR = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'IN_PROGRESS'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'HOLD'`,
      params
    ),
  };

  byProcess.STP = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'IN_PROGRESS'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'HOLD'`,
      params
    ),
  };

  byProcess.DRW = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'IN_PROGRESS'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'HOLD'`,
      params
    ),
  };

  try {
    byProcess.SWG = {
      open: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
        params
      ),
      running: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'IN_PROGRESS'`,
        params
      ),
      submitted: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'SUBMITTED'`,
        params
      ),
      hold: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'HOLD'`,
        params
      ),
    };
  } catch {
    byProcess.SWG = { open: 0, running: 0, submitted: 0, hold: 0 };
  }

  return { byProcess, machineScope: codes };
}

export async function listPendingReview(user) {
  const codes = accessibleMachineCodes(user);
  const { millCol, params, tIdx } = scopeParams(codes);
  const items = [];

  {
    const rows = await query(
      `SELECT id, mill_code AS machine_code, status, work_order_no, created_at
       FROM txn.prod_tm_run
       WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND status = 'SUBMITTED'
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'TM',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.created_at,
      });
    }
  }

  {
    const rows = await query(
      `SELECT id, furnace_code AS machine_code, status, work_order_no, charge_no, updated_at
       FROM txn.prod_ann_run
       WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'SUBMITTED'
       ORDER BY updated_at DESC NULLS LAST LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'FUR',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.charge_no || r.work_order_no,
        submittedAt: r.updated_at,
      });
    }
  }

  {
    const rows = await query(
      `SELECT id, machine_code, status, work_order_no, updated_at
       FROM txn.prod_stp_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'SUBMITTED'
       ORDER BY updated_at DESC NULLS LAST LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'STP',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.updated_at,
      });
    }
  }

  {
    const rows = await query(
      `SELECT id, bench_code AS machine_code, status, work_order_no, created_at
       FROM txn.prod_db_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'SUBMITTED'
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'DRW',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.created_at,
      });
    }
  }

  try {
    const rows = await query(
      `SELECT id, swg_machine AS machine_code, status, work_order_no, created_at
       FROM txn.prod_db_swage
       WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'SUBMITTED'
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'SWG',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.created_at,
      });
    }
  } catch {
    /* optional */
  }

  items.sort((a, b) => String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')));
  return { items };
}

async function resolveItem(process, id) {
  const p = String(process).toUpperCase();
  if (p === 'TM') {
    const run = await getRun(id);
    if (!run) return null;
    return { process: 'TM', id: run.id, machineCode: run.millCode, status: run.status, entity: run };
  }
  if (p === 'FUR') {
    const lot = await getAnnRun(id);
    if (!lot) return null;
    return { process: 'FUR', id: lot.id, machineCode: lot.furnaceCode, status: lot.status, entity: lot };
  }
  if (p === 'STP') {
    const lot = await getStpLot(id);
    if (!lot) return null;
    return { process: 'STP', id: lot.id, machineCode: lot.machineCode, status: lot.status, entity: lot };
  }
  if (p === 'DRW') {
    const lot = await getDrwLot(id);
    if (!lot) return null;
    return { process: 'DRW', id: lot.id, machineCode: lot.benchCode, status: lot.status, entity: lot };
  }
  if (p === 'SWG') {
    const lot = await getSwageLot(id);
    if (!lot) return null;
    return { process: 'SWG', id: lot.id, machineCode: lot.swgMachine, status: lot.status, entity: lot };
  }
  return null;
}

export async function reviewAction(user, process, id, action, remark) {
  const item = await resolveItem(process, id);
  if (!item) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  assertMachineApproval(user, item.machineCode);

  let result;
  if (action === 'approve') {
    if (item.process === 'TM') result = await approveRun(id);
    else if (item.process === 'FUR') {
      await assertFurnaceApprovable(item.entity);
      result = await setAnnStatus(id, 'APPROVED');
    } else if (item.process === 'STP') {
      await assertStpBathSigned(id, item.entity);
      result = await setStpStatus(id, 'APPROVED');
    } else if (item.process === 'DRW') {
      await assertDrwInspectionsDispositioned(id);
      result = await setDrwStatus(id, 'APPROVED');
    } else if (item.process === 'SWG') result = await setSwageStatus(id, 'APPROVED');
  } else if (action === 'hold') {
    if (item.process === 'TM') result = await holdRun(id, remark || 'Held by Machine Head');
    else if (item.process === 'FUR') result = await setAnnStatus(id, 'HOLD');
    else if (item.process === 'STP') result = await holdStpLot(id);
    else if (item.process === 'DRW') result = await setDrwStatus(id, 'HOLD');
    else if (item.process === 'SWG') result = await setSwageStatus(id, 'HOLD');
  } else if (action === 'reopen') {
    if (item.process === 'TM') {
      await query(`UPDATE txn.prod_tm_run SET status = 'DRAFT', hold_status = 'NONE' WHERE id = $1`, [id]);
      result = await getRun(id);
    } else if (item.process === 'FUR') result = await setAnnStatus(id, 'DRAFT');
    else if (item.process === 'STP') result = await setStpStatus(id, 'DRAFT');
    else if (item.process === 'DRW') result = await setDrwStatus(id, 'DRAFT');
    else if (item.process === 'SWG') result = await setSwageStatus(id, 'DRAFT');
  }

  if (result !== undefined) {
    await recordAuditEvent({
      actorUserId: user?.userId ?? null,
      actorUsername: user?.username ?? null,
      action: `REVIEW_${String(action).toUpperCase()}`,
      entityType: item.process,
      entityId: String(id),
      detail: { machineCode: item.machineCode, remark: remark ?? null },
    });
    return result;
  }

  const err = new Error(`Unknown action ${action}`);
  err.status = 400;
  throw err;
}

export async function getReviewItem(user, process, id) {
  const item = await resolveItem(process, id);
  if (!item) return null;
  assertMachineApproval(user, item.machineCode);
  return {
    process: item.process,
    id: item.id,
    machineCode: item.machineCode,
    status: item.status,
    entity: item.entity,
  };
}
