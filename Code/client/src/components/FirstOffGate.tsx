import { ZButton, ZBadge, ZSelect } from '../ui';

interface Props {
  firstOffStatus: string;
  supervisor: string;
  onSupervisorChange: (v: string) => void;
  onPass: () => void;
  onFail: () => void;
  disabled: boolean;
  runState: string;
}

export default function FirstOffGate({
  firstOffStatus,
  supervisor,
  onSupervisorChange,
  onPass,
  onFail,
  disabled,
  runState,
}: Props) {
  if (runState !== 'FIRST_OFF_PENDING' && firstOffStatus !== 'PENDING') {
    return (
      <div className="panel">
        <h2>First-Off Gate</h2>
        <ZBadge tone={firstOffStatus === 'PASS' ? 'success' : 'danger'}>First-off: {firstOffStatus}</ZBadge>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>First-Off Gate</h2>
      <p style={{ color: 'var(--color-warning)', marginBottom: '1rem', fontWeight: 600 }}>
        Production counts as SCRAP until SIC/QA approves first-off PASS.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label>Supervisor / SIC</label>
        <ZSelect value={supervisor} onChange={(e) => onSupervisorChange(e.target.value)}>
          <option value="SIC-Ravi">SIC — Ravi</option>
          <option value="QA-Meena">QA — Meena</option>
          <option value="SIC-Anil">SIC — Anil</option>
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
