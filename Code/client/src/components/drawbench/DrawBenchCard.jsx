import { ZBadge, ZButton, statusTone } from '../../ui';

function ageLabel(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export default function DrawBenchCard({ row, onOpen, onAssign, assigning }) {
  const status = String(row.status ?? 'IDLE');
  const order = row.runningOrder;
  const idle = status === 'IDLE' || status === 'COMPLETE';

  return (
    <article className={`db-card db-card--${status.toLowerCase()}`}>
      <div className={`db-card__vert db-card__vert--${status.toLowerCase()}`}>
        <span>{status}</span>
      </div>
      <div className="db-card__body">
        <header className="db-card__head">
          <div>
            <h3 className="db-card__title">{row.benchCode}</h3>
            <p className="db-card__label muted">
              {row.label || row.benchCode}
              {row.tonnageT != null ? ` · ${row.tonnageT}T` : ''}
            </p>
          </div>
          <div className="db-card__badges">
            <ZBadge tone={statusTone(status === 'COMPLETE' ? 'COMPLETED' : status)} pulse={status === 'RUNNING' || status === 'STOPPAGE'}>
              {status}
            </ZBadge>
            <ZBadge tone="info">{row.plcStatus || 'PLC pending'}</ZBadge>
          </div>
        </header>

        <dl className="db-card__meta">
          <div>
            <dt>Work order</dt>
            <dd>{order?.workOrderNo || '—'}</dd>
          </div>
          <div>
            <dt>Lot</dt>
            <dd>{row.lotNo || '—'}</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>{row.operatorRef || '—'}</dd>
          </div>
          <div>
            <dt>Shift</dt>
            <dd>{row.shiftRef || '—'}</dd>
          </div>
          <div>
            <dt>Production</dt>
            <dd>{row.progressLabel || '—'}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{ageLabel(row.lastSavedAt)}</dd>
          </div>
        </dl>

        {order?.gradeCode || order?.size ? (
          <p className="db-card__spec muted">
            {[order?.gradeCode, order?.drawPass, order?.size].filter(Boolean).join(' · ')}
          </p>
        ) : null}

        {row.openStoppage ? (
          <p className="banner banner--warn">
            Stoppage {row.openStoppage.code}
            {row.openStoppage.reason ? ` · ${row.openStoppage.reason}` : ''}
          </p>
        ) : null}

        <div className="db-card__actions btn-row">
          <ZButton variant="primary" onClick={() => onOpen?.(row)}>
            {idle && !order?.workOrderNo ? 'Open console' : 'Open production'}
          </ZButton>
          {idle ? (
            <ZButton variant="ghost" disabled={assigning} onClick={() => onAssign?.(row)}>
              Assign WO
            </ZButton>
          ) : null}
        </div>
      </div>
    </article>
  );
}
