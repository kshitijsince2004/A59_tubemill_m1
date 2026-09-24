import {
  ZButton,
  ZInput,
  ZBadge,
  statusTone,
  ZPageHeader,
  ZFilterPills,
  ZOperatorCard,
} from '../../ui';
import WorkOrderDetailPane from './WorkOrderDetailPane';

function countBy(queue, pred) {
  return queue.filter(pred).length;
}

function sizePart(size, key) {
  if (!size || size[key] == null || size[key] === '') return null;
  return size[key];
}

export default function TubeMillHub({
  machineCode,
  processLabel,
  shiftLabel,
  queue,
  filteredQueue,
  pending,
  inProgress,
  queueFilter,
  onFilterChange,
  queueSearch,
  onSearchChange,
  selectedCard,
  onSelectCard,
  busy,
  isWritable = true,
  onRefresh,
  onOpenRun,
  onResumeRun,
}) {
  const counts = {
    ALL: queue.length,
    Pending: countBy(queue, (c) => c.status === 'Pending'),
    'In Progress': countBy(
      queue,
      (c) =>
        c.status === 'In Progress' ||
        (c.status !== 'Pending' && c.status !== 'Hold' && c.status !== 'Completed')
    ),
    Hold: countBy(queue, (c) => c.status === 'Hold'),
    Completed: countBy(queue, (c) => c.status === 'Completed'),
  };

  const pills = ['ALL', 'Pending', 'In Progress', 'Hold', 'Completed'].map((f) => ({
    id: f,
    label: f === 'ALL' ? 'All' : f,
    count: counts[f],
  }));

  const size = selectedCard?.size ?? {};
  const od = sizePart(size, 'odMm') ?? sizePart(size, 'equivOdMm');
  const thk = sizePart(size, 'thkMm');
  const length = sizePart(size, 'lengthMm');

  const detailFields = selectedCard
    ? [
        { label: 'Assigned mill', value: selectedCard.millCode || machineCode, mono: true },
        { label: 'Customer', value: selectedCard.customerCode || '—' },
        { label: 'Grade', value: selectedCard.gradeCode || '—', mono: true },
        { label: 'Batch number', value: selectedCard.bcBatchNumber || '—', mono: true },
        { label: 'Size key', value: selectedCard.sizeKey || '—', mono: true },
        {
          label: 'Planned qty',
          value: selectedCard.qtyPieces != null ? `${selectedCard.qtyPieces} pcs` : '—',
          mono: true,
        },
        { label: 'OD', value: od != null ? `${od} mm` : '—', mono: true },
        { label: 'Thickness', value: thk != null ? `${thk} mm` : '—', mono: true },
        { label: 'Length', value: length != null ? `${length} mm` : '—', mono: true },
      ]
    : [];

  return (
    <div className="db-wo-hub">
      <ZPageHeader
        title={`Machine / ${machineCode} · ${processLabel}`}
        subtitle={`${shiftLabel} · ${queue.length} workorders`}
        actions={
          <ZButton variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh queue">
            ↻
          </ZButton>
        }
      />

      <div className="hub-toolbar">
        <ZInput
          placeholder="Search WO / batch / customer…"
          value={queueSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1, minWidth: '14rem', minHeight: 56 }}
        />
        <ZFilterPills pills={pills} value={queueFilter} onChange={(id) => onFilterChange(id)} />
      </div>

      <div className="hub-split">
        <ZOperatorCard title={`Workorders · ${filteredQueue.length}`}>
          <div className="hub-list-scroll">
            {(queueFilter === 'ALL' || queueFilter === 'Pending') && pending.length > 0 ? (
              <>
                <div className="queue-group-header pending">Pending · {pending.length}</div>
                {pending.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`queue-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                    onClick={() => onSelectCard(card)}
                  >
                    <div className="queue-card__top">
                      <strong className="font-mono queue-card__id" title={card.workOrderNo}>
                        {card.workOrderNo}
                      </strong>
                      <ZBadge tone="pending">PENDING</ZBadge>
                    </div>
                    <div className="queue-card__customer">{card.customerCode}</div>
                    <div className="font-mono queue-card__meta">
                      {card.sizeKey} · {card.gradeCode} · {card.bcBatchNumber}
                      {card.qtyPieces != null ? ` · ${card.qtyPieces} pcs` : ''}
                    </div>
                  </button>
                ))}
              </>
            ) : null}

            {(queueFilter === 'ALL' ||
              queueFilter === 'In Progress' ||
              queueFilter === 'Hold' ||
              queueFilter === 'Completed') &&
            inProgress.length > 0 ? (
              <>
                <div className="queue-group-header">In Progress / other · {inProgress.length}</div>
                {inProgress.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`queue-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                    disabled={busy}
                    onClick={() => onSelectCard(card)}
                  >
                    <div className="queue-card__top">
                      <strong className="font-mono queue-card__id" title={card.workOrderNo}>
                        {card.workOrderNo}
                      </strong>
                      <ZBadge tone={statusTone(card.status)}>{card.status.toUpperCase()}</ZBadge>
                    </div>
                    <div className="queue-card__customer">{card.customerCode}</div>
                    <div className="font-mono queue-card__meta">
                      {card.sizeKey} · {card.gradeCode} · {card.bcBatchNumber}
                      {card.qtyPieces != null ? ` · ${card.qtyPieces} pcs` : ''}
                    </div>
                  </button>
                ))}
              </>
            ) : null}

            {filteredQueue.length === 0 ? (
              <p className="empty-hint">No workorders match this filter.</p>
            ) : null}
          </div>
        </ZOperatorCard>

        <ZOperatorCard className="detail-pane">
          <WorkOrderDetailPane
            empty={!selectedCard}
            emptyHint="Select a workorder from the list."
            workOrderNo={selectedCard?.workOrderNo}
            batchLabel={
              selectedCard?.bcBatchNumber ? `BATCH ${selectedCard.bcBatchNumber}` : ''
            }
            backlogBadge={selectedCard?.status === 'Pending' ? 'BACKLOG' : null}
            status={selectedCard?.status}
            fields={detailFields}
            primaryAction={
              selectedCard
                ? {
                    label: 'Move to Production…',
                    disabled:
                      selectedCard.status !== 'Pending' ||
                      busy ||
                      !!selectedCard.runId ||
                      !isWritable,
                    onClick: onOpenRun,
                  }
                : null
            }
            secondaryAction={
              selectedCard?.runId
                ? {
                    label: 'Open work order',
                    disabled: busy,
                    onClick: () => onResumeRun(selectedCard),
                  }
                : null
            }
          />
        </ZOperatorCard>
      </div>
    </div>
  );
}
