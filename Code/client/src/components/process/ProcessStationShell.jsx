import { useState } from 'react';
import { OperatorShell } from '../layout/operator';
import { useIstClock } from '../../lib/operatorClock';
import { ZPageHeader, ZOperatorCard, ZButton, ZBadge, statusTone } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";

const DEFAULT_NAV_ITEMS = [
  { id: 'orders', icon: '▣', label: 'Orders' },
  { id: 'capture', icon: '◎', label: 'Capture' },
  { id: 'history', icon: '▤', label: 'History' },
];

/**
 * Shared floor chrome for non-TM process stations.
 * Capture body is the primary surface; Orders/History are light placeholders unless provided.
 * Pass `navItems` / `furnacesContent` for FUR multi-furnace board landing.
 */
export default function ProcessStationShell({
  processId,
  processLabel,
  machineCode,
  processes,
  onProcessChange,
  onLogout,
  showAdmin,
  onAdmin,
  ordersHint = 'Select Capture to enter production data. Order queues for this station are managed via ERP work orders on the form.',
  ordersContent,
  historyContent,
  furnacesContent,
  stopContent,
  gasContent,
  monitoringContent,
  children,
  jobActive,
  actionRail,
  millStatus = 'IDLE',
  activeOrderId,
  activeOrderStatus,
  hold,
  shiftLabel = 'Shift A',
  roleLabel,
  stoppageBanner,
  onReadings,
  onManualStop,
  manualStopDisabled,
  onEndShift,
  endShiftDisabled,
  onConsumption,
  consumptionDisabled,
  captureTitle,
  initialNav = 'capture',
  onNavChange,
  nav: controlledNav,
  navItems,
  extraRight,
}) {
  const clock = useIstClock();
  const [internalNav, setInternalNav] = useState(initialNav);
  const nav = controlledNav ?? internalNav;
  const items = navItems?.length ? navItems : DEFAULT_NAV_ITEMS;

  function setNav(id) {
    if (id === 'admin' && onAdmin) {
      onAdmin();
      return;
    }
    if (controlledNav == null) setInternalNav(id);
    onNavChange?.(id);
  }

  const orderNav = nav === 'queue' || nav === 'orders' || nav === 'order';
  const captureNav = nav === 'capture';

  return (
    <OperatorShell
      nav={nav === 'queue' ? 'orders' : nav}
      onNavChange={setNav}
      showAdmin={showAdmin}
      onLogout={onLogout}
      navItems={items}
      machineCode={machineCode}
      shiftLabel={shiftLabel}
      millStatus={millStatus}
      activeOrderId={activeOrderId}
      activeOrderStatus={activeOrderStatus}
      hold={hold}
      clock={clock}
      roleLabel={roleLabel}
      processes={processes}
      processId={processId}
      onProcessChange={onProcessChange}
      onReadings={onReadings}
      onManualStop={onManualStop}
      manualStopDisabled={manualStopDisabled}
      onEndShift={onEndShift}
      endShiftDisabled={endShiftDisabled}
      onConsumption={onConsumption}
      consumptionDisabled={consumptionDisabled}
      stoppageBanner={stoppageBanner}
      jobActive={jobActive}
      actionRail={actionRail}
      extraRight={extraRight}
    >
      {nav === 'furnaces' && (furnacesContent ?? null)}

      {nav === 'stop' && (stopContent ?? null)}

      {orderNav && (
        ordersContent ?? (
          <>
            <ZPageHeader title={`Machine / ${machineCode} · ${processLabel}`} subtitle={`${shiftLabel} · Orders`} />
            <ZOperatorCard title="Orders">
              <p className="empty-hint">{ordersHint}</p>
              <ZButton variant="primary" onClick={() => setNav('capture')}>
                Go to Capture
              </ZButton>
            </ZOperatorCard>
          </>
        )
      )}

      {nav === 'history' && (
        historyContent ?? (
          <ZOperatorCard title="History">
            <p className="empty-hint">Recent entries appear in Capture after you save.</p>
            <ZButton variant="ghost" onClick={() => setNav('capture')}>
              Back to Capture
            </ZButton>
          </ZOperatorCard>
        )
      )}

      {nav === 'gas' && (gasContent ?? null)}

      {nav === 'monitoring' && (monitoringContent ?? null)}

      {captureNav && (
        <div className="capture-workspace">
          <div className="process-header">
            <div className="process-header__meta">
              <h2 className="process-header__title">{captureTitle ?? `${processLabel} Capture`}</h2>
              <ZBadge tone="idle">{machineCode}</ZBadge>
              <ZBadge tone={statusTone(millStatus)}>{String(millStatus).replace(/_/g, ' ')}</ZBadge>
              {hold ? <ZBadge tone="pending">HOLD</ZBadge> : null}
            </div>
          </div>
          <div className="capture-workspace__body">{children}</div>
        </div>
      )}
    </OperatorShell>
  );
}
