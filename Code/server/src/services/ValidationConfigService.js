import { query } from '../db/pool';
import { config } from '../config';
import { required, range, oneOf, toleranceVsSpec } from '@a59/shared';

function mapRow(r) {
  return {
    id: r.id,
    processCode: r.process_code,
    field: r.field,
    ruleType: r.rule_type,
    params: typeof r.params === 'string' ? JSON.parse(r.params) : r.params ?? {},
    severity: r.severity,
    enabled: Boolean(r.enabled),
    version: Number(r.version ?? 1),
    updatedAt: r.updated_at,
  };
}

export async function listValidationRules(processCode) {
  const rows = processCode
    ? await query(
        `SELECT * FROM config.validation_rule
         WHERE tenant_id = $1 AND process_code = $2
         ORDER BY field, rule_type`,
        [config.tenantId, processCode]
      )
    : await query(
        `SELECT * FROM config.validation_rule
         WHERE tenant_id = $1
         ORDER BY process_code, field, rule_type`,
        [config.tenantId]
      );
  return rows.map(mapRow);
}

export async function getValidationRulesVersion() {
  const rows = await query(
    `SELECT COALESCE(MAX(version), 0)::int AS version FROM config.validation_rule WHERE tenant_id = $1`,
    [config.tenantId]
  );
  return rows[0]?.version ?? 0;
}

export async function upsertValidationRule(body) {
  const processCode = String(body.processCode ?? body.process_code ?? '').trim();
  const field = String(body.field ?? '').trim();
  const ruleType = String(body.ruleType ?? body.rule_type ?? '').trim();
  if (!processCode || !field || !ruleType) {
    const err = new Error('processCode, field, and ruleType are required');
    err.status = 400;
    throw err;
  }
  const params = body.params ?? {};
  const severity = body.severity ?? 'ERROR';
  const enabled = body.enabled !== false;
  const rows = await query(
    `INSERT INTO config.validation_rule (
       tenant_id, process_code, field, rule_type, params, severity, enabled, version, updated_at
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,1,now())
     ON CONFLICT (tenant_id, process_code, field, rule_type) DO UPDATE SET
       params = EXCLUDED.params,
       severity = EXCLUDED.severity,
       enabled = EXCLUDED.enabled,
       version = config.validation_rule.version + 1,
       updated_at = now()
     RETURNING *`,
    [config.tenantId, processCode, field, ruleType, JSON.stringify(params), severity, enabled]
  );
  return mapRow(rows[0]);
}

export async function deleteValidationRule(ruleId) {
  const rows = await query(
    `DELETE FROM config.validation_rule WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [ruleId, config.tenantId]
  );
  if (!rows[0]) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

/**
 * Build runtime rule functions from a DB overlay row.
 * @param {{ field: string, ruleType: string, params: Record<string, unknown>, severity: string }} overlay
 */
export function overlayToRuleFns(overlay) {
  const field = overlay.field;
  const sev = overlay.severity === 'WARN' ? 'WARN' : 'ERROR';
  const p = overlay.params ?? {};
  switch (overlay.ruleType) {
    case 'required':
      return [required(field, field)];
    case 'range':
      return [
        range(
          field,
          Number(p.min ?? Number.NEGATIVE_INFINITY),
          Number(p.max ?? Number.POSITIVE_INFINITY),
          field,
          sev
        ),
      ];
    case 'oneOf':
      return [oneOf(field, Array.isArray(p.values) ? p.values.map(String) : [], field)];
    case 'toleranceVsSpec':
      return [
        toleranceVsSpec(field, String(p.specKey ?? 'spec'), Number(p.tol ?? p.min ?? 0), field),
      ];
    default:
      return [];
  }
}

/**
 * Merge DB overlays onto a code ruleset (field-level append of overlay rule fns).
 * @param {Array<{ field: string, label?: string, rules: Function[] }>} baseRuleset
 * @param {Array<{ field: string, ruleType: string, params: object, severity: string, enabled: boolean }>} overlays
 */
export function mergeOverlaysOntoRuleset(baseRuleset, overlays) {
  const enabled = (overlays ?? []).filter((o) => o.enabled !== false);
  if (!enabled.length) return baseRuleset;
  const byField = new Map(baseRuleset.map((fr) => [fr.field, { ...fr, rules: [...fr.rules] }]));
  for (const o of enabled) {
    const fns = overlayToRuleFns(o);
    if (!fns.length) continue;
    const existing = byField.get(o.field);
    if (existing) {
      existing.rules.push(...fns);
    } else {
      byField.set(o.field, { field: o.field, label: o.field, rules: fns });
    }
  }
  return [...byField.values()];
}
