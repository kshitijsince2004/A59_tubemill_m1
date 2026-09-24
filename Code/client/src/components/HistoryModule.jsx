import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tubemillApi } from '../api/tubemillClient';
import { ZBadge, ZButton, ZInput, ZSelect, statusTone } from '../ui';

function sizeStr(run) {
  if (run?.sizeKey) return run.sizeKey;
  const size = run?.size;
  if (!size) return '—';
  const od = size.odMm ?? size.od;
  const thk = size.thkMm ?? size.thk;
  if (od != null && thk != null) return `${od} × ${thk}`;
  if (od != null) return `OD ${od}`;
  return '—';
}

function dateStr(run) {
  const raw = run?.timeFrom || run?.createdAt || run?.prodDate;
  if (!raw) return '—';
  return String(raw).slice(0, 10);
}

function fmtMt(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : String(v);
}

function fmtPct(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(v);
}

function displayOrDash(v) {
  if (v == null || v === '') return '—';
  return v;
}

function fmtHour(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

const COMPLETED_STATUSES = ['SUBMITTED', 'APPROVED', 'LOCKED', 'Completed'];

const TABS = [
  { id: 'production', label: 'Production' },
  { id: 'setups', label: 'Setups' },
  { id: 'readings', label: 'Readings' },
];

/**
 * History — tabular Production / Setups / Readings (mill-scoped).
 * Visual pattern aligned with Furnace / Draw Bench history tables.
 */
export default function HistoryModule({ millCode = 'A-59', onOpenRun }) {
  const [tab, setTab] = useState('production');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWo, setFilterWo] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSetupId, setSelectedSetupId] = useState(null);

  const { data: history = [], isFetching, refetch } = useQuery({
    queryKey: ['runs-history', millCode],
    queryFn: () => tubemillApi.listRuns(millCode, 100),
    enabled: tab === 'production',
  });

  const { data: setups = [], isFetching: setupsFetching, refetch: refetchSetups } = useQuery({
    queryKey: ['mill-setups-history', millCode],
    queryFn: () => tubemillApi.listMillSetups(millCode),
    enabled: tab === 'setups',
  });

  const { data: readings = [], isFetching: readingsFetching, refetch: refetchReadings } =
    useQuery({
      queryKey: ['mill-param-readings-history', millCode],
      queryFn: () => tubemillApi.listMillParams(millCode),
      enabled: tab === 'readings',
    });

  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ['run', selectedId],
    queryFn: () => tubemillApi.getRun(selectedId),
    enabled: !!selectedId && tab === 'production',
  });

  const { data: setupDetail } = useQuery({
    queryKey: ['mill-setup', selectedSetupId],
    queryFn: () => tubemillApi.getMillSetup(selectedSetupId),
    enabled: !!selectedSetupId && tab === 'setups',
  });

  const filtered = useMemo(() => {
    let rows = history;
    if (!filterStatus) {
      const completed = rows.filter(
        (h) =>
          COMPLETED_STATUSES.includes(h.status) || h.runState === 'RUN_COMPLETE'
      );
      rows = completed.length ? completed : rows;
    } else {
      rows = rows.filter(
        (h) =>
          String(h.status) === filterStatus ||
          (filterStatus === 'RUN_COMPLETE' && h.runState === 'RUN_COMPLETE')
      );
    }
    if (filterWo.trim()) {
      const wo = filterWo.trim().toLowerCase();
      rows = rows.filter((h) => String(h.workOrderNo ?? '').toLowerCase().includes(wo));
    }
    if (fromDate) {
      rows = rows.filter((h) => dateStr(h) >= fromDate);
    }
    if (toDate) {
      rows = rows.filter((h) => {
        const d = dateStr(h);
        return d !== '—' && d <= toDate;
      });
    }
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((h) => {
      const hay = [
        h.runNo,
        h.workOrderNo,
        h.customerCode,
        h.gradeCode,
        h.bcBatchNumber,
        h.sizeKey,
        h.millCode,
        h.status,
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return hay.includes(term);
    });
  }, [history, search, filterStatus, filterWo, fromDate, toDate]);

  const filteredSetups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return setups;
    return setups.filter((s) => {
      const hay = [s.note, s.sizeKey, s.gradeCode, s.idTool, s.odTool]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [setups, search]);

  const filteredReadings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return readings;
    return readings.filter((r) => {
      const hay = [r.ts_hour, r.sign_ref, r.remarks, r.source]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [readings, search]);

  function refresh() {
    if (tab === 'production') void refetch();
    else if (tab === 'setups') void refetchSetups();
    else void refetchReadings();
  }

  const fetching =
    tab === 'production' ? isFetching : tab === 'setups' ? setupsFetching : readingsFetching;

  return (
    <div className="tm-history">
      <header className="furnace-history__header tm-history__head">
        <div>
          <h2>History</h2>
          <p className="muted">Recorded Tube Mill production for {millCode}</p>
        </div>
        <ZButton variant="ghost" disabled={fetching} onClick={refresh}>
          {fetching ? 'Refreshing…' : 'Refresh'}
        </ZButton>
      </header>

      <div className="tm-history__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tm-history__tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setSelectedId(null);
              setSelectedSetupId(null);
              setSearch('');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="furnace-history__toolbar">
        <label className="furnace-history__field furnace-history__field--grow">
          <span>Search</span>
          <ZInput
            placeholder={
              tab === 'production'
                ? 'WO, customer, grade, run…'
                : tab === 'setups'
                  ? 'Setup name, size, tool…'
                  : 'Readings, sign, remarks…'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {tab === 'production' ? (
          <>
            <label className="furnace-history__field">
              <span>From</span>
              <ZInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="furnace-history__field">
              <span>To</span>
              <ZInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <label className="furnace-history__field">
              <span>WO</span>
              <ZInput
                placeholder="Filter WO"
                value={filterWo}
                onChange={(e) => setFilterWo(e.target.value)}
              />
            </label>
            <label className="furnace-history__field">
              <span>Status</span>
              <ZSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Completed (default)</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="LOCKED">LOCKED</option>
                <option value="RUN_COMPLETE">RUN_COMPLETE</option>
              </ZSelect>
            </label>
          </>
        ) : null}
      </div>

      {tab === 'production' ? (
        <>
          <div className="furnace-history__table-wrap tm-history__table-wrap">
            <table className="furnace-hist-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Run</th>
                  <th>WO</th>
                  <th>Customer</th>
                  <th>Grade</th>
                  <th>Size</th>
                  <th>Batch</th>
                  <th>Prime MT</th>
                  <th>Scrap MT</th>
                  <th>Yield %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr
                    key={h.id}
                    className={`furnace-hist-table__row${selectedId === h.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(h.id)}
                  >
                    <td>{dateStr(h)}</td>
                    <td className="font-mono">{h.runNo || '—'}</td>
                    <td className="font-mono">{h.workOrderNo || '—'}</td>
                    <td>{h.customerCode || '—'}</td>
                    <td>{h.gradeCode || '—'}</td>
                    <td>{sizeStr(h)}</td>
                    <td className="font-mono">{h.bcBatchNumber || '—'}</td>
                    <td className="font-mono">{fmtMt(h.totalPrimeMt)}</td>
                    <td className="font-mono">{fmtMt(h.totalScrapMt)}</td>
                    <td className="font-mono">{fmtPct(h.yieldPct)}</td>
                    <td>
                      <ZBadge tone={statusTone(String(h.status))}>{String(h.status)}</ZBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? (
              <p className="empty-hint">No production history for these filters.</p>
            ) : null}
          </div>

          {selectedId ? (
            <aside className="tm-history__drawer" role="dialog" aria-label="Production record">
              {detailLoading && !detail ? (
                <p className="muted">Loading run…</p>
              ) : detail ? (
                <>
                  <header className="tm-history__drawer-head">
                    <div>
                      <h3 className="font-mono">{detail.workOrderNo || detail.runNo}</h3>
                      <p className="muted">
                        Run {detail.runNo} · {detail.millCode ?? millCode} · {detail.runState}
                      </p>
                    </div>
                    <div className="btn-row">
                      <ZBadge tone={statusTone(String(detail.status))}>
                        {String(detail.status)}
                      </ZBadge>
                      <ZButton
                        variant="ghost"
                        onClick={() => {
                          onOpenRun?.(detail);
                        }}
                      >
                        Open work order
                      </ZButton>
                      <ZButton variant="ghost" onClick={() => setSelectedId(null)}>
                        Close
                      </ZButton>
                    </div>
                  </header>

                  <section>
                    <h4>Work order</h4>
                    <dl className="tm-history__grid">
                      <div>
                        <dt>Customer</dt>
                        <dd>{detail.customerCode || '—'}</dd>
                      </div>
                      <div>
                        <dt>Grade</dt>
                        <dd>{detail.gradeCode || '—'}</dd>
                      </div>
                      <div>
                        <dt>Batch</dt>
                        <dd>{detail.bcBatchNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt>Size</dt>
                        <dd>{sizeStr(detail)}</dd>
                      </div>
                      <div>
                        <dt>Date</dt>
                        <dd>
                          {dateStr(detail)}
                          {detail.timeFrom ? ` · ${String(detail.timeFrom).slice(11, 16)}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>
                          {detail.status} · {detail.runState}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h4>Production</h4>
                    <dl className="tm-history__grid">
                      <div>
                        <dt>Prime</dt>
                        <dd>
                          {displayOrDash(detail.production?.primeNo)} pcs
                          {detail.totalPrimeMt != null
                            ? ` · ${fmtMt(detail.totalPrimeMt)} MT`
                            : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Scrap</dt>
                        <dd>
                          {fmtMt(detail.production?.scrapWtMt ?? detail.totalScrapMt)} MT
                        </dd>
                      </div>
                      <div>
                        <dt>Yield</dt>
                        <dd>{fmtPct(detail.yieldPct)}</dd>
                      </div>
                      <div>
                        <dt>Hold</dt>
                        <dd>{detail.holdStatus || '—'}</dd>
                      </div>
                    </dl>
                  </section>

                  {detail.tooling ? (
                    <section>
                      <h4>Tooling (from chart / run)</h4>
                      <dl className="tm-history__grid">
                        <div>
                          <dt>ID / OD tool</dt>
                          <dd>
                            {detail.tooling.idTool || '—'} / {detail.tooling.odTool || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>Work coil</dt>
                          <dd>{detail.tooling.workCoilId || '—'}</dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}
                </>
              ) : (
                <p className="muted">Could not load run detail.</p>
              )}
            </aside>
          ) : null}
        </>
      ) : null}

      {tab === 'setups' ? (
        <>
          <div className="furnace-history__table-wrap tm-history__table-wrap">
            <table className="furnace-hist-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Grade</th>
                  <th>ID tool</th>
                  <th>OD tool</th>
                  <th>Work coil</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredSetups.map((s) => (
                  <tr
                    key={s.id}
                    className={`furnace-hist-table__row${selectedSetupId === s.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedSetupId(s.id)}
                  >
                    <td className="font-mono">
                      {s.note ||
                        [s.sizeKey, s.gradeCode].filter(Boolean).join(' · ') ||
                        '—'}
                    </td>
                    <td>
                      {(s.sizeKey ?? '—') + (s.thkMm != null ? ` · ${s.thkMm}` : '')}
                    </td>
                    <td>{s.gradeCode ?? '—'}</td>
                    <td className="font-mono">{s.idTool || '—'}</td>
                    <td className="font-mono">{s.odTool || '—'}</td>
                    <td className="font-mono">{s.workCoilId || '—'}</td>
                    <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredSetups.length ? (
              <p className="empty-hint">No setup sheets yet.</p>
            ) : null}
          </div>
          {selectedSetupId && setupDetail ? (
            <aside className="tm-history__drawer" role="dialog" aria-label="Setup detail">
              <header className="tm-history__drawer-head">
                <div>
                  <h3>{setupDetail.note || 'Setup sheet'}</h3>
                  <p className="muted">
                    {setupDetail.sizeKey} / {setupDetail.gradeCode}
                  </p>
                </div>
                <ZButton variant="ghost" onClick={() => setSelectedSetupId(null)}>
                  Close
                </ZButton>
              </header>
              <dl className="tm-history__grid">
                <div>
                  <dt>ID Tool</dt>
                  <dd>{setupDetail.idTool || '—'}</dd>
                </div>
                <div>
                  <dt>OD Tool</dt>
                  <dd>{setupDetail.odTool || '—'}</dd>
                </div>
                <div>
                  <dt>Work coil</dt>
                  <dd>{setupDetail.workCoilId || '—'}</dd>
                </div>
                <div>
                  <dt>Impeder</dt>
                  <dd>{setupDetail.impederSize || '—'}</dd>
                </div>
                <div>
                  <dt>Coolant %</dt>
                  <dd>{setupDetail.coolantConcPct ?? '—'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>
                    {setupDetail.createdAt
                      ? new Date(setupDetail.createdAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
              </dl>
            </aside>
          ) : null}
        </>
      ) : null}

      {tab === 'readings' ? (
        <div className="furnace-history__table-wrap tm-history__table-wrap">
          <table className="furnace-hist-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Speed</th>
                <th>Power</th>
                <th>Coolant %</th>
                <th>Wiper</th>
                <th>Sign</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredReadings.map((r) => (
                <tr key={r.id ?? r.ts_hour} className="furnace-hist-table__row">
                  <td className="font-mono">{fmtHour(r.ts_hour)}</td>
                  <td className="font-mono">{displayOrDash(r.line_speed_mpm)}</td>
                  <td className="font-mono">{displayOrDash(r.weld_power_kw)}</td>
                  <td className="font-mono">{displayOrDash(r.coolant_oil_pct)}</td>
                  <td>{r.wiper_change == null ? '—' : r.wiper_change ? 'Y' : 'N'}</td>
                  <td>{displayOrDash(r.sign_ref)}</td>
                  <td>{displayOrDash(r.remarks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredReadings.length ? (
            <p className="empty-hint">No parameter readings yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
