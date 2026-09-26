/**
 * Pure outbox flush rules (audit F12). Kept separate so Node tests can lock behaviour
 * without IndexedDB.
 */

/** HTTP statuses that mean the server already has the write (or accepted it). */
export function isOutboxSuccessStatus(status) {
  const n = Number(status);
  return (n >= 200 && n < 300) || n === 409;
}

/**
 * Whether flush should continue after a single item fails.
 * Must stay true — one poison item must never block other aggregates/items.
 */
export const CONTINUE_AFTER_ITEM_FAILURE = true;

export const MAX_OUTBOX_ATTEMPTS = 8;

/** Exponential backoff wait (ms), capped. */
export function outboxBackoffMs(attempts, baseMs = 2000, capMs = 60_000) {
  const a = Math.max(0, Number(attempts) || 0);
  if (a <= 0) return 0;
  return Math.min(baseMs * 2 ** (a - 1), capMs);
}

export function backoffElapsed(item, now = Date.now(), baseMs = 2000, capMs = 60_000) {
  const attempts = Number(item?.attempts ?? 0);
  if (attempts <= 0 || !item?.lastAttemptAt) return true;
  const wait = outboxBackoffMs(attempts, baseMs, capMs);
  return now - new Date(item.lastAttemptAt).getTime() >= wait;
}
