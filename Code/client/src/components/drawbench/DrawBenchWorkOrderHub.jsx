import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { erpApi } from '../../api/erpApi';
import { drawBenchApi } from '../../api/processApi';
import { ZBadge, ZButton, ZFilterPills, ZInput, statusTone } from '../../ui';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'ON_HOLD', label: 'On Hold' },
];

function parseSize(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function sizeLabel(size) {
  const s = parseSize(size);
  const parts = [];
  if (s.odMm != null) parts.push(`${s.odMm}`);
  if (s.thkMm != null) parts.push(`${s.thkMm}`);
  if (parts.length === 2) return `${parts[0]} > ${parts[1]} mm`;
  if (s.odMm != null) return `OD ${s.odMm} mm`;
  return '—';
}

function sizeDetail(size) {
  const s = parseSize(size);
  return {
    od: s.odMm ?? null,
    id: s.idMm ?? null,
    thk: s.thkMm ?? null,
    len: s.lengthMm ?? null,
  };
}

function lotActivity(lot) {
  if (!lot) return false;
  return (
    lot.acceptedPcs != null ||
    lot.rejectedPcs != null ||
    lot.drawnMetre != null ||
    lot.operatorRef ||
    (lot.fromOdMm != null && lot.toOdMm != null)
  );
}

/** Map ERP order + open lots → UI status pill. */
export function deriveWoUiStatus(order, lotsForWo = []) {
  const status = String(order?.status ?? '').toLowerCase();
  if (status.includes('hold')) return 'ON_HOLD';
  if (lotsForWo.some((l) => l.status === 'HOLD')) return 'ON_HOLD';
  if (lotsForWo.some((l) => l.status === 'SUBMITTED' || l.status === 'APPROVED')) return 'COMPLETED';
  const open = lotsForWo.filter((l) => l.status === 'DRAFT' || l.status === 'HOLD');
  if (open.some((l) => lotActivity(l))) return 'IN_PROGRESS';
  if (open.length) return 'PREPARING';
  return 'PENDING';
}

function nowLabel() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function DrawBenchWorkOrderHub({ onMoveToProduction, isWritable = true }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedWo, setSelectedWo] = useState(null);
  const [benchOverride, setBenchOverride] = useState('');
  const [drawPass, setDrawPass] = useState('1ST');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asOf, setAsOf] = useState(nowLabel);
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: orders = [], isFetching, refetch, error: ordersErr } = useQuery({
    queryKey: ['erp-orders', 'Released'],
    queryFn: () => erpApi.orders('Released'),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ['drw-lots', 'wo-hub'],
    queryFn: () => drawBenchApi.listLots({}),
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['drw-machines'],
    queryFn: () => drawBenchApi.machines(),
  });

  const lotsByWo = useMemo(() => {
    const map = new Map();
    for (const lot of lots) {
      const wo = String(lot.workOrderNo ?? '');
      if (!wo) continue;
      if (!map.has(wo)) map.set(wo, []);
      map.get(wo).push(lot);
    }
    return map;
  }, [lots]);

  const enriched = useMemo(() => {
    return orders.map((o) => {
      const wo = String(o.workOrderNo ?? '');
      const woLots = lotsByWo.get(wo) ?? [];
      const uiStatus = deriveWoUiStatus(o, woLots);
      const activeLot = woLots.find((l) => l.status === 'DRAFT') ?? woLots[0] ?? null;
      return { ...o, uiStatus, lots: woLots, activeLot };
    });
  }, [orders, lotsByWo]);

  const selected = useMemo(
    () => enriched.find((o) => String(o.workOrderNo) === String(selectedWo)) ?? null,
    [enriched, selectedWo]
  );

  const size = selected ? sizeDetail(selected.size) : null;

  const { data: suggest } = useQuery({
    queryKey: ['drw-suggest-wo', size?.od, size?.thk],
    queryFn: () => drawBenchApi.suggestBench({ od: size?.od, thk: size?.thk }),
    enabled: !!(selected && (size?.od || size?.thk)),
  });

  const suggestedBench = suggest?.suggested?.benchCode ?? '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((o) => {
      if (filter !== 'ALL' && o.uiStatus !== filter) return false;
      if (!q) return true;
      const hay = [
        o.workOrderNo,
        o.lotNo,
        o.customerCode,
        o.gradeCode,
        o.millCode,
        sizeLabel(o.size),
        o.activeLot?.benchCode,
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [enriched, filter, search]);

  const counts = useMemo(() => {
    const c = { ALL: enriched.length };
    for (const o of enriched) {
      c[o.uiStatus] = (c[o.uiStatus] ?? 0) + 1;
    }
    return c;
  }, [enriched]);

  const pills = FILTERS.map((p) => ({
    ...p,
    count: p.id === 'ALL' ? counts.ALL : counts[p.id] ?? 0,
  }));

  const backlogCount = counts.PENDING ?? 0;

  async function refresh() {
    setAsOf(nowLabel());
    await refetch();
    await qc.invalidateQueries({ queryKey: ['drw-lots'] });
  }

  async function moveToProduction() {
    if (!selected?.workOrderNo) return;
    const benchCode = benchOverride || suggestedBench || selected.activeLot?.benchCode;
    if (!benchCode) {
      setErr('Select a draw bench (or wait for Table-C suggestion)');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const lot = await drawBenchApi.assign(benchCode, {
        workOrderNo: selected.workOrderNo,
        drawPass,
        customerCode: selected.customerCode || undefined,
        gradeCode: selected.gradeCode || undefined,
        size: parseSize(selected.size),
        inputNos: selected.qtyPieces ?? undefined,
      });
      await qc.invalidateQueries({ queryKey: ['drw-board'] });
      await qc.invalidateQueries({ queryKey: ['drw-lots'] });
      onMoveToProduction?.(lot, benchCode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Move to production failed');
    } finally {
      setBusy(false);
    }
  }

  const dbMachines = machines.filter((m) => String(m.process_code) === 'DRW' && String(m.machine_code).startsWith('DB'));

  return (
    <div className="db-wo-hub">
      <header className="db-wo-hub__header">
        <div>
          <p className="db-wo-hub__eyebrow">Machine</p>
          <h1 className="db-wo-hub__title">Draw Bench</h1>
        </div>
        <div className="db-wo-hub__header-actions">
          <ZInput type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} aria-label="Date" />
          <ZButton variant="ghost" disabled={isFetching} onClick={() => void refresh()}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </ZButton>
          <span className="muted">as of {asOf}</span>
        </div>
      </header>

      <div className="db-wo-hub__search">
        <ZInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search work order, customer, batch, grade…"
        />
      </div>

      <ZFilterPills pills={pills} value={filter} onChange={setFilter} />

      {ordersErr ? (
        <p className="banner banner--error">{ordersErr instanceof Error ? ordersErr.message : 'Orders failed'}</p>
      ) : null}

      <div className="db-wo-hub__layout">
        <div className="db-wo-hub__list">
          <div className="db-wo-hub__backlog">BACKLOG · {backlogCount}</div>
          <p className="db-wo-hub__queue-label">Draw Bench Queue · {filtered.length} orders</p>
          {filtered.map((o) => {
            const wo = String(o.workOrderNo ?? '');
            const active = selectedWo === wo;
            return (
              <button
                key={wo}
                type="button"
                className={`db-wo-card${active ? ' db-wo-card--active' : ''}`}
                onClick={() => {
                  setSelectedWo(wo);
                  setBenchOverride('');
                  setErr('');
                }}
              >
                <div className="db-wo-card__top">
                  <strong>{wo}</strong>
                  <span className="muted">BATCH {String(o.lotNo ?? '—')}</span>
                </div>
                <div className="db-wo-card__cust">{String(o.customerCode ?? '—')}</div>
                <div className="db-wo-card__meta">
                  <span>Grade {String(o.gradeCode ?? '—')}</span>
                  <span>{sizeLabel(o.size)}</span>
                  <span>{o.plannedQty != null ? `${o.plannedQty} MT` : o.qtyPieces != null ? `${o.qtyPieces} pcs` : '—'}</span>
                </div>
                <div className="db-wo-card__badges">
                  <ZBadge tone={o.uiStatus === 'PENDING' ? 'pending' : statusTone(o.uiStatus)}>{o.uiStatus.replace(/_/g, ' ')}</ZBadge>
                  {o.activeLot?.benchCode ? <ZBadge tone="info">{o.activeLot.benchCode}</ZBadge> : <ZBadge tone="idle">Unassigned</ZBadge>}
                </div>
              </button>
            );
          })}
          {!filtered.length ? <p className="empty-hint">No work orders match this filter.</p> : null}
        </div>

        <aside className="db-wo-hub__detail">
          {selected ? (
            <>
              <header className="db-wo-hub__detail-head">
                <div>
                  <h2>{String(selected.workOrderNo)}</h2>
                  <p className="muted">BATCH {String(selected.lotNo ?? '—')}</p>
                </div>
                <ZBadge tone={statusTone(selected.uiStatus)}>{selected.uiStatus.replace(/_/g, ' ')}</ZBadge>
              </header>

              <dl className="db-wo-hub__grid">
                <div>
                  <dt>Customer</dt>
                  <dd>{String(selected.customerCode ?? '—')}</dd>
                </div>
                <div>
                  <dt>Grade</dt>
                  <dd>{String(selected.gradeCode ?? '—')}</dd>
                </div>
                <div>
                  <dt>Mill</dt>
                  <dd>{String(selected.millCode ?? '—')}</dd>
                </div>
                <div>
                  <dt>Assigned bench</dt>
                  <dd>
                    {selected.activeLot?.benchCode
                      ? selected.activeLot.benchCode
                      : suggestedBench
                        ? `Unassigned · hint ${suggestedBench}`
                        : 'Unassigned'}
                  </dd>
                </div>
                <div>
                  <dt>OD</dt>
                  <dd>{size?.od != null ? `${size.od} mm` : '—'}</dd>
                </div>
                <div>
                  <dt>ID</dt>
                  <dd>{size?.id != null ? `${size.id} mm` : '—'}</dd>
                </div>
                <div>
                  <dt>Thickness</dt>
                  <dd>{size?.thk != null ? `${size.thk} mm` : '—'}</dd>
                </div>
                <div>
                  <dt>Length</dt>
                  <dd>{size?.len != null ? `${size.len} mm` : '—'}</dd>
                </div>
                <div>
                  <dt>Planned qty</dt>
                  <dd>
                    {selected.qtyPieces != null ? `${selected.qtyPieces} pcs` : '—'}
                    {selected.plannedQty != null ? ` · ${selected.plannedQty} MT` : ''}
                  </dd>
                </div>
                <div>
                  <dt>ERP status</dt>
                  <dd>{String(selected.status ?? '—')}</dd>
                </div>
              </dl>

              <div className="db-wo-hub__load">
                <label>
                  Draw pass
                  <select value={drawPass} onChange={(e) => setDrawPass(e.target.value)}>
                    <option value="1ST">1ST</option>
                    <option value="2ND">2ND</option>
                    <option value="3RD">3RD</option>
                  </select>
                </label>
                <label>
                  Draw bench
                  <select value={benchOverride || suggestedBench} onChange={(e) => setBenchOverride(e.target.value)}>
                    <option value="">Select bench…</option>
                    {dbMachines.map((m) => (
                      <option key={m.machine_code} value={m.machine_code}>
                        {m.label || m.machine_code}
                        {suggest?.suggested?.benchCode === m.machine_code ? ' (suggested)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {suggest?.suggested?.warnings?.length ? (
                  <p className="banner banner--warn">{suggest.suggested.warnings.join('; ')}</p>
                ) : null}
                {err ? <p className="banner banner--error">{err}</p> : null}
                <ZButton
                  variant="primary"
                  disabled={!isWritable || busy || !selected.workOrderNo}
                  onClick={() => void moveToProduction()}
                >
                  {busy ? 'Loading…' : 'Move to Production'}
                </ZButton>
              </div>
            </>
          ) : (
            <p className="empty-hint">Select a work order to view details.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
