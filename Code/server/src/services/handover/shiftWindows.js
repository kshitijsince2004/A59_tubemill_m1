/**
 * Lightweight IST shift window helpers (A/B/C) for handover boundary checks.
 */

const DEFAULT_WINDOWS = [
  { shiftCode: 'A', startHour: 6, endHour: 14 },
  { shiftCode: 'B', startHour: 14, endHour: 22 },
  { shiftCode: 'C', startHour: 22, endHour: 6 },
];

/** @returns {Date} */
export function nowIst() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

/** @param {Date} [at] */
export function plantDateString(at = nowIst()) {
  return at.toISOString().slice(0, 10);
}

/**
 * @param {Date} [atUtc]
 * @returns {{ shiftCode: string, prodDate: string, windowStart: Date, windowEnd: Date, nextShiftCode: string, nextProdDate: string }}
 */
export function resolveShiftFromClock(atUtc = new Date()) {
  const istMs = atUtc.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const hour = ist.getUTCHours() + ist.getUTCMinutes() / 60;
  const prodDate = ist.toISOString().slice(0, 10);

  let idx = 0;
  for (let i = 0; i < DEFAULT_WINDOWS.length; i++) {
    const w = DEFAULT_WINDOWS[i];
    if (w.startHour < w.endHour) {
      if (hour >= w.startHour && hour < w.endHour) {
        idx = i;
        break;
      }
    } else if (hour >= w.startHour || hour < w.endHour) {
      idx = i;
      break;
    }
  }

  const cur = DEFAULT_WINDOWS[idx];
  const next = DEFAULT_WINDOWS[(idx + 1) % DEFAULT_WINDOWS.length];

  const base = new Date(`${prodDate}T00:00:00.000Z`);
  const windowStart = new Date(base.getTime() + cur.startHour * 3600000 - 5.5 * 3600000);
  let windowEnd = new Date(base.getTime() + cur.endHour * 3600000 - 5.5 * 3600000);
  if (cur.endHour <= cur.startHour) {
    windowEnd = new Date(windowEnd.getTime() + 24 * 3600000);
  }

  let nextProdDate = prodDate;
  if (cur.shiftCode === 'C' || (cur.endHour <= cur.startHour && hour < cur.endHour)) {
    // after midnight on C → next day for A
  }
  if (next.shiftCode === 'A' && cur.shiftCode === 'C') {
    const d = new Date(istMs + 24 * 3600000);
    nextProdDate = d.toISOString().slice(0, 10);
  }

  return {
    shiftCode: cur.shiftCode,
    prodDate,
    windowStart,
    windowEnd,
    nextShiftCode: next.shiftCode,
    nextProdDate,
  };
}

/**
 * Outgoing handover may submit only at/after scheduled shift end (grace = 0 for gate).
 * @param {{ windowEnd: Date }} shift
 * @param {Date} [now]
 */
export function canCompleteOutgoingHandover(shift, now = new Date()) {
  return now.getTime() >= shift.windowEnd.getTime();
}

/**
 * Overtime grace hours after window end before session is stale.
 */
export function getOvertimeGraceMs() {
  const hours = Number(process.env.SHIFT_OVERTIME_GRACE_HOURS ?? 2);
  return Math.max(0, hours) * 3600000;
}

/**
 * @param {Date} windowEnd
 * @param {Date} [now]
 */
export function isPastGrace(windowEnd, now = new Date()) {
  return now.getTime() > windowEnd.getTime() + getOvertimeGraceMs();
}
