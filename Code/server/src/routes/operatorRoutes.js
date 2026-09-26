import { Router } from 'express';
import { config } from '../config';
import { query, queryOne } from '../db/pool';
import { getQueue, mapQueueCard } from '../services/QueueService';
import {
  authMiddleware,
  requireAuth,
  requireOperator,
} from '../middleware/authMiddleware';

const router = Router();

router.use('/operator', authMiddleware, requireAuth, requireOperator);

/**
 * Compact operator context for tablet startup — flat DTO, not the full user graph.
 */
router.get('/operator/context', async (req, res) => {
  try {
    const user = req.user;
    const processAccess = (user.processAccess ?? [])
      .filter((g) => g.level === 'READ' || g.level === 'WRITE' || g.level === 'APPROVE')
      .map((g) => g.processCode);

    const machines = (user.machineAccess ?? []).map((m) => m.machineCode);
    const primaryLine = machines[0] ?? null;

    let shift = null;
    if (user.userId) {
      const row = await queryOne(
        `SELECT id, machine_code, shift_code, prod_date, status, started_at
         FROM txn.machine_shift_session
         WHERE tenant_id = $1 AND operator_user_id = $2 AND status = 'ACTIVE'
         ORDER BY started_at DESC
         LIMIT 1`,
        [config.tenantId, user.userId]
      );
      if (row) {
        shift = {
          sessionId: row.id,
          machineCode: row.machine_code,
          shiftCode: row.shift_code,
          prodDate: row.prod_date,
          status: row.status,
        };
      }
    }

    let device = null;
    const deviceId = req.deviceId;
    if (deviceId) {
      const d = await queryOne(
        `SELECT device_id, plant_code, line_code, machine_code, label, status
         FROM master.device
         WHERE tenant_id = $1 AND device_id = $2
         LIMIT 1`,
        [config.tenantId, deviceId]
      );
      if (d) {
        device = {
          deviceId: d.device_id,
          plantCode: d.plant_code,
          lineCode: d.line_code,
          machineCode: d.machine_code,
          label: d.label,
          status: d.status,
        };
        await query(
          `UPDATE master.device SET last_seen_at = now()
           WHERE tenant_id = $1 AND device_id = $2`,
          [config.tenantId, deviceId]
        );
      }
    }

    res.json({
      data: {
        operatorId: user.userId,
        employeeNo: user.empCode ?? user.username,
        name: user.fullName ?? user.username,
        role: 'OPERATOR',
        plantCode: device?.plantCode ?? 'A59',
        lineCode: device?.lineCode ?? primaryLine,
        shiftId: shift?.shiftCode ?? null,
        shift,
        processAccess,
        machines,
        device,
        serverTime: new Date().toISOString(),
      },
      errors: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Context failed' }],
    });
  }
});

/**
 * Snapshot masters for offline cache. Full snapshot is acceptable at master-data scale.
 */
router.get('/operator/masters', async (req, res) => {
  try {
    const machines = await query(
      `SELECT machine_code, process_code, label
       FROM master.machine
       WHERE tenant_id = $1
       ORDER BY machine_code`,
      [config.tenantId]
    );
    const stoppages = await query(
      `SELECT code, label, category, is_planned
       FROM master.stoppage_code
       WHERE tenant_id = $1
       ORDER BY code`,
      [config.tenantId]
    );
    const serverTime = new Date().toISOString();
    res.json({
      data: {
        serverTime,
        tables: {
          machine: machines.map((r) => ({
            rowId: r.machine_code,
            data: r,
          })),
          stoppage_code: stoppages.map((r) => ({
            rowId: r.code,
            data: r,
          })),
        },
      },
      errors: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Masters failed' }],
    });
  }
});

/**
 * Planned work for the operator's assigned lines (TM queue via QueueService).
 */
router.get('/operator/work', async (req, res) => {
  try {
    const user = req.user;
    const machines = (user.machineAccess ?? []).map((m) => m.machineCode);
    const mill = String(req.query.line ?? req.query.mill ?? machines[0] ?? 'A-59');

    if (machines.length && !machines.includes(mill) && !user.roles?.includes('ADMIN')) {
      res.status(403).json({
        data: null,
        errors: [{ message: 'Not assigned to this line' }],
      });
      return;
    }

    const cards = await getQueue(mill);
    const serverTime = new Date().toISOString();
    res.json({
      data: {
        serverTime,
        lineCode: mill,
        items: (cards ?? []).map((r) => {
          const mapped = mapQueueCard(r);
          return {
            workKey: String(mapped?.id ?? r.id),
            data: mapped ?? r,
          };
        }),
      },
      errors: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Work fetch failed' }],
    });
  }
});

/** Min app version floor for forced update (MDM / APK). */
router.get('/operator/min-version', (_req, res) => {
  res.json({
    data: {
      minVersion: process.env.OPERATOR_MIN_APP_VERSION ?? '0.0.0',
      serverTime: new Date().toISOString(),
    },
    errors: null,
  });
});

export default router;
