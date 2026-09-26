/**
 * Local SQLite (native) / IndexedDB (web) repository for operator offline.
 */
const DB_NAME = 'a59_operator';
const IDB_VERSION = 1;

let sqliteDb = null;
let idb = null;
let mode = null; // 'sqlite' | 'idb'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  aggregate_key TEXT NOT NULL,
  seq INTEGER NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  payload TEXT NOT NULL,
  headers TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_agg ON outbox (aggregate_key, seq);
CREATE TABLE IF NOT EXISTS master_cache (
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (table_name, row_id)
);
CREATE TABLE IF NOT EXISTS work_cache (
  work_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_cache (
  user_code TEXT PRIMARY KEY,
  pin_verifier TEXT NOT NULL,
  display_name TEXT,
  role TEXT,
  line_code TEXT,
  cached_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
`;

async function openSqlite() {
  try {
    const core = await import('@capacitor/core');
    if (!core.Capacitor?.isNativePlatform?.()) return null;
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const conn = new SQLiteConnection(CapacitorSQLite);
    const ret = await conn.checkConnectionsConsistency();
    const isConn = (await conn.isConnection(DB_NAME, false)).result;
    let db;
    if (ret.result && isConn) {
      db = await conn.retrieveConnection(DB_NAME, false);
    } else {
      db = await conn.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }
    await db.open();
    await db.execute(SCHEMA_SQL);
    return db;
  } catch {
    return null;
  }
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        const os = db.createObjectStore('outbox', { keyPath: 'id' });
        os.createIndex('by_agg', ['aggregate_key', 'seq'], { unique: false });
      }
      if (!db.objectStoreNames.contains('master_cache')) {
        db.createObjectStore('master_cache', { keyPath: ['table_name', 'row_id'] });
      }
      if (!db.objectStoreNames.contains('work_cache')) {
        db.createObjectStore('work_cache', { keyPath: 'work_key' });
      }
      if (!db.objectStoreNames.contains('auth_cache')) {
        db.createObjectStore('auth_cache', { keyPath: 'user_code' });
      }
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openLocalDb() {
  if (mode) return { mode };
  sqliteDb = await openSqlite();
  if (sqliteDb) {
    mode = 'sqlite';
    return { mode };
  }
  idb = await openIdb();
  mode = 'idb';
  return { mode };
}

async function idbPut(store, value) {
  await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(store) {
  await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store, key) {
  await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(store, key) {
  await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOutboxItem(item) {
  await openLocalDb();
  const row = {
    id: item.id,
    aggregate_key: item.aggregateKey,
    seq: item.seq,
    url: item.url,
    method: item.method,
    payload: typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload ?? {}),
    headers: JSON.stringify(item.headers ?? {}),
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: Date.now(),
    synced_at: null,
  };
  if (mode === 'sqlite') {
    await sqliteDb.run(
      `INSERT INTO outbox (id, aggregate_key, seq, url, method, payload, headers, status, attempts, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id,
        row.aggregate_key,
        row.seq,
        row.url,
        row.method,
        row.payload,
        row.headers,
        row.status,
        row.attempts,
        row.created_at,
      ]
    );
  } else {
    await idbPut('outbox', row);
  }
  window.dispatchEvent(new Event('a59-outbox-changed'));
}

export async function listPendingOutbox() {
  await openLocalDb();
  if (mode === 'sqlite') {
    const res = await sqliteDb.query(
      `SELECT * FROM outbox WHERE status IN ('pending','inflight','parked')
       ORDER BY aggregate_key, seq`
    );
    return res.values ?? [];
  }
  const all = await idbGetAll('outbox');
  return all
    .filter((r) => r.status === 'pending' || r.status === 'inflight' || r.status === 'parked')
    .sort((a, b) =>
      a.aggregate_key === b.aggregate_key ? a.seq - b.seq : a.aggregate_key.localeCompare(b.aggregate_key)
    );
}

export async function updateOutboxItem(id, patch) {
  await openLocalDb();
  if (mode === 'sqlite') {
    const fields = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      fields.push(`${k} = ?`);
      vals.push(v);
    }
    vals.push(id);
    await sqliteDb.run(`UPDATE outbox SET ${fields.join(', ')} WHERE id = ?`, vals);
  } else {
    const cur = await idbGet('outbox', id);
    if (cur) await idbPut('outbox', { ...cur, ...patch });
  }
  window.dispatchEvent(new Event('a59-outbox-changed'));
}

