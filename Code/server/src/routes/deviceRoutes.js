import { Router } from 'express';
import { config } from '../config';
import { query, queryOne } from '../db/pool';
import {
  authMiddleware,
  requireAuth,
  requireMachineHead,
} from '../middleware/authMiddleware';

const router = Router();

router.use('/device', authMiddleware, requireAuth);

/**
 * Bind a tablet device id to plant + line. Setup / MH / Admin only.
 * Body: { deviceId, plantCode?, lineCode, machineCode?, label? }
 * Also accepts barcode-style `BIND-<lineCode>` in `code`.
 */
router.post('/device/register', requireMachineHead, async (req, res) => {
  try {
    let deviceId = String(req.body?.deviceId ?? req.deviceId ?? '').trim();
    let lineCode = String(req.body?.lineCode ?? '').trim();
    const plantCode = String(req.body?.plantCode ?? 'A59').trim() || 'A59';
    const machineCode = req.body?.machineCode
      ? String(req.body.machineCode).trim()
      : null;
    const label = req.body?.label ? String(req.body.label).trim() : null;

    const code = String(req.body?.code ?? '').trim();
    if (code.toUpperCase().startsWith('BIND-')) {
      lineCode = lineCode || code.slice(5).trim();
    }

    if (!deviceId) {
      res.status(400).json({ data: null, errors: [{ message: 'deviceId required' }] });
      return;
    }
    if (!lineCode) {
      res.status(400).json({ data: null, errors: [{ message: 'lineCode required' }] });
      return;
    }

    const rows = await query(
      `INSERT INTO master.device (
         tenant_id, device_id, plant_code, line_code, machine_code, label, registered_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id, device_id) DO UPDATE SET
         plant_code = EXCLUDED.plant_code,
         line_code = EXCLUDED.line_code,
         machine_code = COALESCE(EXCLUDED.machine_code, master.device.machine_code),
         label = COALESCE(EXCLUDED.label, master.device.label),
         status = 'ACTIVE',
         registered_by = EXCLUDED.registered_by,
         registered_at = now(),
         last_seen_at = now()
       RETURNING *`,
      [
        config.tenantId,
        deviceId,
        plantCode,
        lineCode,
        machineCode,
        label,
        req.user?.userId ?? null,
      ]
    );

    const row = rows[0];
    res.json({
      data: {
        deviceId: row.device_id,
        plantCode: row.plant_code,
        lineCode: row.line_code,
        machineCode: row.machine_code,
        label: row.label,
        status: row.status,
        registeredAt: row.registered_at,
      },
      errors: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Register failed' }],
    });
  }
});

/** Operator / any authed: read binding for this device. */
router.get('/device/me', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId ?? req.deviceId ?? '').trim();
    if (!deviceId) {
      res.status(400).json({ data: null, errors: [{ message: 'deviceId required' }] });
      return;
    }
    const row = await queryOne(
      `SELECT device_id, plant_code, line_code, machine_code, label, status, last_seen_at
       FROM master.device
       WHERE tenant_id = $1 AND device_id = $2
       LIMIT 1`,
      [config.tenantId, deviceId]
    );
    if (!row) {
      res.status(404).json({ data: null, errors: [{ message: 'Device not registered' }] });
      return;
    }
    await query(
      `UPDATE master.device SET last_seen_at = now()
       WHERE tenant_id = $1 AND device_id = $2`,
      [config.tenantId, deviceId]
    );
    res.json({
      data: {
        deviceId: row.device_id,
        plantCode: row.plant_code,
        lineCode: row.line_code,
        machineCode: row.machine_code,
        label: row.label,
        status: row.status,
        lastSeenAt: row.last_seen_at,
      },
      errors: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Lookup failed' }],
    });
  }
});

export default router;
