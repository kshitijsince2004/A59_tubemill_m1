import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { stpApi } from '../../api/processApi';
import {
  ZBadge,
  ZButton,
  ZFilterPills,
  ZInput,
  ZPageHeader,
  ZOperatorCard,
  statusTone,
} from '../../ui';
import WorkOrderDetailPane from '../process/WorkOrderDetailPane';

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

function sizeParts(size) {
  const s = parseSize(size);
  return {
    od: s.od ?? s.OD ?? s.odMm ?? s.outerDia ?? null,
    thk: s.thk ?? s.TH ?? s.thkMm ?? s.thickness ?? null,
    len: s.len ?? s.length ?? s.lengthMm ?? s.LEN ?? null,
    slit: s.slit ?? s.slitWidth ?? s.slitWidthMm ?? s.slit_width ?? null,
    profile: s.profile ?? s.shape ?? null,
  };
}

function sizeLabel(size) {
  const p = sizeParts(size);
  const bits = [];
  if (p.od != null && p.od !== '') bits.push(`OD ${p.od}`);
  if (p.slit != null && p.slit !== '') bits.push(`Slit ${p.slit}`);
  if (p.thk != null && p.thk !== '') bits.push(`TH ${p.thk}`);
  if (p.len != null && p.len !== '') bits.push(`L ${p.len}`);
  return bits.join(' · ') || '—';
}

function lotActivity(lot) {
  if (!lot) return false;
  if (lot.productionStartedAt) return true;
  return (
    lot.qtyNo != null ||
    lot.qtyMt != null ||
    lot.surfaceFinish ||
    lot.disposition ||
    lot.remarks
  );
}

/** Map ERP order + open lots → UI status pill. */
export function deriveStpWoUiStatus(order, lotsForWo = []) {
  const status = String(order?.status ?? '').toLowerCase();
  if (status.includes('hold')) return 'ON_HOLD';
  if (lotsForWo.some((l) => l.status === 'HOLD')) return 'ON_HOLD';
  if (lotsForWo.some((l) => l.status === 'SUBMITTED' || l.status === 'APPROVED')) return 'COMPLETED';
  const open = lotsForWo.filter((l) => l.status === 'DRAFT' || l.status === 'HOLD');
  if (open.some((l) => lotActivity(l) || l.productionStartedAt)) return 'IN_PROGRESS';
  if (open.length) return 'PREPARING';
  return 'PENDING';
}

