import { ZBadge, statusTone } from '../../ui';

/** Capture header + scroll body for production console. */
export default function CaptureWorkspace({
  title = 'Capture',
  workOrderNo,
  runNo,
  machineCode,
  runState,
  hold,
  extraBadges,
  onClose,
  children,
}) {
  return (
    <div className="capture-workspace">
      <div className="process-header">
        <div className="process-header__meta">
          <h2 className="process-header__title">{title}</h2>
          {workOrderNo ? (
            <span className="font-mono process-header__wo" title={workOrderNo}>
              {workOrderNo}
            </span>
          ) : null}
          {runNo ? (
            <span className="font-mono process-header__run" title={runNo}>
              Run {runNo}
            </span>
          ) : null}
          <ZBadge tone="idle">{machineCode}</ZBadge>
          <ZBadge tone={statusTone(runState)}>
            {String(runState ?? 'IDLE').replace(/_/g, ' ')}
          </ZBadge>
          {hold ? <ZBadge tone="pending">HOLD</ZBadge> : null}
          {extraBadges}
        </div>
        {onClose ? (
          <button
            type="button"
            className="process-header__close"
            onClick={onClose}
            aria-label="Close work order"
          >
            ✕
          </button>
        ) : null}
      </div>
      <div className="capture-workspace__body">{children}</div>
    </div>
  );
}
