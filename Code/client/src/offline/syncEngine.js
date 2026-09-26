import { getApiBase, rawApiFetch, tryRefreshSession } from '../api/http';
import { operatorApi } from '../api/operatorApi';
import { isOutboxSuccessStatus } from './outboxLogic';
import {
  countOutboxByStatus,
  enqueueOutboxItem,
  getSyncMeta,
  listPendingOutbox,
  markOutboxSynced,
  nextSeq,
  openLocalDb,
  pruneSyncedOutbox,
  setSyncMeta,
  updateOutboxItem,
  upsertMasterRows,
  upsertWorkItems,
} from './db';

const BACKOFF_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];
const SYNC_INTERVAL_MS = 5 * 60_000;

let syncTimer = null;
let syncInFlight = null;
let seqLocks = new Map();

const listeners = new Set();
let statusSnapshot = { pending: 0, parked: 0, lastSyncAt: null, lastError: null };

export function subscribeSyncStatus(fn) {
  listeners.add(fn);
  fn(statusSnapshot);
  return () => listeners.delete(fn);
}

function emitStatus(patch) {
  statusSnapshot = { ...statusSnapshot, ...patch };
  listeners.forEach((fn) => fn(statusSnapshot));
  window.dispatchEvent(new CustomEvent('a59-sync-status', { detail: statusSnapshot }));
}

async function refreshCounts() {
  try {
    const { pending, parked } = await countOutboxByStatus();
    emitStatus({ pending, parked });
  } catch {
    /* ignore */
  }
}

function backoffMs(attempts) {
  const i = Math.min(Math.max(attempts - 1, 0), BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[i];
}

/**
 * Write-ahead choke point for operator mutations.
 */
export async function submitOrQueue({
  url,
  method = 'POST',
  payload,
  aggregateKey,
  headers = {},
}) {
  await openLocalDb();
  const agg = aggregateKey || `global:${url}`;
  if (!seqLocks.has(agg)) seqLocks.set(agg, Promise.resolve());
  const prev = seqLocks.get(agg);
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  seqLocks.set(
    agg,
    prev.then(() => gate)
  );
  await prev;

  try {
    const id = crypto.randomUUID();
    const seq = await nextSeq(agg);
    const path = url.startsWith('http') ? url : `${getApiBase()}${url.startsWith('/') ? url : `/${url}`}`;
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const hdrs = {
      'Content-Type': 'application/json',
      'Idempotency-Key': id,
      ...headers,
    };

    await enqueueOutboxItem({
      id,
      aggregateKey: agg,
      seq,
      url: path,
      method: method.toUpperCase(),
      payload: body,
      headers: hdrs,
    });

    const online = typeof navigator === 'undefined' || navigator.onLine;
    if (online) {
      void syncNow('submit');
    }
    await refreshCounts();
    return { queued: !online, id, syncing: online };
  } finally {
    release();
  }
}

async function pushOutbox() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, failed: 0, parked: 0 };
  }

  await tryRefreshSession().catch(() => false);

  const items = await listPendingOutbox();
  const byAgg = new Map();
  for (const item of items) {
    if (item.status === 'parked') continue;
    if (!byAgg.has(item.aggregate_key)) byAgg.set(item.aggregate_key, []);
    byAgg.get(item.aggregate_key).push(item);
  }

  let flushed = 0;
  let failed = 0;
  let parked = 0;

  await Promise.all(
    [...byAgg.values()].map(async (group) => {
      group.sort((a, b) => a.seq - b.seq);
      for (const item of group) {
        const attempts = Number(item.attempts ?? 0);
        if (item.last_error && item.status === 'pending') {
          const lastAt = Number(item.synced_at) || item.created_at;
          // Use created_at / a stored last attempt via attempts field — simple elapsed check
          if (attempts > 0) {
            const wait = backoffMs(attempts);
            // last_error set implies a prior attempt; use created_at + attempts as proxy if no timestamp
            const approxLast = item.created_at + attempts * 1000;
            if (Date.now() - approxLast < wait && attempts > 0) {
              // soft skip — still count as waiting
              failed += 1;
              break;
            }
          }
        }

        try {
          await updateOutboxItem(item.id, { status: 'inflight' });
          const headers =
            typeof item.headers === 'string' ? JSON.parse(item.headers || '{}') : item.headers || {};
          const res = await rawApiFetch(item.url, {
            method: item.method,
            headers,
            body: item.payload,
          });

          if (isOutboxSuccessStatus(res.status)) {
            await markOutboxSynced(item.id);
            flushed += 1;
            continue;
          }

          if (res.status >= 500 || res.status === 0) {
            await updateOutboxItem(item.id, {
              status: 'pending',
              attempts: attempts + 1,
              last_error: `HTTP ${res.status}`,
            });
            failed += 1;
            break; // halt this aggregate
          }

          // 4xx validation — park
          let errText = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            errText = j?.errors?.[0]?.message || errText;
          } catch {
            /* ignore */
          }
          await updateOutboxItem(item.id, {
            status: 'parked',
            attempts: attempts + 1,
            last_error: errText,
          });
          parked += 1;
          break;
        } catch (err) {
          await updateOutboxItem(item.id, {
            status: 'pending',
            attempts: attempts + 1,
            last_error: err instanceof Error ? err.message : 'network',
          });
          failed += 1;
          break;
        }
      }
    })
  );

  return { flushed, failed, parked };
}

export async function pullCaches() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const masters = await operatorApi.masters(await getSyncMeta('masters_cursor'));
    if (masters?.tables) {
      for (const [table, rows] of Object.entries(masters.tables)) {
        await upsertMasterRows(table, rows);
      }
      if (masters.serverTime) await setSyncMeta('masters_cursor', masters.serverTime);
    }
  } catch {
    /* best effort */
  }
  try {
    const work = await operatorApi.work();
    if (work?.items) {
      await upsertWorkItems(work.items);
      if (work.serverTime) await setSyncMeta('work_cursor', work.serverTime);
    }
  } catch {
    /* best effort */
  }
}

export async function syncNow(reason = 'manual') {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    await openLocalDb();
    const push = await pushOutbox();
    await pullCaches();
    await pruneSyncedOutbox();
    await refreshCounts();
    emitStatus({ lastSyncAt: Date.now(), lastError: push.parked ? 'parked items' : null });
    return push;
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export function startSyncEngine() {
  if (syncTimer != null) return;
  void openLocalDb().then(() => refreshCounts());
  void syncNow('start');
  syncTimer = window.setInterval(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) void syncNow('interval');
  }, SYNC_INTERVAL_MS);
  window.addEventListener('online', () => {
    void syncNow('reconnect');
  });
  try {
    import('@capacitor/network').then(({ Network }) => {
      Network.addListener('networkStatusChange', (s) => {
        if (s.connected) void syncNow('network');
      });
    }).catch(() => undefined);
  } catch {
    /* optional */
  }
}

export function stopSyncEngine() {
  if (syncTimer != null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

export async function discardParked(id) {
  await updateOutboxItem(id, { status: 'synced', synced_at: Date.now(), last_error: 'discarded' });
  await refreshCounts();
}

export function getSyncStatus() {
  return statusSnapshot;
}
