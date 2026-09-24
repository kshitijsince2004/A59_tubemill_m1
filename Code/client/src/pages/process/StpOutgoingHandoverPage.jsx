import {
  HandoverLockedField,
  HandoverSectionHeader,
  ProcessOutgoingHandoverShell,
} from '../../components/process/ProcessOutgoingHandoverShell';
import { useHandoverPreview } from '../../hooks/useHandoverState';

export default function StpOutgoingHandoverPage({ machineCode, cancelPath }) {
  const code = machineCode || 'STP-LINE';
  const { data: preview } = useHandoverPreview(code);
  const openWork = preview?.productionSummary?.openWork ?? [];
  const stoppages = preview?.openStoppages ?? [];

  return (
    <ProcessOutgoingHandoverShell
      machineCode={code}
      title={preview?.machineName ?? 'STP'}
      loadingLabel="Loading STP handover…"
      cancelPath={cancelPath || '/stp'}
      footerLabels={{ submit: 'Submit Handover & Sign Out' }}
    >
      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Shift Summary" locked />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          <HandoverLockedField label="Date" value={preview?.shift?.prodDate} />
          <HandoverLockedField label="Shift" value={preview?.shift?.shiftCode} />
          <HandoverLockedField label="Machine" value={preview?.machineName ?? code} />
          <HandoverLockedField label="Process" value={preview?.processCode ?? 'STP'} />
          <HandoverLockedField label="Open lots" value={openWork.length} />
          <HandoverLockedField label="Open stoppages" value={stoppages.length} />
        </div>
      </section>

      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Bath / lot sign-off" locked />
        {!openWork.length ? (
          <p className="muted">No open STP lots on this line.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {openWork.map((w) => (
              <li key={w.id}>
                {w.lot_no} · {w.status}
                {w.work_order_no ? ` · WO ${w.work_order_no}` : ''}
                {w.qty_mt != null ? ` · ${w.qty_mt} MT` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          Note bath chemistry / stage state and any pending titration or chemical addition in outgoing notes.
        </p>
      </section>
    </ProcessOutgoingHandoverShell>
  );
}
