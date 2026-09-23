import {
  validateRecord,
  errorsOnly } from


'../../../shared/src/validation';
import { furnaceRules } from '../../../shared/src/validation/rulesets/furnace';
import { stpRules } from '../../../shared/src/validation/rulesets/stp';
import { drawBenchRules } from '../../../shared/src/validation/rulesets/drawbench';
import { swageRules } from '../../../shared/src/validation/rulesets/swage';

const MAP = {
  FUR: furnaceRules,
  STP: stpRules,
  DRW: drawBenchRules,
  SWG: swageRules
};

export function validateProcessForm(
process,
row,
master)
{
  const rules = MAP[process];
  if (!rules) return { errors: [], warnings: [], ok: true };
  const issues = validateRecord(rules, row, { master });
  const errors = errorsOnly(issues);
  const warnings = issues.filter((i) => i.severity === 'WARN');
  return { errors, warnings, ok: errors.length === 0 };
}