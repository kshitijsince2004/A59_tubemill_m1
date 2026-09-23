import { ZBadge, ZButton, statusTone } from '../ui';

/**
 * Production history only — Setup and Parameters have their own module lists.
 */
export default function HistoryModule({
  history = [],
  onOpenRun,
}) {
  const completed = history.filter((h) =>
    ['SUBMITTED', 'APPROVED', 'LOCKED', 'Completed'].includes(h.status) ||
    h.runState === 'RUN_COMPLETE'
  );

  return (
    <div className="stack-gap">
      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">Production run history</span>
          <ZBadge tone="idle">{String(completed.length || history.length)}</ZBadge>
        </header>
        <ul className="panel__list">
          {(completed.length ? completed : history).map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="linkish font-mono"
                onClick={() => onOpenRun?.(h)}
              >
                {h.runNo} · {h.workOrderNo} · {h.status} · {h.runState}
              </button>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {h.millCode ?? 'A-59'}
                {h.sizeKey ? ` · ${h.sizeKey}` : ''}
                {h.gradeCode ? ` / ${h.gradeCode}` : ''}
              </div>
            </li>
          ))}
          {!history.length ? <li className="empty-hint">No production runs yet.</li> : null}
        </ul>
        {onOpenRun && history[0] ? (
          <div className="btn-row" style={{ marginTop: '0.5rem' }}>
            <ZButton variant="ghost" size="sm" onClick={() => onOpenRun(history[0])}>
              Open latest run
            </ZButton>
          </div>
        ) : null}
      </section>
    </div>
  );
}
