import { ZBadge, ZButton, SyncStatusBadge, statusTone } from '../../../ui';

export default function StatusRail({
  machineCode,
  shiftLabel,
  millStatus,
  activeOrderId,
  activeOrderStatus,
  hold,
  clock,
  roleLabel,
  processes,
  processId,
  onProcessChange,
  onSetup,
  setupDisabled,
  onReadings,
  onManualStop,
  manualStopDisabled,
  onEndShift,
  endShiftDisabled,
  onConsumption,
  consumptionDisabled,
  extraRight,
}) {
  return (
    <header className="status-rail">
      <div className="status-rail__left">
        {processes && processes.length > 1 && onProcessChange ? (
          <label className="status-rail__process">
            <span className="sr-only">Process</span>
            <select
              className="status-rail__process-select"
              value={processId}
              onChange={(e) => onProcessChange(e.target.value)}
              aria-label="Switch process"
            >
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <img
          className="status-rail__plant-logo"
          src="/logo-goodluck.png"
          width={28}
          height={28}
          alt=""
          aria-hidden="true"
        />
        <span className="status-rail__line">{machineCode}</span>
        <span className="status-rail__shift">{shiftLabel}</span>
      </div>

      {activeOrderId ? (
        <div className="status-rail__active">
          <span className="status-rail__active-label">Active Order</span>
          <span className="status-rail__active-id font-mono" title={activeOrderId}>
            {activeOrderId}
          </span>
          {activeOrderStatus ? (
            <ZBadge tone={statusTone(activeOrderStatus)}>
              {String(activeOrderStatus).replace(/_/g, ' ')}
            </ZBadge>
          ) : null}
        </div>
      ) : (
        <div className="status-rail__spacer" />
      )}

      {onConsumption ? (
        <ZButton
          variant="ghost"
          size="sm"
          disabled={consumptionDisabled}
          onClick={onConsumption}
          className="status-rail__consumption"
        >
          CONSUMPTION
        </ZButton>
      ) : null}

      <div className="status-rail__right">
        <ZBadge tone={statusTone(millStatus)} pulse={String(millStatus).toUpperCase() === 'RUNNING'}>
          {String(millStatus).replace(/_/g, ' ')}
        </ZBadge>
        {hold ? <ZBadge tone="pending">HOLD</ZBadge> : null}
        <SyncStatusBadge />
        <span className="status-rail__clock">{clock}</span>
        {roleLabel ? <ZBadge tone="idle">{roleLabel}</ZBadge> : null}
        {onSetup ? (
          <ZButton variant="accent" size="sm" disabled={setupDisabled} onClick={onSetup}>
            SETUP
          </ZButton>
        ) : null}
        {onReadings ? (
          <ZButton variant="ghost" size="sm" onClick={onReadings}>
            READINGS
          </ZButton>
        ) : null}
        {onManualStop ? (
          <ZButton variant="danger-outline" size="sm" disabled={manualStopDisabled} onClick={onManualStop}>
            MANUAL STOP
          </ZButton>
        ) : null}
        {onEndShift ? (
          <ZButton variant="accent" size="sm" disabled={endShiftDisabled} onClick={onEndShift}>
            END SHIFT
          </ZButton>
        ) : null}
        {extraRight}
      </div>
    </header>
  );
}