function nowLabel() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function StpWorkOrderHub({
  isWritable = true,
  shiftRef = 'A',
  selectedWo = null,
  selectedLineNo = null,
  onSelect,
  onMoveToProduction,
  onOpenConsole,
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asOf, setAsOf] = useState(nowLabel);

  const {
    data: ordersRaw = [],
    isFetching,
    refetch,
    error: ordersErr,
  } = useQuery({
    queryKey: ['stp-orders'],
    queryFn: () => stpApi.listOrders('Released'),
  });

  const { data: lotsRaw = [] } = useQuery({
    queryKey: ['stp-lots', 'wo-hub'],
    queryFn: () => stpApi.listLots({}),
  });

  const orders = useMemo(
    () => (Array.isArray(ordersRaw) ? ordersRaw : ordersRaw?.items ?? []),
    [ordersRaw]
  );
  const lots = useMemo(
    () => (Array.isArray(lotsRaw) ? lotsRaw : lotsRaw?.items ?? []),
    [lotsRaw]
  );

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
      const uiStatus = deriveStpWoUiStatus(o, woLots);
      const openDraft =
        woLots.find((l) => l.status === 'DRAFT' && !l.productionEndedAt) ?? null;
      const activeLot = openDraft ?? woLots[0] ?? null;
      return { ...o, uiStatus, lots: woLots, activeLot, openDraft };
    });
  }, [orders, lotsByWo]);

  const selected = useMemo(
    () => enriched.find((o) => String(o.workOrderNo) === String(selectedWo)) ?? null,
    [enriched, selectedWo]
  );

  const selectedLine = useMemo(() => {
    if (!selected) return null;
    const lines = selected.lines ?? [];
    if (!lines.length) return null;
    return lines.find((l) => l.lineNo === selectedLineNo) ?? lines[0] ?? null;
  }, [selected, selectedLineNo]);

  const lineParts = sizeParts(selectedLine?.size ?? selected?.size);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((o) => {
      if (filter !== 'ALL' && o.uiStatus !== filter) return false;
      if (!q) return true;
      const lineHay = (o.lines ?? [])
        .map((l) => [l.coilNo, l.customerCode, l.gradeCode, sizeLabel(l.size)].join(' '))
        .join(' ');
      const hay = [
        o.workOrderNo,
        o.lotNo,
        o.customerCode,
        o.gradeCode,
        o.millCode,
        sizeLabel(o.size),
        lineHay,
        o.activeLot?.lotNo,
        o.activeLot?.machineCode,
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
  const pendingList = filtered.filter((o) => o.uiStatus === 'PENDING');
  const otherList = filtered.filter((o) => o.uiStatus !== 'PENDING');

  async function refresh() {
    setAsOf(nowLabel());
    await refetch();
    await qc.invalidateQueries({ queryKey: ['stp-lots'] });
    await qc.invalidateQueries({ queryKey: ['stp-live-status'] });
  }

  function selectOrder(o) {
    const wo = String(o.workOrderNo ?? '');
    const firstLine = o.lines?.[0]?.lineNo ?? 1;
    setErr('');
    onSelect?.(wo, firstLine);
  }

  function selectLine(lineNo) {
    if (!selectedWo) return;
    setErr('');
    onSelect?.(selectedWo, lineNo);
  }

  async function handleMoveToProduction() {
    if (!selected?.workOrderNo) return;
    const lineNo = selectedLine?.lineNo ?? selectedLineNo ?? 1;
    setBusy(true);
    setErr('');
    try {
      const existing = (selected.lots ?? []).find(
        (l) =>
          l.status === 'DRAFT' &&
          Number(l.workOrderLineNo ?? 1) === Number(lineNo) &&
          !l.productionEndedAt
      );
      if (existing) {
        onMoveToProduction?.(existing);
        return;
      }
      const created = await stpApi.assign({
        workOrderNo: selected.workOrderNo,
        lineNo,
        machineCode: 'STP-01',
        shiftRef: shiftRef || 'A',
      });
      await qc.invalidateQueries({ queryKey: ['stp-lots'] });
      await qc.invalidateQueries({ queryKey: ['stp-orders'] });
      await qc.invalidateQueries({ queryKey: ['stp-live-status'] });
      onMoveToProduction?.(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  function openExistingProduction() {
    const lot = selected?.openDraft;
    if (!lot) return;
    if (onOpenConsole) onOpenConsole(lot);
    else onMoveToProduction?.(lot);
  }

  const plannedQtyLabel =
    selectedLine?.qtyPieces != null ||
    selectedLine?.plannedQty != null ||
    selected?.qtyPieces != null ||
    selected?.plannedQty != null
      ? [
          (selectedLine?.qtyPieces ?? selected?.qtyPieces) != null
            ? `${selectedLine?.qtyPieces ?? selected?.qtyPieces} pcs`
            : null,
          (selectedLine?.plannedQty ?? selected?.plannedQty) != null
            ? `${selectedLine?.plannedQty ?? selected?.plannedQty} MT`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  function renderQueueCard(o) {
    const wo = String(o.workOrderNo ?? '');
    const active = String(selectedWo) === wo;
    const qty =
      o.plannedQty != null
        ? `${o.plannedQty} MT`
        : o.qtyPieces != null
          ? `${o.qtyPieces} pcs`
          : '—';
    const lineCount = o.lines?.length ?? 0;
    return (
      <button
        key={wo}
        type="button"
        className={`queue-card${active ? ' selected' : ''}`}
        disabled={busy}
        onClick={() => selectOrder(o)}
      >
        <div className="queue-card__top">
          <strong className="font-mono queue-card__id" title={wo}>
            {wo}
          </strong>
          <div className="db-wo-card__badges">
            {o.uiStatus === 'PENDING' ? <ZBadge tone="pending">BACKLOG</ZBadge> : null}
            <ZBadge tone={o.uiStatus === 'PENDING' ? 'pending' : statusTone(o.uiStatus)}>
              {o.uiStatus.replace(/_/g, ' ')}
            </ZBadge>
          </div>
        </div>
        <div className="queue-card__customer">{String(o.customerCode ?? '—')}</div>
        <div className="font-mono queue-card__meta">
          BATCH {String(o.lotNo ?? '—')} · Grade {String(o.gradeCode ?? '—')} ·{' '}
          {sizeLabel(o.size)} · {qty}
          {lineCount > 1 ? ` · ${lineCount} lines` : ''}
        </div>
        <div className="db-wo-card__badges" style={{ marginTop: 6 }}>
          {o.activeLot?.machineCode || o.activeLot?.lotNo ? (
            <ZBadge tone="info">{o.activeLot.machineCode || o.activeLot.lotNo}</ZBadge>
          ) : (
            <ZBadge tone="idle">Unassigned</ZBadge>
          )}
        </div>
      </button>
    );
  }

  const lines = selected?.lines ?? [];

  return (
    <div className="db-wo-hub stp-wo-hub">
      <ZPageHeader
        title="STP · Workorder"
        subtitle={`as of ${asOf} · ${enriched.length} workorders`}
        actions={
          <ZButton
            variant="ghost"
            size="sm"
            disabled={isFetching}
            onClick={() => void refresh()}
            aria-label="Refresh queue"
          >
            {isFetching ? '…' : '↻'}
          </ZButton>
        }
      />

      <div className="hub-toolbar">
        <ZInput
          placeholder="Search workorder, customer, batch, grade, coil…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '14rem', minHeight: 56 }}
        />
        <ZFilterPills pills={pills} value={filter} onChange={setFilter} />
      </div>

      {ordersErr ? (
        <p className="banner banner--error">
          {ordersErr instanceof Error ? ordersErr.message : 'Workorders failed'}
        </p>
      ) : null}

      <div className="hub-split">
        <ZOperatorCard title={`Workorder queue · ${filtered.length}`}>
          <div className="hub-list-scroll">
            {(filter === 'ALL' || filter === 'PENDING') && pendingList.length > 0 ? (
              <>
                <div className="queue-group-header pending">
                  Backlog · {filter === 'ALL' ? backlogCount : pendingList.length}
                </div>
                {pendingList.map(renderQueueCard)}
              </>
            ) : null}

            {(filter === 'ALL' || filter !== 'PENDING') && otherList.length > 0 ? (
              <>
                {filter === 'ALL' ? (
                  <div className="queue-group-header">Active / other · {otherList.length}</div>
                ) : null}
                {otherList.map(renderQueueCard)}
              </>
            ) : null}

            {filtered.length === 0 ? (
              <p className="empty-hint">No workorders match this filter.</p>
            ) : null}
          </div>
        </ZOperatorCard>

        <ZOperatorCard className="detail-pane">
          <WorkOrderDetailPane
            empty={!selected}
            emptyHint="Select a workorder from the list."
            workOrderNo={selected?.workOrderNo}
            batchLabel={
              selected
                ? `BATCH ${String(selectedLine?.lotNo ?? selected.lotNo ?? '—')}`
                : ''
            }
            backlogBadge={selected?.uiStatus === 'PENDING' ? 'BACKLOG' : null}
            status={selected?.uiStatus}
            extra={
              selected && lines.length > 1 ? (
                <div className="stp-wo-hub__lines" style={{ marginBottom: 16 }}>
                  {lines.map((l) => (
                    <button
                      key={l.lineNo}
                      type="button"
                      className={`stp-wo-hub__line${
                        Number(selectedLine?.lineNo) === Number(l.lineNo) ? ' is-selected' : ''
                      }`}
                      disabled={busy}
                      onClick={() => selectLine(l.lineNo)}
                    >
                      <strong className="font-mono">L{l.lineNo}</strong>
                      <span>{sizeLabel(l.size)}</span>
                      <span className="muted">
                        {l.coilNo || '—'} · {l.qtyPieces ?? l.plannedQty ?? '—'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null
            }
            fields={
              selected
                ? [
                    {
                      label: 'Assigned',
                      value: selected.openDraft?.lotNo
                        ? `${selected.openDraft.lotNo}${
                            selected.openDraft.machineCode
                              ? ` · ${selected.openDraft.machineCode}`
                              : ''
                          }`
                        : 'Unassigned',
                      mono: true,
                    },
                    {
                      label: 'Customer',
                      value: String(
                        selectedLine?.customerCode ?? selected.customerCode ?? '—'
                      ),
                    },
                    {
                      label: 'Grade',
                      value: String(selectedLine?.gradeCode ?? selected.gradeCode ?? '—'),
                      mono: true,
                    },
                    {
                      label: 'Coil',
                      value: String(selectedLine?.coilNo ?? '—'),
                      mono: true,
                    },
                    {
                      label: 'Line',
                      value: String(selectedLine?.lineNo ?? '—'),
                      mono: true,
                    },
                    {
                      label: 'Batch number',
                      value: String(selectedLine?.lotNo ?? selected.lotNo ?? '—'),
                      mono: true,
                    },
                    {
                      label: 'Pass',
                      value: String(selectedLine?.passNo ?? '—'),
                      mono: true,
                    },
                    {
                      label: 'Next process',
                      value: String(selectedLine?.nextProcess ?? '—'),
                    },
                    { label: 'Mill', value: String(selected.millCode ?? '—'), mono: true },
                    { label: 'ERP status', value: String(selected.status ?? '—') },
                    ...(lineParts.od != null && lineParts.od !== ''
                      ? [{ label: 'OD', value: `${lineParts.od} mm`, mono: true }]
                      : []),
                    ...(lineParts.slit != null && lineParts.slit !== ''
                      ? [{ label: 'Slit', value: `${lineParts.slit} mm`, mono: true }]
                      : []),
                    ...(lineParts.thk != null && lineParts.thk !== ''
                      ? [{ label: 'Thickness', value: `${lineParts.thk} mm`, mono: true }]
                      : []),
                    ...(lineParts.len != null && lineParts.len !== ''
                      ? [{ label: 'Length', value: `${lineParts.len} mm`, mono: true }]
                      : []),
                    ...(lineParts.profile
                      ? [{ label: 'Shape', value: String(lineParts.profile) }]
                      : []),
                    ...(plannedQtyLabel
                      ? [{ label: 'Planned qty', value: plannedQtyLabel, mono: true }]
                      : !lineParts.od &&
                          !lineParts.slit &&
                          !lineParts.thk &&
                          !lineParts.len
                        ? [
                            {
                              label: 'Size',
                              value: sizeLabel(selectedLine?.size ?? selected.size),
                              mono: true,
                            },
                          ]
                        : []),
                  ]
                : []
            }
            banners={
              err ? (
                <p className="banner banner--error" style={{ marginTop: 12 }}>
                  {err}
                </p>
              ) : null
            }
            primaryAction={
              selected
                ? selected.openDraft &&
                  Number(selected.openDraft.workOrderLineNo ?? 1) ===
                    Number(selectedLine?.lineNo ?? selectedLineNo ?? 1)
                  ? {
                      label: 'Open production',
                      disabled: !isWritable || busy,
                      onClick: openExistingProduction,
                    }
                  : {
                      label: busy ? 'Assigning…' : 'Move to Production…',
                      disabled:
                        !isWritable || busy || !selected.workOrderNo || !selectedLine,
                      onClick: () => void handleMoveToProduction(),
                    }
                : null
            }
          />
        </ZOperatorCard>
      </div>
    </div>
  );
}
