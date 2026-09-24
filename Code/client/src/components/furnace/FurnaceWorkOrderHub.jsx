import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { erpApi } from '../../api/erpApi';
import { furnaceApi } from '../../api/processApi';
import {
  ZBadge,
  ZButton,
  ZFilterPills,
  ZInput,
  ZPageHeader,
  ZOperatorCard,
  statusTone,
} from '../../ui';
import FurnaceLoadDialog from './FurnaceLoadDialog';
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
  const od = s.odMm ?? s.od_mm ?? s.od;
  const thk = s.thkMm ?? s.thk_mm ?? s.thk;
  const parts = [];
  if (od != null && od !== '') parts.push(String(od));
  if (thk != null && thk !== '') parts.push(String(thk));
  if (parts.length === 2) return `${parts[0]} > ${parts[1]} mm`;
  if (od != null && od !== '') return `OD ${od} mm`;
  return '—';
}

function sizeDetail(size) {
  const s = parseSize(size);
  return {
    od: s.odMm ?? s.od_mm ?? s.od ?? null,
    thk: s.thkMm ?? s.thk_mm ?? s.thk ?? null,
    len: s.lengthMm ?? s.length_mm ?? s.len ?? null,
  };
}

function lotActivity(lot) {
  if (!lot) return false;
  if (lot.productionStartedAt) return true;
  return (
    lot.tubeCount != null ||
    lot.totalMt != null ||
    lot.qtyNos != null ||
    lot.qtyMt != null ||
    lot.lineSpeedMhr != null ||
    lot.htType
  );
}

export function deriveFurWoUiStatus(order, lotsForWo = []) {
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

export default function FurnaceWorkOrderHub({ onMoveToProduction, isWritable = true }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedWo, setSelectedWo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asOf, setAsOf] = useState(nowLabel);
  const [loadOpen, setLoadOpen] = useState(false);

  const {
    data: ordersRaw = [],
    isFetching,
    refetch,
    error: ordersErr,
  } = useQuery({
    queryKey: ['erp-orders', 'Released'],
    queryFn: () => erpApi.orders('Released'),
  });

  const { data: lotsRaw = [] } = useQuery({
    queryKey: ['furnace-lots', 'wo-hub'],
    queryFn: () => furnaceApi.listLots({}),
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
      const uiStatus = deriveFurWoUiStatus(o, woLots);
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

  const size = selected ? sizeDetail(selected.size) : null;

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
        sizeLabel(o.size),
        o.activeLot?.furnaceCode,
        o.activeLot?.chargeNo,
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
    await qc.invalidateQueries({ queryKey: ['furnace-lots'] });
    await qc.invalidateQueries({ queryKey: ['furnace-board'] });
  }

  async function confirmLoad(furnaceCode) {
    if (!selected?.workOrderNo || !furnaceCode) return;
    setBusy(true);
    setErr('');
    try {
      const lot = await furnaceApi.assign(furnaceCode, {
        workOrderNo: selected.workOrderNo,
      });
      await qc.invalidateQueries({ queryKey: ['furnace-board'] });
      await qc.invalidateQueries({ queryKey: ['furnace-lots'] });
      setLoadOpen(false);
      onMoveToProduction?.(lot, furnaceCode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  function openExistingProduction() {
    const lot = selected?.openDraft;
    if (!lot) return;
    onMoveToProduction?.(lot, lot.furnaceCode);
  }

  function selectOrder(o) {
    setSelectedWo(String(o.workOrderNo ?? ''));
    setErr('');
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
        </div>
        <div className="db-wo-card__badges" style={{ marginTop: 6 }}>
          {o.activeLot?.furnaceCode ? (
            <ZBadge tone="info">{o.activeLot.furnaceCode}</ZBadge>
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
        title="Furnace · Work Order"
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
          placeholder="Search workorder, customer, batch, grade…"
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
            batchLabel={selected?.lotNo ? `BATCH ${selected.lotNo}` : ''}
            backlogBadge={selected?.uiStatus === 'PENDING' ? 'BACKLOG' : null}
            status={selected?.uiStatus}
            fields={
              selected
                ? [
                    {
                      label: 'Assigned furnace',
                      value: selected.activeLot?.furnaceCode
                        ? selected.activeLot.furnaceCode
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
                            selected.openDraft.furnaceCode
                              ? ` · ${selected.openDraft.furnaceCode}`
                              : ''
                          }${
                            selected.openDraft.chargeNo
                              ? ` · ${selected.openDraft.chargeNo}`
                              : ''
                          }`
                        : '—',
                      mono: true,
                    },
                    ...(size?.od != null && size.od !== ''
                      ? [{ label: 'OD', value: `${size.od} mm`, mono: true }]
                      : []),
                    ...(size?.thk != null && size.thk !== ''
                      ? [{ label: 'Thickness', value: `${size.thk} mm`, mono: true }]
                      : []),
                    ...(size?.len != null && size.len !== ''
                      ? [{ label: 'Length', value: `${size.len} mm`, mono: true }]
                      : []),
                    ...(plannedQtyLabel
                      ? [{ label: 'Planned qty', value: plannedQtyLabel, mono: true }]
                      : !size?.od && !size?.thk && !size?.len
                        ? [{ label: 'Size', value: sizeLabel(selected.size), mono: true }]
                        : []),
                  ]
                : []
            }
            banners={
              err && !loadOpen ? (
                <p className="banner banner--error" style={{ marginTop: 12 }}>
                  {err}
                </p>
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
                      label: 'Move to Production…',
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

      <FurnaceLoadDialog
        open={loadOpen}
        workOrderNo={selected?.workOrderNo}
        suggestedFurnace={selected?.activeLot?.furnaceCode || ''}
        busy={busy}
        error={loadOpen ? err : ''}
        onClose={() => {
          if (!busy) {
            setLoadOpen(false);
            setErr('');
          }
        }}
        onConfirm={(furnace) => void confirmLoad(furnace)}
      />
    </div>
  );
}
