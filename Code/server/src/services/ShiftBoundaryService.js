/**
 * Auto-boundary safety net: close stale sessions and optionally write AUTO_COMPLETED handovers.
 */

import { query, withTransaction } from '../db/pool';
import { config } from '../config';
import { createAutoBoundaryHandover } from './MachineHandoverService';
import {
  resolveShiftFromClock,
  isPastGrace,
} from './handover/shiftWindows';

/** @returns {'off'|'shadow'|'on'} */
export function getAutoBoundaryMode() {
  const raw = (process.env.AUTO_BOUNDARY_HANDOVER ?? 'off').trim().toLowerCase();
  if (raw === 'shadow' || raw === 'on') return raw;
  return 'off';
}

export function isMachineOnAutoBoundaryAllowlist(machineCode) {
  const list = (process.env.AUTO_BOUNDARY_HANDOVER_MACHINES ?? '').trim();
  if (!list) return true;
  const allowed = new Set(
    list
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
  return allowed.has(String(machineCode).toUpperCase());
}

/**
 * Close ACTIVE sessions past shift end + overtime grace.
 * When mode is shadow|on, write AUTO_COMPLETED handover (on) or log only (shadow).
 */
export async function processStaleSessions(mode = getAutoBoundaryMode()) {
  const clock = resolveShiftFromClock();
  if (!isPastGrace(clock.windowEnd)) {
    return { closed: 0, autoHandovers: 0, shadowed: 0 };
  }

  const sessions = await query(
    `SELECT * FROM txn.machine_shift_session
     WHERE tenant_id = $1 AND status = 'ACTIVE'`,
    [config.tenantId]
  );

  let closed = 0;
  let autoHandovers = 0;
  let shadowed = 0;

  for (const session of sessions) {
    if (!isMachineOnAutoBoundaryAllowlist(session.machine_code)) continue;

    // Session must be older than window end (started before current window)
    const started = session.started_at ? new Date(session.started_at).getTime() : 0;
    if (started > clock.windowEnd.getTime()) continue;

    const pending = await query(
      `SELECT 1 AS x FROM txn.machine_handover
       WHERE tenant_id = $1 AND machine_code = $2 AND status = 'PENDING'
       LIMIT 1`,
      [config.tenantId, session.machine_code]
    );
    if (pending.length) continue; // operator path in flight

    if (mode === 'off') {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE txn.machine_shift_session
           SET status = 'CLOSED', closed_at = now(), updated_at = now()
           WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
          [session.id, config.tenantId]
        );
        if (session.shift_log_id) {
          await client.query(
            `UPDATE txn.shift_log
             SET status = 'CLOSED', closed_at = now(), updated_at = now()
             WHERE id = $1 AND tenant_id = $2 AND status = 'OPEN'`,
            [session.shift_log_id, config.tenantId]
          );
        }
      });
      closed += 1;
      continue;
    }

    if (mode === 'shadow') {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'tier1_shadow_stale_session',
          machineCode: session.machine_code,
          sessionId: session.id,
        })
      );
      shadowed += 1;
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE txn.machine_shift_session
           SET status = 'CLOSED', closed_at = now(), updated_at = now()
           WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
          [session.id, config.tenantId]
        );
      });
      closed += 1;
      continue;
    }

    // mode === 'on'
    try {
      await withTransaction(async (client) => {
        await createAutoBoundaryHandover(session, client);
      });
      autoHandovers += 1;
      closed += 1;
    } catch (e) {
      if (e?.code === 'PENDING_RACE' || e?.code === '23505') {
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'tier1_pending_race',
            machineCode: session.machine_code,
          })
        );
        continue;
      }
      console.error('[ShiftBoundary] auto handover failed', e);
    }
  }

  return { closed, autoHandovers, shadowed };
}
