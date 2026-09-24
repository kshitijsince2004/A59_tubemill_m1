import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { erpApi } from '../../api/erpApi';
import { drawBenchApi } from '../../api/processApi';
import {
  ZBadge,
  ZButton,
  ZFilterPills,
  ZInput,
  ZPageHeader,
  ZOperatorCard,
  statusTone,
} from '../../ui';
import DrawBenchLoadDialog from './DrawBenchLoadDialog';
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
  if (lot.productionStartedAt) return true;
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
  const [drawPass, setDrawPass] = useState('1ST');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asOf, setAsOf] = useState(nowLabel);
  const [loadOpen, setLoadOpen] = useState(false);

  const { data: orders = [], isFetching, refetch, error: ordersErr } = useQuery({
    queryKey: ['erp-orders', 'Released'],
    queryFn: () => erpApi.orders('Released'),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ['drw-lots', 'wo-hub'],
    queryFn: () => drawBenchApi.listLots({}),
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
      const openDraft = woLots.find((l) => l.status === 'DRAFT') ?? null;
      const activeLot = openDraft ?? woLots[0] ?? null;
      return { ...o, uiStatus, lots: woLots, activeLot, openDraft };
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
  const pendingList = filtered.filter((o) => o.uiStatus === 'PENDING');
  const otherList = filtered.filter((o) => o.uiStatus !== 'PENDING');

  async function refresh() {
    setAsOf(nowLabel());
    await refetch();
    await qc.invalidateQueries({ queryKey: ['drw-lots'] });
    await qc.invalidateQueries({ queryKey: ['drw-board'] });
  }

  async function confirmLoad(benchCode) {
    if (!selected?.workOrderNo || !benchCode) return;
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
      setLoadOpen(false);
      onMoveToProduction?.(lot, benchCode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setBusy(false);
    }
  }

  function openExistingProduction() {
    const lot = selected?.openDraft;
    if (!lot) return;
    onMoveToProduction?.(lot, lot.benchCode);
  }

  function selectOrder(o) {
    setSelectedWo(String(o.workOrderNo ?? ''));
    setErr('');
    setDrawPass('1ST');
  }

  const plannedQtyLabel =
    selected?.qtyPieces != null || selected?.plannedQty != null
      ? [
          selected.qtyPieces != null ? `${selected.qtyPieces} pcs` : null,
          selected.plannedQty != null ? `${selected.plannedQty} MT` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  function renderQueueCard(o) {
    const wo = String(o.workOrderNo ?? '');
    const active = selectedWo === wo;
    const qty =
      o.plannedQty != null
        ? `${o.plannedQty} MT`
        : o.qtyPieces != null
          ? `${o.qtyPieces} pcs`
          : '—';
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
            {o.uiStatus === 'PENDING' ? (
              <ZBadge tone="pending">BACKLOG</ZBadge>
            ) : null}
            <ZBadge tone={o.uiStatus === 'PENDING' ? 'pending' : statusTone(o.uiStatus)}>
              {o.uiStatus.replace(/_/g, ' ')}
            </ZBadge>
          </div>
        </div>
        <div className="queue-card__customer">{String(o.customerCode ?? '—')}</div>
        <div className="font-mono queue-card__meta">
          BATCH {String(o.lotNo ?? '—')} · Grade {String(o.gradeCode ?? '—')} · {sizeLabel(o.size)} ·{' '}
          {qty}
        </div>
        <div className="db-wo-card__badges" style={{ marginTop: 6 }}>
          {o.activeLot?.benchCode ? (
            <ZBadge tone="info">{o.activeLot.benchCode}</ZBadge>
          ) : (
            <ZBadge tone="idle">Unassigned</ZBadge>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="db-wo-hub">
      <ZPageHeader
        title="Machine / Draw Bench"
        subtitle={`as of ${asOf} · ${enriched.length} work orders`}
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
          placeholder="Search work order, customer, batch, grade…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '14rem', minHeight: 56 }}
        />
        <ZFilterPills pills={pills} value={filter} onChange={setFilter} />
      </div>

      {ordersErr ? (
        <p className="banner banner--error">
          {ordersErr instanceof Error ? ordersErr.message : 'Orders failed'}
        </p>
      ) : null}

      <div className="hub-split">
        <ZOperatorCard title={`Draw Bench Queue · ${filtered.length}`}>
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
              <p className="empty-hint">No work orders match this filter.</p>
            ) : null}
          </div>
        </ZOperatorCard>

        <ZOperatorCard className="detail-pane">
          <WorkOrderDetailPane
            empty={!selected}
            emptyHint="Select a workorder from the list."
            workOrderNo={selected?.workOrderNo}
            batchLabel={selected?.lotNo ? `BATCH ${selected.lotNo}` : ''}
            backlogBadge={selected?.uiStatus === 'PENDING' ? 'BACKLOG' : null}
            status={selected?.uiStatus}
            fields={
              selected
                ? [
                    {
                      label: 'Assigned bench',
                      value: selected.activeLot?.benchCode
                        ? selected.activeLot.benchCode
                        : suggestedBench
                          ? `Unassigned · hint ${suggestedBench}`
                          : 'Unassigned',
                      mono: true,
                    },
                    { label: 'Customer', value: String(selected.customerCode ?? '—') },
                    { label: 'Grade', value: String(selected.gradeCode ?? '—'), mono: true },
                    { label: 'Batch number', value: String(selected.lotNo ?? '—'), mono: true },
                    { label: 'ERP status', value: String(selected.status ?? '—') },
                    {
                      label: 'Active lot',
                      value: selected.openDraft
                        ? `${selected.openDraft.status}${
                            selected.openDraft.benchCode
                              ? ` · ${selected.openDraft.benchCode}`
                              : ''
                          }`
                        : '—',
                      mono: true,
                    },
                    {
                      label: 'Material / Mill',
                      value: String(selected.millCode ?? '—'),
                      mono: true,
                    },
                    {
                      label: 'Draw pass',
                      value: selected.openDraft ? (
                        String(selected.openDraft.drawPass ?? drawPass)
                      ) : (
                        <select
                          value={drawPass}
                          onChange={(e) => setDrawPass(e.target.value)}
                          disabled={!isWritable || busy}
                        >
                          <option value="1ST">1ST</option>
                          <option value="2ND">2ND</option>
                          <option value="3RD">3RD</option>
                        </select>
                      ),
                    },
                    ...(size?.od != null
                      ? [{ label: 'OD', value: `${size.od} mm`, mono: true }]
                      : []),
                    ...(size?.id != null
                      ? [{ label: 'ID', value: `${size.id} mm`, mono: true }]
                      : []),
                    ...(size?.thk != null
                      ? [{ label: 'Thickness', value: `${size.thk} mm`, mono: true }]
                      : []),
                    ...(size?.len != null
                      ? [{ label: 'Length', value: `${size.len} mm`, mono: true }]
                      : []),
                    ...(plannedQtyLabel
                      ? [{ label: 'Planned qty', value: plannedQtyLabel, mono: true }]
                      : !size?.od && !size?.id && !size?.thk && !size?.len
                        ? [{ label: 'Size', value: sizeLabel(selected.size), mono: true }]
                        : []),
                  ]
                : []
            }
            banners={
              selected ? (
                <>
                  {suggest?.suggested?.warnings?.length ? (
                    <p className="banner banner--warn" style={{ marginTop: 12 }}>
                      {suggest.suggested.warnings.join('; ')}
                    </p>
                  ) : null}
                  {err && !loadOpen ? (
                    <p className="banner banner--error" style={{ marginTop: 12 }}>
                      {err}
                    </p>
                  ) : null}
                </>
              ) : null
            }
            primaryAction={
              selected
                ? selected.openDraft
                  ? {
                      label: 'Open production',
                      disabled: !isWritable || busy,
                      onClick: openExistingProduction,
                    }
                  : {
                      label: 'Load',
                      disabled: !isWritable || busy || !selected.workOrderNo,
                      onClick: () => {
                        setErr('');
                        setLoadOpen(true);
                      },
                    }
                : null
            }
          />
        </ZOperatorCard>
      </div>

      <DrawBenchLoadDialog
        open={loadOpen}
        workOrderNo={selected?.workOrderNo}
        suggestedBench={suggestedBench}
        warnings={suggest?.suggested?.warnings ?? []}
        busy={busy}
        error={loadOpen ? err : ''}
        onClose={() => {
          if (!busy) {
            setLoadOpen(false);
            setErr('');
          }
        }}
        onConfirm={(bench) => void confirmLoad(bench)}
      />
    </div>
  );
}
