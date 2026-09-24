import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { drawBenchApi } from '../../api/processApi';
import FormModal from '../FormModal';
import { ZBadge, ZButton, statusTone } from '../../ui';

/**
 * Idle-gated Draw Bench picker for Load workflow.
 * Shows all benches with live board status; only IDLE rows are selectable.
 */
export default function DrawBenchLoadDialog({
  open,
  workOrderNo,
  suggestedBench = '',
  warnings = [],
  busy = false,
  error = '',
  onClose,
  onConfirm,
}) {
  const [selected, setSelected] = useState('');

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['drw-board'],
    queryFn: () => drawBenchApi.board(),
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
        .map((r) => r.benchCode),
    [rows]
  );

  useEffect(() => {
    if (!open) {
      setSelected('');
      return;
    }
    const prefer =
      (suggestedBench && idleCodes.includes(suggestedBench) && suggestedBench) ||
      idleCodes[0] ||
      '';
    setSelected(prefer);
  }, [open, suggestedBench, idleCodes]);

  const canConfirm = selected && idleCodes.includes(selected) && !busy;

  return (
    <FormModal
      open={open}
      eyebrow="Load work order"
      title={workOrderNo ? `Load ${workOrderNo} → Draw Bench` : 'Load → Draw Bench'}
      description="Select an idle or completed Draw Bench. Machines that are preparing, running, or on stoppage cannot be selected."
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
            {busy ? 'Loading…' : 'Confirm Load'}
          </ZButton>
        </>
      }
    >
      {warnings?.length ? (
        <p className="banner banner--warn">{warnings.join('; ')}</p>
      ) : null}
      {error ? <p className="banner banner--error">{error}</p> : null}
      {isFetching && !rows.length ? <p className="muted">Loading benches…</p> : null}
      {!isFetching && !rows.length ? (
        <p className="empty-hint">No Draw Bench machines found.</p>
      ) : null}

      <ul className="db-load-dialog__list">
        {rows.map((row) => {
          const status = String(row.status ?? 'IDLE');
          const selectable = status === 'IDLE' || status === 'COMPLETE';
          const isSelected = selected === row.benchCode;
          const suggested = suggestedBench === row.benchCode;
          const order = row.runningOrder;
          return (
            <li key={row.benchCode}>
              <button
                type="button"
                className={`db-load-dialog__row${isSelected ? ' is-selected' : ''}${!selectable ? ' is-disabled' : ''}${suggested ? ' is-suggested' : ''}`}
                disabled={!selectable || busy}
                onClick={() => setSelected(row.benchCode)}
                aria-pressed={isSelected}
              >
                <div className="db-load-dialog__row-main">
                  <strong className="font-mono">{row.benchCode}</strong>
                  <span className="muted">
                    {row.label || row.benchCode}
                    {row.tonnageT != null ? ` · ${row.tonnageT}T` : ''}
                  </span>
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
        <p className="banner banner--warn">No available Draw Benches right now (all are busy).</p>
      ) : null}
    </FormModal>
  );
}
