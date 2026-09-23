import { query } from '../db/pool';
import { config } from '../config';
import { listReports, renderReport } from '../export/ReportExportService';
import { recordAuditEvent } from './AuditTrailService';
import layoutFur from '../export/layouts/line_log/FUR.json';
import layoutStp from '../export/layouts/line_log/STP.json';
import layoutDb from '../export/layouts/line_log/DB.json';

const LINE_LOGS = {
  FUR: layoutFur,
  STP: layoutStp,
  DRW: layoutDb,
};

async function safeQuery(sql, params) {
  try {
    return await query(sql, params);
  } catch {
    return [];
  }
}

export function listPlantReports() {
  const ft = listReports().map((r) => ({ ...r, kind: 'ft' }));
  const lineLogs = Object.values(LINE_LOGS).map((l) => ({
    code: l.reportCode,
    processId: l.process,
    title: l.title,
    kind: 'line_log',
  }));
  return [...ft, ...lineLogs];
}

export async function listExportHistory(limit = 50) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  try {
    const rows = await query(
      `SELECT id, created_at, created_by, process_code, report_code, label, status, file_name, meta
       FROM txn.export_job WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [config.tenantId, lim]
    );
    return rows.map((r) => ({
      id: String(r.id),
      createdAt: r.created_at,
      createdBy: r.created_by,
      processCode: r.process_code,
      reportCode: r.report_code,
      label: r.label,
      status: r.status,
      fileName: r.file_name,
      meta: r.meta,
    }));
  } catch {
    return [];
  }
}

async function recordExportJob({ user, processCode, reportCode, fileName, meta }) {
  try {
    await query(
      `INSERT INTO txn.export_job (
         tenant_id, created_by, process_code, report_code, label, status, file_name, meta
       ) VALUES ($1,$2,$3,$4,$5,'DONE',$6,$7::jsonb)`,
      [
        config.tenantId,
        user?.username ?? null,
        processCode ?? null,
        reportCode,
        reportCode,
        fileName ?? null,
        JSON.stringify(meta ?? {}),
      ]
    );
  } catch {
    /* optional until migration applied */
  }
  await recordAuditEvent({
    actorUserId: user?.userId ?? null,
    actorUsername: user?.username ?? null,
    action: 'EXPORT',
    entityType: 'EXPORT',
    entityId: reportCode,
    detail: meta ?? {},
  });
}

/**
 * Plant-wide FT export — delegates to ReportExportService when id provided.
 */
export async function runPlantFtExport(user, { report, id }) {
  const result = await renderReport(report, { id });
  const def = listReports().find((r) => r.code === report);
  await recordExportJob({
    user,
    processCode: def?.processId,
    reportCode: report,
    fileName: result?.filename,
    meta: { id },
  });
  return {
    buffer: result.buffer,
    filename: result.filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    processId: def?.processId,
  };
}

/**
 * Line-log CSV/JSON summary for FUR/STP/DRW (plant-wide window).
 */
export async function runLineLogExport(user, process, windowDays = 7) {
  const p = String(process).toUpperCase();
  const layout = LINE_LOGS[p];
  if (!layout) throw Object.assign(new Error(`No line log for ${p}`), { status: 400 });

  const since = new Date(Date.now() - Math.max(1, Number(windowDays) || 7) * 86400000);
  let rows = [];
  if (p === 'FUR') {
    rows = await safeQuery(
      `SELECT prod_date AS "prodDate", charge_no AS "chargeNo", work_order_no AS "workOrderNo",
              furnace_code AS "furnaceCode", grade_code AS "gradeCode",
              total_nos AS "totalNos", total_mt AS "totalMt", status
       FROM txn.prod_ann_run
       WHERE tenant_id = $1 AND COALESCE(updated_at, created_at) >= $2
       ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 500`,
      [config.tenantId, since]
    );
  } else if (p === 'STP') {
    rows = await safeQuery(
      `SELECT lot_no AS "lotNo", work_order_no AS "workOrderNo", machine_code AS "machineCode",
              grade_code AS "gradeCode", qty_no AS "qtyNo", qty_mt AS "qtyMt", status
       FROM txn.prod_stp_lot
       WHERE tenant_id = $1 AND COALESCE(updated_at, created_at) >= $2
       ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 500`,
      [config.tenantId, since]
    );
  } else if (p === 'DRW') {
    rows = await safeQuery(
      `SELECT COALESCE(lot_no, tag_no) AS "lotNo", work_order_no AS "workOrderNo",
              bench_code AS "benchCode", grade_code AS "gradeCode", status, created_at AS "createdAt"
       FROM txn.prod_db_lot
       WHERE tenant_id = $1 AND created_at >= $2
       ORDER BY created_at DESC LIMIT 500`,
      [config.tenantId, since]
    );
  }

  const cols = layout.sheets[0].columns;
  const header = cols.map((c) => c.header).join(',');
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c.key];
          if (v == null) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
  const csv = `${header}\n${body}\n`;
  const fileName = `A59_${layout.reportCode}_${new Date().toISOString().slice(0, 10)}.csv`;

  await recordExportJob({
    user,
    processCode: p,
    reportCode: layout.reportCode,
    fileName,
    meta: { windowDays, rowCount: rows.length },
  });

  return {
    reportCode: layout.reportCode,
    fileName,
    contentType: 'text/csv; charset=utf-8',
    buffer: Buffer.from(csv, 'utf8'),
    rows: rows.length,
  };
}
