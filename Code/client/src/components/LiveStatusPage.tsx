import { useQuery } from '@tanstack/react-query';
import { ZBadge, ZButton } from '../ui';
import { tubemillApi } from '../api/tubemillClient';

export default function LiveStatusPage({ onOpenRun }: { onOpenRun: (runId: string) => void }) {
  const live = useQuery({
    queryKey: ['live-status'],
    queryFn: () => tubemillApi.getLiveStatus(),
    refetchInterval: 5000,
  });

  const data = live.data as {
    current?: { id: string; run_no: string; run_state: string; work_order_no?: string; hold_status?: string };
    upcoming?: { id: string; work_order_no: string; grade_code: string; size_key: string }[];
    recentStoppages?: { id: string; stoppage_code?: string; from_time: string; reason?: string }[];
    shiftSummary?: { primeMt: number; scrapMt: number; runsToday: number };
  } | undefined;

  return (
    <div className="live-status">
      <header className="page-header">
        <div>
          <div className="eyebrow">A-59</div>
          <h1>Live production status</h1>
        </div>
      </header>
      <section className="metric-grid">
        <div className="metric-cell">
          <span className="eyebrow">Prime MT today</span>
          <strong className="mono">{data?.shiftSummary?.primeMt?.toFixed(3) ?? '—'}</strong>
        </div>
        <div className="metric-cell">
          <span className="eyebrow">Scrap MT</span>
          <strong className="mono">{data?.shiftSummary?.scrapMt?.toFixed(3) ?? '—'}</strong>
        </div>
        <div className="metric-cell">
          <span className="eyebrow">Runs today</span>
          <strong className="mono">{data?.shiftSummary?.runsToday ?? '—'}</strong>
        </div>
      </section>
      <div className="two-up">
        <section className="panel panel--primary-header">
          <header className="panel__header panel__header--primary">
            <span className="eyebrow">Current running order</span>
            {data?.current && <ZBadge tone="running">{data.current.run_state}</ZBadge>}
          </header>
          {data?.current ? (
            <div className="panel__body">
              <div className="metric-cell">
                <span className="eyebrow">Run</span>
                <strong className="mono">{data.current.run_no}</strong>
              </div>
              <div className="metric-cell">
                <span className="eyebrow">WO</span>
                <strong className="mono">{data.current.work_order_no ?? '—'}</strong>
              </div>
              {data.current.hold_status === 'HELD' && <ZBadge tone="pending">HOLD</ZBadge>}
              <ZButton variant="primary" onClick={() => onOpenRun(data.current!.id)}>
                Open production form
              </ZButton>
            </div>
          ) : (
            <p className="muted">No draft run — go to Orders</p>
          )}
        </section>
        <section className="panel">
          <header className="panel__header">
            <span className="eyebrow">Upcoming queue</span>
            <ZBadge tone="idle">{String(data?.upcoming?.length ?? 0)}</ZBadge>
          </header>
          <ul className="panel__list">
            {(data?.upcoming ?? []).map((u) => (
              <li key={u.id} className="mono">
                {u.work_order_no} · {u.grade_code} · {u.size_key}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">Stoppage history</span>
        </header>
        <ul className="panel__list">
          {(data?.recentStoppages ?? []).map((s) => (
            <li key={s.id}>
              <span className="mono">{s.stoppage_code ?? 'UNC'}</span> · {s.reason ?? '—'} ·{' '}
              {new Date(s.from_time).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
