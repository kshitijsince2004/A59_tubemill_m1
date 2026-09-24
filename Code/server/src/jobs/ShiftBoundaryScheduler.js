/**
 * Periodic stale-session sweep (long-running server only).
 */

import { getAutoBoundaryMode, processStaleSessions } from '../services/ShiftBoundaryService';

let timer = null;
let running = false;

export function startShiftBoundaryScheduler() {
  if (timer) return;
  const ms = Number(process.env.SHIFT_STALE_SWEEP_MS ?? 60_000);
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const mode = getAutoBoundaryMode();
      const result = await processStaleSessions(mode);
      if (result.closed || result.autoHandovers || result.shadowed) {
        console.log(JSON.stringify({ level: 'info', msg: 'shift_boundary_tick', ...result, mode }));
      }
    } catch (e) {
      console.error('[ShiftBoundaryScheduler]', e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  timer = setInterval(() => void tick(), Math.max(10_000, ms));
  // First tick after short delay so boot is not blocked
  setTimeout(() => void tick(), 5_000);
  console.log(`[ShiftBoundaryScheduler] started (every ${ms}ms, mode=${getAutoBoundaryMode()})`);
}

export function stopShiftBoundaryScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
