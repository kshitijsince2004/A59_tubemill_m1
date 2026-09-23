import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { drawBenchApi } from '../../api/processApi';
import { ZBadge, ZButton, ZInput, ZSelect, statusTone } from '../../ui';
import SourceBadge, { DRAW_BENCH_FIELD_REGISTER, fieldSourceLabel } from './SourceBadge';

function sizeStr(lot) {
  const od = lot.finalOdMm ?? lot.finalSize?.odMm;
  const thk = lot.finalThMm ?? lot.finalSize?.thkMm;
  if (od != null && thk != null) return `${od} × ${thk}`;
  if (od != null) return `OD ${od}`;
  return '—';
}

function paramRows(lot) {
  const keys = [
    'workOrderNo',
    'gradeCode',
    'benchCode',
    'drawPass',
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
    workOrderNo: lot.workOrderNo,
    gradeCode: lot.gradeCode,
    benchCode: lot.benchCode,
    drawPass: lot.drawPass,
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
  return keys.map((k) => {
    const meta = DRAW_BENCH_FIELD_REGISTER[k];
    return {
      key: k,
      label: meta?.label ?? k,
      unit: meta?.unit ?? '',
      source: fieldSourceLabel(meta?.class),
      value: valueOf[k] ?? '—',
    };
  });
}

export default function DrawBenchHistory({ onOpenLot }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBench, setFilterBench] = useState('');
  const [filterWo, setFilterWo] = useState('');
  const [filterPass, setFilterPass] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const q = useMemo(() => {
    const o = {};
    if (filterStatus) o.status = filterStatus;
    if (filterBench) o.benchCode = filterBench;
    if (filterWo) o.workOrderNo = filterWo;
    if (filterPass) o.drawPass = filterPass;
    if (fromDate) o.fromDate = fromDate;
    if (toDate) o.toDate = toDate;
    return o;
  }, [filterStatus, filterBench, filterWo, filterPass, fromDate, toDate]);

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
    if (!filterStatus) {
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

  const dbMachines = machines.filter((m) => String(m.process_code) === 'DRW');

  return (
    <div className="db-history">
      <header className="db-history__head">
        <div>
          <h2>History</h2>
          <p className="muted">Completed and recorded draw-bench production</p>
        </div>
        <ZButton variant="ghost" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </ZButton>
      </header>

      <div className="db-history__filters filter-row">
        <ZInput placeholder="Search WO, customer, grade, operator…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ZInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
        <ZInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
        <ZInput placeholder="WO" value={filterWo} onChange={(e) => setFilterWo(e.target.value)} />
        <ZSelect value={filterBench} onChange={(e) => setFilterBench(e.target.value)}>
          <option value="">All benches</option>
          {dbMachines.map((m) => (
            <option key={m.machine_code} value={m.machine_code}>
              {m.label || m.machine_code}
            </option>
          ))}
        </ZSelect>
        <ZSelect value={filterPass} onChange={(e) => setFilterPass(e.target.value)}>
          <option value="">All passes</option>
          <option value="1ST">1ST</option>
          <option value="2ND">2ND</option>
          <option value="3RD">3RD</option>
        </ZSelect>
        <ZSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="HOLD">HOLD</option>
        </ZSelect>
      </div>

      <div className="db-history__table-wrap">
        <table className="db-history__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>WO</th>
              <th>Bench</th>
              <th>Customer</th>
              <th>Grade</th>
              <th>Final size</th>
              <th>Accepted</th>
              <th>Rejected</th>
              <th>Drawn m</th>
              <th>Operator</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                className={selectedId === l.id ? 'is-active' : ''}
                onClick={() => setSelectedId(l.id)}
              >
                <td>{l.prodDate ? String(l.prodDate).slice(0, 10) : '—'}</td>
                <td>{l.shiftRef || '—'}</td>
                <td>{l.workOrderNo || '—'}</td>
                <td>{l.benchCode || '—'}</td>
                <td>{l.customerName || l.customerCode || '—'}</td>
                <td>{l.gradeCode || '—'}</td>
                <td>{sizeStr(l)}</td>
                <td>{l.acceptedPcs ?? '—'}</td>
                <td>{l.rejectedPcs ?? '—'}</td>
                <td>{l.drawnMetre ?? '—'}</td>
                <td>{l.operatorRef || '—'}</td>
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
              <h3>{detail.lotNo}</h3>
              <p className="muted">
                {detail.workOrderNo} · {detail.benchCode} · {detail.drawPass}
              </p>
            </div>
            <div className="btn-row">
              <ZButton
                variant="ghost"
                onClick={() => {
                  onOpenLot?.(detail);
                }}
              >
                Open in Capture
              </ZButton>
              <ZButton variant="ghost" onClick={() => setSelectedId(null)}>
                Close
              </ZButton>
            </div>
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
                <dt>Stage</dt>
                <dd>{detail.stage || '—'}</dd>
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
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {paramRows(detail).map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.label} <SourceBadge fieldKey={r.key} />
                    </td>
                    <td>{r.value}</td>
                    <td>{r.unit || '—'}</td>
                    <td>{r.source}</td>
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
              {detail.createdBy ? ` by ${detail.createdBy}` : ''} · Status {detail.status}
            </p>
          </section>
        </aside>
      ) : null}
    </div>
  );
}
