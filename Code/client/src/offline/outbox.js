import { getAccessToken } from '../lib/authStore';

const DB_NAME = 'a59-outbox';
const STORE = 'requests';
const MAX_ATTEMPTS = 8;

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

export async function flushOutbox() {
  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let flushed = 0;
  let failed = 0;
  const token = getAccessToken();

  for (const item of items) {
    const attempts = Number(item.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
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
      if (res.ok || res.status === 409) {
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
    }
  }

  db.close();
  window.dispatchEvent(new Event('a59-outbox-changed'));
  return { flushed, failed };
}
