import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { drawBenchApi } from '../../api/processApi';
import { ZBadge, ZButton, ZFilterPills, ZInput, ZSelect, statusTone } from '../../ui';
import { DRAW_BENCH_FIELD_REGISTER } from './SourceBadge';

const STATUS_PILLS = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SUBMITTED', label: 'Submitted' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'HOLD', label: 'Hold' },
];

function sizeStr(lot) {
  const od = lot.finalOdMm ?? lot.finalSize?.odMm;
  const thk = lot.finalThMm ?? lot.finalSize?.thkMm;
  if (od != null && thk != null) return `${od} × ${thk}`;
  if (od != null) return `OD ${od}`;
  return '—';
}

/** Capture params only — identity fields already shown in drawer header. */
function paramRows(lot) {
  const keys = [
    'finalOd',
    'fromOd',
    'toOd',
    'drawPlanLenMm',
    'acceptedPcs',
    'rejectedPcs',
    'drawnMetre',
    'pullLoadT',
    'cycleTimeS',
  ];
  const valueOf = {
    finalOd: lot.finalOdMm,
    fromOd: lot.fromOdMm,
    toOd: lot.toOdMm,
    drawPlanLenMm: lot.drawPlanLenMm,
    acceptedPcs: lot.acceptedPcs,
    rejectedPcs: lot.rejectedPcs,
    drawnMetre: lot.drawnMetre,
    pullLoadT: lot.pullLoadT,
    cycleTimeS: lot.cycleTimeS,
  };
  return keys
    .map((k) => {
      const meta = DRAW_BENCH_FIELD_REGISTER[k];
      const value = valueOf[k];
      return {
        key: k,
        label: meta?.label ?? k,
        unit: meta?.unit ?? '',
        value: value ?? '—',
        empty: value == null || value === '',
      };
    })
    .filter((r) => !r.empty || ['acceptedPcs', 'rejectedPcs', 'drawnMetre', 'drawPlanLenMm'].includes(r.key));
}

