import OperatorNavRail from './OperatorNavRail';
import StatusRail from './StatusRail';
import OfflineBanner from './OfflineBanner';

export default function OperatorShell({
  nav,
  onNavChange,
  showAdmin,
  onLogout,
  onNew,
  navItems,
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
  stoppageBanner,
  jobActive,
  actionRail,
  children,
}) {
  return (
    <div className="operator-root">
      <OperatorNavRail
        nav={nav}
        onNavChange={onNavChange}
        showAdmin={showAdmin}
        onLogout={onLogout}
        onNew={onNew}
        items={navItems}
      />

      <div className={`content-column ${jobActive && actionRail ? 'content-column--with-rail' : ''}`}>
        <StatusRail
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
          onReadings={onReadings}
          onManualStop={onManualStop}
          manualStopDisabled={manualStopDisabled}
          onEndShift={onEndShift}
          endShiftDisabled={endShiftDisabled}
          onConsumption={onConsumption}
          consumptionDisabled={consumptionDisabled}
          extraRight={extraRight}
        />
        <OfflineBanner />
        {stoppageBanner}
        <main className="main-canvas">
          <div className="main-canvas__scroll">{children}</div>
        </main>
      </div>

      {jobActive && actionRail ? actionRail : null}
    </div>
  );
}
