

export function validateRecord(
ruleSet,
row,
opts = {})
{
  const issues = [];
  for (const fr of ruleSet) {
    const ctx = {
      value: row[fr.field],
      row,
      siblings: opts.siblings,
      master: opts.master
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