import {
  HandoverLockedField,
  HandoverSectionHeader,
  ProcessOutgoingHandoverShell,
} from '../../components/process/ProcessOutgoingHandoverShell';
import { useHandoverPreview } from '../../hooks/useHandoverState';

export default function FurOutgoingHandoverPage({ machineCode, cancelPath }) {
  const code = machineCode || 'RHF-03';
  const { data: preview } = useHandoverPreview(code);
  const openWork = preview?.productionSummary?.openWork ?? [];
  const stoppages = preview?.openStoppages ?? [];

  return (
    <ProcessOutgoingHandoverShell
      machineCode={code}
      title={preview?.machineName ?? 'Furnace'}
      loadingLabel="Loading furnace handover…"
      cancelPath={cancelPath || '/fur'}
      footerLabels={{ submit: 'Submit Handover & Sign Out' }}
    >
      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Shift Summary" locked />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          <HandoverLockedField label="Date" value={preview?.shift?.prodDate} />
          <HandoverLockedField label="Shift" value={preview?.shift?.shiftCode} />
          <HandoverLockedField label="Machine" value={preview?.machineName ?? code} />
          <HandoverLockedField label="Process" value={preview?.processCode ?? 'FUR'} />
          <HandoverLockedField label="Open charges" value={openWork.length} />
          <HandoverLockedField label="Open stoppages" value={stoppages.length} />
        </div>
      </section>

      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Zone / lot status" locked />
        {!openWork.length ? (
          <p className="muted">No open furnace charges on this machine.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {openWork.map((w) => (
              <li key={w.id}>
                {w.charge_no} · {w.status}
                {w.work_order_no ? ` · WO ${w.work_order_no}` : ''}
                {w.total_mt != null ? ` · ${w.total_mt} MT` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          Confirm zone setpoints and gas / daily consumption sign-off in remarks if anything is atypical.
        </p>
      </section>
    </ProcessOutgoingHandoverShell>
  );
}
