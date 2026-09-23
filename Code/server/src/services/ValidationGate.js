import {
  validateRecord,
  errorsOnly,
  furnaceRules,
  stpRules,
  drawBenchRules,
  tubeMillRules,
  swageRules,
} from '@a59/shared';
import {
  listValidationRules,
  mergeOverlaysOntoRuleset,
} from './ValidationConfigService';

const RULESETS = {
  FUR: furnaceRules,
  ANN: furnaceRules,
  STP: stpRules,
  DRW: drawBenchRules,
  TM: tubeMillRules,
  SWG: swageRules,
};

export class ValidationError extends Error {
  /** @param {{ message: string }[]} issues */
  constructor(issues) {
    super(issues.map((i) => i.message).join('; ') || 'Validation failed');
    this.name = 'ValidationError';
    /** @type {{ message: string }[]} */
    this.issues = issues;
  }
}

/**
 * Assert shared Zod/ruleset validation for a process row, with DB overlays when available.
 * @param {string} processCode
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} [opts]
 * @returns {Promise<unknown[]>}
 */
export async function assertValid(processCode, row, opts = {}) {
  const base = RULESETS[processCode];
  if (!base) return [];

  let rules = base;
  try {
    const overlays = await listValidationRules(processCode === 'ANN' ? 'FUR' : processCode);
    rules = mergeOverlaysOntoRuleset(base, overlays);
  } catch {
    // config.validation_rule missing or DB error — fall back to code rulesets
    rules = base;
  }

  const issues = validateRecord(rules, row, opts);
  const errs = errorsOnly(issues);
  if (errs.length) throw new ValidationError(errs);
  return issues;
}

/** Sync helper for call sites that cannot await (rare). Prefer assertValid. */
export function assertValidSync(processCode, row, opts = {}) {
  const rules = RULESETS[processCode];
  if (!rules) return [];
  const issues = validateRecord(rules, row, opts);
  const errs = errorsOnly(issues);
  if (errs.length) throw new ValidationError(errs);
  return issues;
}