export default function DrawBenchHistory({ onOpenLot }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterBench, setFilterBench] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const q = useMemo(() => {
    const o = {};
    if (filterStatus && filterStatus !== 'ALL') o.status = filterStatus;
    if (filterBench) o.benchCode = filterBench;
    if (fromDate) o.fromDate = fromDate;
    if (toDate) o.toDate = toDate;
    return o;
  }, [filterStatus, filterBench, fromDate, toDate]);

  const { data: lots = [], isFetching, refetch } = useQuery({
    queryKey: ['drw-lots', 'history', q],
    queryFn: () => drawBenchApi.listLots(q),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['drw-machines'],
    queryFn: () => drawBenchApi.machines(),
  });

  const { data: detail } = useQuery({
    queryKey: ['drw-lot', selectedId],
    queryFn: () => drawBenchApi.getLot(selectedId),
    enabled: !!selectedId,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = lots;
    if (filterStatus === 'ALL') {
      rows = rows.filter((l) => ['SUBMITTED', 'APPROVED', 'DRAFT', 'HOLD'].includes(String(l.status)));
    }
    if (!term) return rows;
    return rows.filter((l) => {
      const hay = [l.lotNo, l.workOrderNo, l.customerCode, l.customerName, l.gradeCode, l.benchCode, l.operatorRef]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return hay.includes(term);
    });
  }, [lots, search, filterStatus]);

  const statusCounts = useMemo(() => {
    const base = lots.filter((l) => ['SUBMITTED', 'APPROVED', 'DRAFT', 'HOLD'].includes(String(l.status)));
    const c = { ALL: base.length };
    for (const l of base) {
      const s = String(l.status);
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [lots]);

  const pills = STATUS_PILLS.map((p) => ({
    ...p,
    count: statusCounts[p.id] ?? 0,
  }));

  const dbMachines = machines.filter(
    (m) => String(m.process_code) === 'DRW' && String(m.machine_code).startsWith('DB')
  );

  return (
    <div className="db-history">
      <header className="furnace-history__header db-history__head">
        <div>
          <h2>History</h2>
          <p className="muted">Recorded Draw Bench production</p>
        </div>
        <ZButton variant="ghost" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </ZButton>
      </header>

      <ZFilterPills
        pills={pills}
        value={filterStatus}
        onChange={setFilterStatus}
      />

      <div className="furnace-history__toolbar">
        <label className="furnace-history__field furnace-history__field--grow">
          <span>Search</span>
          <ZInput
            placeholder="WO, customer, grade, operator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="furnace-history__field">
          <span>From</span>
          <ZInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="furnace-history__field">
          <span>To</span>
          <ZInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <label className="furnace-history__field">
          <span>Bench</span>
          <ZSelect value={filterBench} onChange={(e) => setFilterBench(e.target.value)}>
            <option value="">All benches</option>
            {dbMachines.map((m) => (
              <option key={m.machine_code} value={m.machine_code}>
                {m.label || m.machine_code}
              </option>
            ))}
          </ZSelect>
        </label>
      </div>

      <div className="furnace-history__table-wrap db-history__table-wrap">
        <table className="furnace-hist-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>WO</th>
              <th>Bench</th>
              <th>Customer</th>
              <th>Grade</th>
              <th>Size</th>
              <th>Accepted</th>
              <th>Rejected</th>
              <th>Drawn m</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                className={`furnace-hist-table__row${selectedId === l.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(l.id)}
              >
                <td>{l.prodDate ? String(l.prodDate).slice(0, 10) : '—'}</td>
                <td>{l.shiftRef || '—'}</td>
                <td className="font-mono">{l.workOrderNo || '—'}</td>
                <td className="font-mono">{l.benchCode || '—'}</td>
                <td>{l.customerName || l.customerCode || '—'}</td>
                <td>{l.gradeCode || '—'}</td>
                <td>{sizeStr(l)}</td>
                <td>{l.acceptedPcs ?? '—'}</td>
                <td>{l.rejectedPcs ?? '—'}</td>
                <td>{l.drawnMetre ?? '—'}</td>
                <td>
                  <ZBadge tone={statusTone(String(l.status))}>{String(l.status)}</ZBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? <p className="empty-hint">No production history for these filters.</p> : null}
      </div>

      {detail ? (
        <aside className="db-history__drawer" role="dialog" aria-label="Production record">
          <header className="db-history__drawer-head">
            <div>
              <h3 className="font-mono">{detail.workOrderNo || detail.lotNo}</h3>
              <p className="muted">
                {detail.benchCode}
                {detail.drawPass ? ` · ${detail.drawPass}` : ''}
                {detail.lotNo ? ` · ${detail.lotNo}` : ''}
              </p>
            </div>
            <ZBadge tone={statusTone(String(detail.status))}>{String(detail.status)}</ZBadge>
          </header>

          <section>
            <h4>Work order</h4>
            <dl className="db-wo-hub__grid">
              <div>
                <dt>Customer</dt>
                <dd>{detail.customerName || detail.customerCode || '—'}</dd>
              </div>
              <div>
                <dt>Grade</dt>
                <dd>{detail.gradeCode || '—'}</dd>
              </div>
              <div>
                <dt>Shift / date</dt>
                <dd>
                  {detail.shiftRef || '—'} · {detail.prodDate ? String(detail.prodDate).slice(0, 10) : '—'}
                </dd>
              </div>
              <div>
                <dt>Operator</dt>
                <dd>{detail.operatorRef || '—'}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{detail.stage || '—'}</dd>
              </div>
              <div>
                <dt>Final size</dt>
                <dd>{sizeStr(detail)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h4>Production</h4>
            <dl className="db-wo-hub__grid">
              <div>
                <dt>Planned Nos</dt>
                <dd>{detail.inputNos ?? '—'}</dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd>
                  {detail.acceptedPcs ?? '—'} pcs
                  {detail.acceptedMt != null ? ` · ${detail.acceptedMt} MT` : ''}
                </dd>
              </div>
              <div>
                <dt>Rejected</dt>
                <dd>{detail.rejectedPcs ?? '—'}</dd>
              </div>
              <div>
                <dt>Drawn meter</dt>
                <dd>{detail.drawnMetre ?? '—'}</dd>
              </div>
              <div>
                <dt>Draw plan len</dt>
                <dd>{detail.drawPlanLenMm != null ? `${detail.drawPlanLenMm} mm` : '—'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h4>Parameters</h4>
            <table className="db-history__params">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {paramRows(detail).map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{r.value}</td>
                    <td>{r.unit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {detail.breakdownRemark ? (
            <section>
              <h4>Breakdown</h4>
              <p>{detail.breakdownRemark}</p>
            </section>
          ) : null}

          {detail.remarks ? (
            <section>
              <h4>Remarks</h4>
              <p>{detail.remarks}</p>
            </section>
          ) : null}

          <section>
            <h4>Audit</h4>
            <p className="muted">
              Created {detail.createdAt ? String(detail.createdAt) : '—'}
              {detail.createdBy ? ` by ${detail.createdBy}` : ''}
              {detail.productionStartedAt
                ? ` · Started ${String(detail.productionStartedAt)}`
                : ''}
              {detail.productionEndedAt ? ` · Ended ${String(detail.productionEndedAt)}` : ''}
            </p>
          </section>

          <div className="db-history__drawer-footer btn-row">
            {detail.status === 'DRAFT' || detail.status === 'HOLD' ? (
              <ZButton
                variant="primary"
                onClick={() => {
                  onOpenLot?.(detail);
                }}
              >
                Resume in Capture
              </ZButton>
            ) : (
              <ZButton
                variant="ghost"
                onClick={() => {
                  onOpenLot?.(detail);
                }}
              >
                View in Capture
              </ZButton>
            )}
            <ZButton variant="ghost" onClick={() => setSelectedId(null)}>
              Close
            </ZButton>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
