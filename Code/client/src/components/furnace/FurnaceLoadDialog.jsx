import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { furnaceApi } from '../../api/processApi';
import FormModal from '../FormModal';
import { ZBadge, ZButton, statusTone } from '../../ui';

/**
 * Idle-gated furnace picker for Move to Production / Load workflow.
 * Only IDLE or COMPLETE furnaces are selectable.
 */
export default function FurnaceLoadDialog({
  open,
  workOrderNo,
  suggestedFurnace = '',
  busy = false,
  error = '',
  onClose,
  onConfirm,
}) {
  const [selected, setSelected] = useState('');

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['furnace-board'],
    queryFn: () => furnaceApi.board(),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const idleCodes = useMemo(
    () =>
      rows
        .filter((r) => {
          const s = String(r.status);
          return s === 'IDLE' || s === 'COMPLETE';
        })
        .map((r) => r.furnaceCode),
    [rows]
  );

  useEffect(() => {
    if (!open) {
      setSelected('');
      return;
    }
    const prefer =
      (suggestedFurnace && idleCodes.includes(suggestedFurnace) && suggestedFurnace) ||
      idleCodes[0] ||
      '';
    setSelected(prefer);
  }, [open, suggestedFurnace, idleCodes]);

  const canConfirm = selected && idleCodes.includes(selected) && !busy;

  return (
    <FormModal
      open={open}
      eyebrow="Load work order"
      title={workOrderNo ? `Load ${workOrderNo} → Furnace` : 'Load → Furnace'}
      description="Select an idle or completed furnace. Machines that are preparing, running, or on stoppage cannot be selected."
      onClose={() => {
        if (!busy) onClose?.();
      }}
      preventScrimClose={busy}
      footer={
        <>
          <ZButton variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </ZButton>
          <ZButton
            variant="primary"
            disabled={!canConfirm}
            onClick={() => onConfirm?.(selected)}
          >
            {busy ? 'Assigning…' : 'Confirm Load'}
          </ZButton>
        </>
      }
    >
      {error ? <p className="banner banner--error">{error}</p> : null}
      {isFetching && !rows.length ? <p className="muted">Loading furnaces…</p> : null}
      {!isFetching && !rows.length ? (
        <p className="empty-hint">No furnace machines found.</p>
      ) : null}

      <ul className="db-load-dialog__list">
        {rows.map((row) => {
          const status = String(row.status ?? 'IDLE');
          const selectable = status === 'IDLE' || status === 'COMPLETE';
          const isSelected = selected === row.furnaceCode;
          const suggested = suggestedFurnace === row.furnaceCode;
          const order = row.runningOrder;
          return (
            <li key={row.furnaceCode}>
              <button
                type="button"
                className={`db-load-dialog__row${isSelected ? ' is-selected' : ''}${
                  !selectable ? ' is-disabled' : ''
                }${suggested ? ' is-suggested' : ''}`}
                disabled={!selectable || busy}
                onClick={() => setSelected(row.furnaceCode)}
                aria-pressed={isSelected}
              >
                <div className="db-load-dialog__row-main">
                  <strong className="font-mono">{row.furnaceCode}</strong>
                  <span className="muted">{row.label || row.furnaceCode}</span>
                </div>
                <div className="db-load-dialog__row-meta">
                  <ZBadge tone={statusTone(status === 'COMPLETE' ? 'COMPLETED' : status)}>
                    {status}
                  </ZBadge>
                  {suggested && selectable ? <ZBadge tone="info">Suggested</ZBadge> : null}
                  <span className="muted">
                    {status === 'COMPLETE'
                      ? order?.workOrderNo
                        ? `Last WO ${order.workOrderNo}`
                        : 'Available'
                      : order?.workOrderNo
                        ? `WO ${order.workOrderNo}`
                        : selectable
                          ? 'Available'
                          : 'Busy'}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {!idleCodes.length && rows.length ? (
        <p className="banner banner--warn">No available furnaces right now (all are busy).</p>
      ) : null}
    </FormModal>
  );
}
