import { DRAW_BENCH_FIELD_REGISTER, fieldSourceLabel } from '../../../../shared/src/drawBenchFieldRegister';

/**
 * Source badge for a Draw Bench field register key (ERP / Manual / AUTO · PLC pending).
 */
export default function SourceBadge({ fieldKey, className = '' }) {
  const meta = DRAW_BENCH_FIELD_REGISTER[fieldKey];
  if (!meta) return null;
  const cls = String(meta.class || '').toLowerCase();
  return (
    <span className={`db-source-badge db-source-badge--${cls} ${className}`.trim()} title={meta.note || meta.id}>
      {fieldSourceLabel(meta.class)}
    </span>
  );
}

export { DRAW_BENCH_FIELD_REGISTER, fieldSourceLabel };
