import { useQuery } from '@tanstack/react-query';
import { ZBadge, ZButton, statusTone } from '../ui';
import { tubemillApi } from '../api/tubemillClient';

function fmtMt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

function woOf(item) {
  return item?.work_order_no ?? item?.workOrderNo ?? '—';
}

function gradeOf(item) {
  return item?.grade_code ?? item?.gradeCode ?? '—';
}

function sizeOf(item) {
  return item?.size_key ?? item?.sizeKey ?? null;
}

function customerOf(item) {
  return item?.customer_code ?? item?.customerCode ?? '—';
}

function batchOf(item) {
  return item?.bc_batch_number ?? item?.bcBatchNumber ?? null;
}

function NextCard({ item, position }) {
  const product = [gradeOf(item), sizeOf(item)].filter(Boolean).join(' · ') || '—';
  return (
    <div className="stp-overview__next-grid">
      <div className="stp-overview__kv">
        <span>Order</span>
        <strong>{woOf(item)}</strong>
      </div>
      <div className="stp-overview__kv">
        <span>Product</span>
        <strong>{product}</strong>
      </div>
      <div className="stp-overview__kv">
        <span>Customer</span>
        <strong>{customerOf(item)}</strong>
      </div>
      <div className="stp-overview__kv">
        <span>Batch</span>
        <strong>{batchOf(item) || '—'}</strong>
      </div>
      <div className="stp-overview__kv">
        <span>Queue position</span>
        <strong>{position}</strong>
      </div>
    </div>
  );
}

export default function LiveStatusPage({ onOpenRun, onGoOrders, millCode = 'A-59' }) {
  const live = useQuery({
    queryKey: ['live-status', millCode],
    queryFn: () => tubemillApi.getLiveStatus(millCode),
    refetchInterval: 5000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
  });

  const data = live.data ?? {};
  const summary = data.shiftSummary ?? {};
  const current = data.current ?? null;
  const upcoming = Array.isArray(data.upcoming) ? data.upcoming : [];
  const recentStoppages = Array.isArray(data.recentStoppages) ? data.recentStoppages : [];
  const next = upcoming[0] ?? null;
  const primeMt = Number(summary.primeMt ?? 0);
  const scrapMt = Number(summary.scrapMt ?? 0);
  const totalProdMt = primeMt + scrapMt;
  const runState = current?.run_state ?? current?.runState ?? null;
  const hold = (current?.hold_status ?? current?.holdStatus) === 'HELD';

  return (
    <div className="stp-overview live-status">
      <header className="stp-overview__page-head">
        <h1>Machine Overview</h1>
        <p className="muted">{millCode} · Live production status</p>
      </header>

      <section className="stp-overview__shift">
        <h2>Shift Summary</h2>
        <div className="stp-overview__kpis">
          <div className="stp-overview__kpi">
            <span>Total prod MT</span>
            <strong>{fmtMt(totalProdMt)}</strong>
          </div>
          <div className="stp-overview__kpi">
            <span>Completed MT</span>
            <strong>{fmtMt(primeMt)}</strong>
          </div>
          <div className="stp-overview__kpi">
            <span>Scrap MT</span>
            <strong>{fmtMt(scrapMt)}</strong>
          </div>
          <div className="stp-overview__kpi">
            <span>Runs today</span>
            <strong>{summary.runsToday ?? 0}</strong>
          </div>
          <div className="stp-overview__kpi">
            <span>In queue</span>
            <strong>{upcoming.length}</strong>
          </div>
          <div className="stp-overview__kpi">
            <span>Stoppage</span>
            <strong>{recentStoppages.length}</strong>
          </div>
        </div>
      </section>

      <div className="stp-overview__split">
        <section className="stp-overview__panel stp-overview__panel--primary">
          <header className="stp-overview__panel-head">
            <h2>Current Running Order</h2>
            {current ? (
              <ZBadge tone={statusTone(runState)} pulse={String(runState).toUpperCase() === 'RUNNING'}>
                {String(runState ?? 'DRAFT').replace(/_/g, ' ')}
              </ZBadge>
            ) : null}
          </header>

          {current ? (
            <div className="stp-overview__current">
              <div className="stp-overview__next-grid">
                <div className="stp-overview__kv">
                  <span>Run</span>
                  <strong className="mono">{current.run_no ?? current.runNo ?? '—'}</strong>
                </div>
                <div className="stp-overview__kv">
                  <span>Work order</span>
                  <strong className="mono">{woOf(current)}</strong>
                </div>
                <div className="stp-overview__kv">
                  <span>Grade</span>
                  <strong>{gradeOf(current)}</strong>
                </div>
                <div className="stp-overview__kv">
                  <span>Size</span>
                  <strong>{sizeOf(current) || '—'}</strong>
                </div>
              </div>
              {hold ? <ZBadge tone="pending">HOLD</ZBadge> : null}
              <div className="stp-overview__actions">
                <ZButton variant="primary" onClick={() => onOpenRun?.(current.id)}>
                  Open production form
                </ZButton>
              </div>
            </div>
          ) : (
            <div className="stp-overview__empty">
              <p className="stp-overview__empty-title">
                {next ? 'Order preparing — not started' : 'No running order'}
              </p>
              <p className="muted">
                {next
                  ? `${woOf(next)} is ready in queue (pos 1). Start production from Work Order to begin capture.`
                  : 'Select a work order from Work Order to prepare the next Tube Mill run.'}
              </p>
              <ZButton variant="primary" onClick={onGoOrders}>
                → Go to Work Order
              </ZButton>
            </div>
          )}
        </section>

        <section className="stp-overview__panel">
          <header className="stp-overview__panel-head">
            <h2>Upcoming Queue</h2>
            <span className="muted">
              {upcoming.length} {upcoming.length === 1 ? 'order' : 'orders'}
            </span>
          </header>

          {next ? (
            <div className="stp-overview__queue">
              <NextCard item={next} position={1} />
              <ul className="stp-overview__queue-list">
                {upcoming.map((u, idx) => (
                  <li key={u.id ?? `${woOf(u)}-${idx}`}>
                    <div className="stp-overview__queue-item stp-overview__queue-item--static">
                      <strong className="mono">{woOf(u)}</strong>
                      <span>
                        {gradeOf(u)}
                        {sizeOf(u) ? ` · ${sizeOf(u)}` : ''}
                      </span>
                      <em>Pos {idx + 1}</em>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="stp-overview__empty">
              <p className="muted">Queue is empty.</p>
            </div>
          )}
        </section>
      </div>

      {live.isError ? (
        <p className="banner banner--error">
          {live.error instanceof Error ? live.error.message : 'Live status failed'}
        </p>
      ) : null}
    </div>
  );
}
