import { getAccessToken } from '../lib/authStore';
import {
  CONTINUE_AFTER_ITEM_FAILURE,
  MAX_OUTBOX_ATTEMPTS,
  backoffElapsed,
  isOutboxSuccessStatus,
} from './outboxLogic';

const DB_NAME = 'a59-outbox';
const STORE = 'requests';
const MAX_ATTEMPTS = MAX_OUTBOX_ATTEMPTS;
const FLUSH_INTERVAL_MS = 30_000;

let flushTimer = null;
let flushInFlight = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putItem(db, item) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteItem(db, id) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueOutbox(item) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({
      ...item,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event('a59-outbox-changed'));
}

export async function countOutbox() {
  const db = await openDb();
  const n = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return n;
}

/** Items that exhausted retries — visible dead-letter for operators. */
export async function countDeadLetter() {
  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.filter((i) => Number(i.attempts ?? 0) >= MAX_ATTEMPTS).length;
}

export async function listDeadLetter() {
  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.filter((i) => Number(i.attempts ?? 0) >= MAX_ATTEMPTS);
}

async function refreshTokenIfNeeded() {
  try {
    const { tryRefreshSession: refresh } = await import('../api/http');
    await refresh();
  } catch {
    /* best effort — flush may still succeed with existing token */
  }
}

export async function flushOutbox() {
  if (flushInFlight) return flushInFlight;
  flushInFlight = doFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function doFlush() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, failed: 0, deadLetter: 0 };
  }

  await refreshTokenIfNeeded();

  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let flushed = 0;
  let failed = 0;
  let deadLetter = 0;
  const token = getAccessToken();

  for (const item of items) {
    const attempts = Number(item.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      deadLetter += 1;
      continue;
    }
    if (!backoffElapsed(item)) {
      failed += 1;
      continue;
    }

    try {
      const headers = { ...(item.headers || {}), 'st-auth-mode': 'header' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(item.path, {
        method: item.method,
        headers,
        body: item.body,
      });

      // 409 = server already claimed Idempotency-Key — treat as success (audit F12).
      if (isOutboxSuccessStatus(res.status)) {
        await deleteItem(db, item.id);
        flushed += 1;
        continue;
      }

      await putItem(db, {
        ...item,
        attempts: attempts + 1,
        lastError: `HTTP ${res.status}`,
        lastAttemptAt: new Date().toISOString(),
      });
      failed += 1;
    } catch (err) {
      await putItem(db, {
        ...item,
        attempts: attempts + 1,
        lastError: err instanceof Error ? err.message : 'flush failed',
        lastAttemptAt: new Date().toISOString(),
      });
      failed += 1;
      // Continue past failures so one poison item does not block the queue.
      if (!CONTINUE_AFTER_ITEM_FAILURE) break;
    }
  }

  db.close();
  window.dispatchEvent(new Event('a59-outbox-changed'));
  return { flushed, failed, deadLetter };
}

/** Periodic flush with backoff (complements online-event flush). */
export function startOutboxPeriodicFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushOutbox();
    }
  }, FLUSH_INTERVAL_MS);
}

export function stopOutboxPeriodicFlush() {
  if (flushTimer != null) {
    window.clearInterval(flushTimer);
    flushTimer = null;
  }
}
