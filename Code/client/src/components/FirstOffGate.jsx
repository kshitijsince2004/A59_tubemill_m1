import { ZButton, ZBadge, ZSelect } from '../ui';

export default function FirstOffGate({
  firstOffStatus,
  machineHead,
  onMachineHeadChange,
  onPass,
  onFail,
  disabled,
  runState,
}) {
  if (runState !== 'FIRST_OFF_PENDING' && firstOffStatus !== 'PENDING') {
    return (
      <div className="panel">
        <h2>First-Off Gate</h2>
        <ZBadge tone={firstOffStatus === 'PASS' ? 'success' : 'danger'}>
          First-off: {firstOffStatus}
        </ZBadge>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>First-Off Gate</h2>
      <p style={{ color: 'var(--color-warning)', marginBottom: '1rem', fontWeight: 600 }}>
        Production counts as SCRAP until Machine Head records first-off PASS.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label>Machine Head / SIC</label>
        <ZSelect value={machineHead} onChange={(e) => onMachineHeadChange(e.target.value)}>
          <option value="MH-Ravi">MH — Ravi</option>
          <option value="MH-Meena">MH — Meena</option>
          <option value="MH-Anil">MH — Anil</option>
        </ZSelect>
      </div>
      <div className="btn-row">
        <ZButton variant="primary" disabled={disabled} onClick={onPass}>
          FIRST-OFF PASS
        </ZButton>
        <ZButton variant="danger" disabled={disabled} onClick={onFail}>
          FIRST-OFF FAIL
        </ZButton>
      </div>
    </div>
  );
}
