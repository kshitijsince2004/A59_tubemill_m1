

const num = (v) => v === '' || v == null ? NaN : Number(v);

export const required = (field, label = field) =>
({ value }) =>
value === '' || value == null ?
{ field, code: 'REQUIRED', message: `${label} is required`, severity: 'ERROR' } :
null;

export const range = (
field,
min,
max,
label = field,
sev = 'ERROR') =>

({ value }) => {
  const n = num(value);
  if (Number.isNaN(n)) return null;
  return n < min || n > max ?
  { field, code: 'RANGE', message: `${label} ${n} out of ${min}–${max}`, severity: sev } :
  null;
};

export const toleranceVsSpec = (
field,
specKey,
tol,
label = field) =>

({ value, master }) => {
  const n = num(value);
  const s = num(master?.[specKey]);
  const t = typeof tol === 'string' ? num(master?.[tol]) : num(tol);
  if (Number.isNaN(n) || Number.isNaN(s) || Number.isNaN(t)) return null;
  return Math.abs(n - s) > t ?
  {
    field,
    code: 'TOL',
    message: `${label} ${n} beyond ±${t} of spec ${s}`,
    severity: 'WARN'
  } :
  null;
};

export const oneOf = (field, allowed, label = field) =>
({ value }) =>
value == null || value === '' || allowed.includes(String(value)) ?
null :
{
  field,
  code: 'ENUM',
  message: `${label} must be one of ${allowed.join(', ')}`,
  severity: 'ERROR'
};

export const lessThan = (field, otherField, label = field, sev = 'ERROR') =>
({ value, row }) => {
  const a = num(value);
  const b = num(row[otherField]);
  return !Number.isNaN(a) && !Number.isNaN(b) && a >= b ?
  {
    field,
    code: 'CROSS',
    message: `${label} must be less than ${otherField}`,
    severity: sev
  } :
  null;
};

/** Value must fall within master[minKey]..master[maxKey] when both are set. */
export const inMasterBand = (
field,
minKey,
maxKey,
label = field,
sev = 'WARN') =>

({ value, master }) => {
  const n = num(value);
  const lo = num(master?.[minKey]);
  const hi = num(master?.[maxKey]);
  if (Number.isNaN(n) || Number.isNaN(lo) || Number.isNaN(hi)) return null;
  return n < lo || n > hi ?
  {
    field,
    code: 'BAND',
    message: `${label} ${n} outside ${lo}–${hi}`,
    severity: sev
  } :
  null;
};

/** Zone max must be ≥ zone min (equal allowed). */
export const maxGteMin = (minField, maxField, label = maxField) =>
({ row }) => {
  const a = num(row[minField]);
  const b = num(row[maxField]);
  return !Number.isNaN(a) && !Number.isNaN(b) && b < a
    ? {
        field: maxField,
        code: 'CROSS',
        message: `${label} max must be ≥ min`,
        severity: 'ERROR',
      }
    : null;
};

export const sumEquals = (
field,
parts,
tolPct = 1,
label = field) =>

({ value, row }) => {
  const total = num(value);
  const s = parts.reduce((a, p) => a + (num(row[p]) || 0), 0);
  if (Number.isNaN(total) || !total) return null;
  return Math.abs(total - s) / total * 100 > tolPct ?
  {
    field,
    code: 'RECONCILE',
    message: `${label} ${total} ≠ sum(${parts.join('+')})=${s}`,
    severity: 'WARN'
  } :
  null;
};