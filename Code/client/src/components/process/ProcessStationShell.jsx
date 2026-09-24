import { useState } from 'react';
import { OperatorShell } from '../layout/operator';
import { useIstClock } from '../../lib/operatorClock';
import { ZPageHeader, ZOperatorCard, ZButton, ZBadge, statusTone } from '../../ui';
import CrewCaptureModal, { useCrewSession } from '../CrewCaptureModal';
import { HandoverAcceptGate } from '../HandoverAcceptGate';
import { useNavigate } from 'react-router-dom';

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
  onSetup,
  setupDisabled,
  setupLabel,
  onReadings,
  onHold,
  holdDisabled,
  onManualStop,
  manualStopDisabled,
  onEndShift,
  endShiftDisabled,
  onConsumption,
  consumptionDisabled,
  captureTitle,
  hideCaptureHeader = false,
  initialNav = 'capture',
  onNavChange,
  nav: controlledNav,
  navItems,
  extraRight,
  crewSessionEnabled = true,
}) {
  const clock = useIstClock();
  const navigate = useNavigate();
  const [internalNav, setInternalNav] = useState(initialNav);
  const nav = controlledNav ?? internalNav;
  const items = navItems?.length ? navItems : DEFAULT_NAV_ITEMS;

  const shiftCode = String(shiftLabel || 'A').replace(/^Shift\s+/i, '') || 'A';
  const crew = useCrewSession(machineCode, {
    shiftCode,
    enabled: Boolean(crewSessionEnabled && machineCode),
  });

  const endShiftHandler =
    onEndShift ??
    (() => {
      if (!machineCode) return;
      const q = new URLSearchParams({
        machine: machineCode,
        process: processId || '',
      });
      navigate(`/handover?${q.toString()}`);
    });

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
    <HandoverAcceptGate
      machineCode={machineCode}
      onHandoverAccepted={() => void crew.refresh()}
    >
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
        onSetup={onSetup}
        setupDisabled={setupDisabled}
        setupLabel={setupLabel}
        onReadings={onReadings}
        onHold={onHold}
        holdDisabled={holdDisabled}
        onManualStop={onManualStop}
        manualStopDisabled={manualStopDisabled}
        onEndShift={endShiftHandler}
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

        {captureNav &&
          (hideCaptureHeader ? (
            children
          ) : (
            <div className="capture-workspace">
              <div className="process-header">
                <div className="process-header__meta">
                  <h2 className="process-header__title">
                    {captureTitle ?? `${processLabel} Capture`}
                  </h2>
                  <ZBadge tone="idle">{machineCode}</ZBadge>
                  <ZBadge tone={statusTone(millStatus)}>
                    {String(millStatus).replace(/_/g, ' ')}
                  </ZBadge>
                  {hold ? <ZBadge tone="pending">HOLD</ZBadge> : null}
                  {crew.needsCrew ? <ZBadge tone="pending">CREW NEEDED</ZBadge> : null}
                  {crew.conflictCode === 'ACTIVE_SESSION_CONFLICT' ? (
                    <ZBadge tone="pending">SESSION HELD BY ANOTHER OPERATOR</ZBadge>
                  ) : null}
                  {crew.conflictCode === 'PENDING_HANDOVER' ? (
                    <ZBadge tone="pending">HANDOVER PENDING</ZBadge>
                  ) : null}
                </div>
              </div>
              <div className="capture-workspace__body">{children}</div>
            </div>
          ))}
      </OperatorShell>
      <CrewCaptureModal
        open={crew.showModal}
        machineCode={machineCode}
        sessionId={crew.sessionId}
        onClose={() => crew.setShowModal(false)}
        onAttached={() => void crew.refresh()}
      />
      {crew.conflictCode === 'ACTIVE_SESSION_CONFLICT' ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 190,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'rgba(248,250,252,0.92)',
            padding: 24,
          }}
        >
          <p style={{ textAlign: 'center', maxWidth: 420, margin: 0 }}>
            Another operator already holds the active session on {machineCode}. Ask them to end
            shift / hand over, or sign in as that operator.
          </p>
          <ZButton variant="secondary" onClick={() => void crew.refresh()}>
            Check again
          </ZButton>
        </div>
      ) : null}
    </HandoverAcceptGate>
  );
}
