import { query } from '../db/pool';
import { config } from '../config';

/**
 * Allowlisted master entities for Admin CRUD.
 * idColumn: null means use `code` as path id; 'id' uses uuid; 'composite' uses encoded key.
 */
const ENTITIES = {
  grade: {
    table: 'master.grade',
    idColumn: 'code',
    columns: {
      code: 'code',
      label: 'label',
      densityKgM3: 'density_kg_m3',
    },
    mapRow: (r) => ({
      code: r.code,
      label: r.label,
      densityKgM3: r.density_kg_m3 != null ? Number(r.density_kg_m3) : null,
    }),
  },
  customer: {
    table: 'master.customer',
    idColumn: 'code',
    columns: { code: 'code', name: 'name' },
    mapRow: (r) => ({ code: r.code, name: r.name }),
  },
  defect_code: {
    table: 'master.defect_code',
    idColumn: 'code',
    columns: { code: 'code', label: 'label', category: 'category' },
    mapRow: (r) => ({ code: r.code, label: r.label, category: r.category }),
  },
  stoppage_code: {
    table: 'master.stoppage_code',
    idColumn: 'code',
    columns: {
      code: 'code',
      label: 'label',
      category: 'category',
      isPlanned: 'is_planned',
    },
    mapRow: (r) => ({
      code: r.code,
      label: r.label,
      category: r.category,
      isPlanned: Boolean(r.is_planned),
    }),
  },
  tm_consumable: {
    table: 'master.tm_consumable',
    idColumn: 'code',
    columns: { code: 'code', kind: 'kind', status: 'status' },
    mapRow: (r) => ({ code: r.code, kind: r.kind, status: r.status }),
  },
  stp_bath_spec: {
    table: 'master.stp_bath_spec',
    idColumn: 'id',
    columns: {
      bathCode: 'bath_code',
      bathLabel: 'bath_label',
      paramKey: 'param_key',
      minVal: 'min_val',
      maxVal: 'max_val',
      unit: 'unit',
    },
    mapRow: (r) => ({
      id: r.id,
      bathCode: r.bath_code,
      bathLabel: r.bath_label,
      paramKey: r.param_key,
      minVal: r.min_val != null ? Number(r.min_val) : null,
      maxVal: r.max_val != null ? Number(r.max_val) : null,
      unit: r.unit,
    }),
  },
  fur_zone_recipe: {
    table: 'master.fur_zone_recipe',
    idColumn: 'id',
    columns: {
      gradeCode: 'grade_code',
      furnaceCode: 'furnace_code',
      soakingSpecC: 'soaking_spec_c',
      speedSpecMHr: 'speed_spec_m_hr',
    },
    mapRow: (r) => ({
      id: r.id,
      gradeCode: r.grade_code,
      furnaceCode: r.furnace_code,
      soakingSpecC: r.soaking_spec_c != null ? Number(r.soaking_spec_c) : null,
      speedSpecMHr: r.speed_spec_m_hr != null ? Number(r.speed_spec_m_hr) : null,
    }),
  },
};

export function getEntityDef(entityType) {
  const def = ENTITIES[entityType];
  if (!def) {
    const err = new Error(`Unknown entityType: ${entityType}`);
    err.status = 400;
    throw err;
  }
  return def;
}

export function listEntityTypes() {
  return Object.keys(ENTITIES);
}

export async function listEntities(entityType) {
  const def = getEntityDef(entityType);
  const rows = await query(
    `SELECT * FROM ${def.table} WHERE tenant_id = $1 ORDER BY 1`,
    [config.tenantId]
  );
  return rows.map(def.mapRow);
}

function pickInsert(def, body) {
  const cols = ['tenant_id'];
  const vals = [config.tenantId];
  const placeholders = ['$1'];
  let i = 2;
  for (const [apiKey, dbCol] of Object.entries(def.columns)) {
    if (body[apiKey] === undefined && body[dbCol] === undefined) continue;
    let v = body[apiKey] !== undefined ? body[apiKey] : body[dbCol];
    if (apiKey === 'isPlanned') v = Boolean(v);
    if (['densityKgM3', 'minVal', 'maxVal', 'soakingSpecC', 'speedSpecMHr'].includes(apiKey) && v !== '' && v != null) {
      v = Number(v);
    }
    cols.push(dbCol);
    vals.push(v);
    placeholders.push(`$${i++}`);
  }
  return { cols, vals, placeholders };
}

export async function createEntity(entityType, body) {
  const def = getEntityDef(entityType);
  const { cols, vals, placeholders } = pickInsert(def, body ?? {});
  if (cols.length <= 1) {
    const err = new Error('No fields provided');
    err.status = 400;
    throw err;
  }
  const rows = await query(
    `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    vals
  );
  return def.mapRow(rows[0]);
}

export async function updateEntity(entityType, id, body) {
  const def = getEntityDef(entityType);
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [apiKey, dbCol] of Object.entries(def.columns)) {
    if (body[apiKey] === undefined) continue;
    if (dbCol === def.idColumn) continue;
    let v = body[apiKey];
    if (apiKey === 'isPlanned') v = Boolean(v);
    if (['densityKgM3', 'minVal', 'maxVal', 'soakingSpecC', 'speedSpecMHr'].includes(apiKey) && v !== '' && v != null) {
      v = Number(v);
    }
    sets.push(`${dbCol} = $${i++}`);
    vals.push(v);
  }
  if (!sets.length) {
    const err = new Error('No updatable fields');
    err.status = 400;
    throw err;
  }
  vals.push(id, config.tenantId);
  const rows = await query(
    `UPDATE ${def.table} SET ${sets.join(', ')}
     WHERE ${def.idColumn} = $${i} AND tenant_id = $${i + 1}
     RETURNING *`,
    vals
  );
  if (!rows[0]) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  return def.mapRow(rows[0]);
}

export async function deleteEntity(entityType, id) {
  const def = getEntityDef(entityType);
  // Support composite id for stp_bath when client sends bathCode:paramKey and row has no match by uuid
  let result;
  if (entityType === 'stp_bath_spec' && String(id).includes(':')) {
    const [bathCode, paramKey] = String(id).split(':');
    result = await query(
      `DELETE FROM master.stp_bath_spec
       WHERE tenant_id = $1 AND bath_code = $2 AND param_key = $3
       RETURNING id`,
      [config.tenantId, bathCode, paramKey]
    );
  } else {
    result = await query(
      `DELETE FROM ${def.table} WHERE ${def.idColumn} = $1 AND tenant_id = $2 RETURNING ${def.idColumn}`,
      [id, config.tenantId]
    );
  }
  if (!result[0]) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}
