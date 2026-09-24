
/**
 * @param {import('./types').FieldRule[]} ruleSet
 * @param {Record<string, unknown>} row
 * @param {{ siblings?: unknown, master?: Record<string, unknown>, mode?: 'full' | 'partial' }} [opts]
 *   mode 'partial': skip fields not present on the payload (REQUIRED cannot fire for omitted keys).
 */
export function validateRecord(ruleSet, row, opts = {}) {
  const issues = [];
  const partial = opts.mode === 'partial';
  for (const fr of ruleSet) {
    if (partial && !Object.prototype.hasOwnProperty.call(row, fr.field)) {
      continue;
    }
    const ctx = {
      value: row[fr.field],
      row,
      siblings: opts.siblings,
      master: opts.master,
    };
    for (const rule of fr.rules) {
      const i = rule(ctx);
      if (i) issues.push(i);
    }
  }
  return issues;
}

export const errorsOnly = (issues) => issues.filter((x) => x.severity === 'ERROR');
export const warningsOnly = (issues) => issues.filter((x) => x.severity === 'WARN');