export async function markOutboxSynced(id) {
  await updateOutboxItem(id, { status: 'synced', synced_at: Date.now(), last_error: null });
}

export async function countOutboxByStatus() {
  const items = await listPendingOutbox();
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'inflight').length;
  const parked = items.filter((i) => i.status === 'parked').length;
  return { pending, parked };
}

export async function setSyncMeta(k, v) {
  await openLocalDb();
  if (mode === 'sqlite') {
    await sqliteDb.run(
      `INSERT INTO sync_meta (k, v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`,
      [k, String(v)]
    );
  } else {
    await idbPut('sync_meta', { k, v: String(v) });
  }
}

export async function getSyncMeta(k) {
  await openLocalDb();
  if (mode === 'sqlite') {
    const res = await sqliteDb.query(`SELECT v FROM sync_meta WHERE k = ?`, [k]);
    return res.values?.[0]?.v ?? null;
  }
  const row = await idbGet('sync_meta', k);
  return row?.v ?? null;
}

export async function upsertMasterRows(tableName, rows) {
  const now = Date.now();
  for (const r of rows) {
    const data = JSON.stringify(r.data ?? r);
    const rowId = String(r.rowId ?? r.id);
    if (mode === 'sqlite') {
      await openLocalDb();
      await sqliteDb.run(
        `INSERT INTO master_cache (table_name, row_id, data, updated_at) VALUES (?,?,?,?)
         ON CONFLICT(table_name, row_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [tableName, rowId, data, now]
      );
    } else {
      await idbPut('master_cache', { table_name: tableName, row_id: rowId, data, updated_at: now });
    }
  }
}

export async function upsertWorkItems(items) {
  const now = Date.now();
  for (const it of items) {
    const data = JSON.stringify(it.data ?? it);
    const workKey = String(it.workKey ?? it.id);
    if (mode === 'sqlite') {
      await openLocalDb();
      await sqliteDb.run(
        `INSERT INTO work_cache (work_key, data, updated_at) VALUES (?,?,?)
         ON CONFLICT(work_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [workKey, data, now]
      );
    } else {
      await idbPut('work_cache', { work_key: workKey, data, updated_at: now });
    }
  }
}

export async function saveAuthCache(entry) {
  await openLocalDb();
  const row = {
    user_code: entry.userCode,
    pin_verifier: entry.pinVerifier,
    display_name: entry.displayName ?? null,
    role: entry.role ?? 'OPERATOR',
    line_code: entry.lineCode ?? null,
    cached_at: Date.now(),
  };
  if (mode === 'sqlite') {
    await sqliteDb.run(
      `INSERT INTO auth_cache (user_code, pin_verifier, display_name, role, line_code, cached_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(user_code) DO UPDATE SET
         pin_verifier = excluded.pin_verifier,
         display_name = excluded.display_name,
         role = excluded.role,
         line_code = excluded.line_code,
         cached_at = excluded.cached_at`,
      [
        row.user_code,
        row.pin_verifier,
        row.display_name,
        row.role,
        row.line_code,
        row.cached_at,
      ]
    );
  } else {
    await idbPut('auth_cache', row);
  }
}

export async function getAuthCache(userCode) {
  await openLocalDb();
  if (mode === 'sqlite') {
    const res = await sqliteDb.query(`SELECT * FROM auth_cache WHERE user_code = ?`, [userCode]);
    return res.values?.[0] ?? null;
  }
  return idbGet('auth_cache', userCode);
}

/** Next seq for an aggregate. */
export async function nextSeq(aggregateKey) {
  const items = await listPendingOutbox();
  const same = items.filter((i) => i.aggregate_key === aggregateKey);
  const max = same.reduce((m, i) => Math.max(m, Number(i.seq) || 0), 0);
  return max + 1;
}

export async function pruneSyncedOutbox(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  await openLocalDb();
  const cutoff = Date.now() - maxAgeMs;
  if (mode === 'sqlite') {
    await sqliteDb.run(
      `DELETE FROM outbox WHERE status = 'synced' AND synced_at IS NOT NULL AND synced_at < ?`,
      [cutoff]
    );
  } else {
    const all = await idbGetAll('outbox');
    for (const r of all) {
      if (r.status === 'synced' && r.synced_at && r.synced_at < cutoff) {
        await idbDelete('outbox', r.id);
      }
    }
  }
}
