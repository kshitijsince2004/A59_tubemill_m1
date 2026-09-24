import {
  HandoverLockedField,
  HandoverSectionHeader,
  ProcessOutgoingHandoverShell,
} from '../../components/process/ProcessOutgoingHandoverShell';
import { useHandoverPreview } from '../../hooks/useHandoverState';

export default function TmOutgoingHandoverPage({ machineCode, cancelPath }) {
  const code = machineCode || 'A-59';
  const { data: preview } = useHandoverPreview(code);
  const openWork = preview?.productionSummary?.openWork ?? [];
  const stoppages = preview?.openStoppages ?? [];

  return (
    <ProcessOutgoingHandoverShell
      machineCode={code}
      title={preview?.machineName ?? 'Tube Mill'}
      loadingLabel="Loading tube mill handover…"
      cancelPath={cancelPath || '/tm'}
      footerLabels={{ submit: 'Submit Handover & Sign Out' }}
    >
      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Shift Summary" locked />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          <HandoverLockedField label="Date" value={preview?.shift?.prodDate} />
          <HandoverLockedField label="Shift" value={preview?.shift?.shiftCode} />
          <HandoverLockedField label="Mill" value={preview?.machineName ?? code} />
          <HandoverLockedField label="Process" value={preview?.processCode ?? 'TM'} />
          <HandoverLockedField label="Open runs" value={openWork.length} />
          <HandoverLockedField label="Open stoppages" value={stoppages.length} />
        </div>
      </section>

      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Open runs" locked />
        {!openWork.length ? (
          <p className="muted">No open tube mill runs.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {openWork.map((w) => (
              <li key={w.id}>
                {w.run_no} · {w.run_state}/{w.status}
                {w.work_order_no ? ` · WO ${w.work_order_no}` : ''}
                {w.total_prime_mt != null ? ` · ${w.total_prime_mt} MT` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProcessOutgoingHandoverShell>
  );
}
