import {
  HandoverLockedField,
  HandoverSectionHeader,
  ProcessOutgoingHandoverShell,
} from '../../components/process/ProcessOutgoingHandoverShell';
import { useHandoverPreview } from '../../hooks/useHandoverState';

export default function DrwOutgoingHandoverPage({ machineCode, cancelPath }) {
  const code = machineCode || 'DB-10T';
  const { data: preview } = useHandoverPreview(code);
  const openWork = preview?.productionSummary?.openWork ?? [];
  const stoppages = preview?.openStoppages ?? [];

  return (
    <ProcessOutgoingHandoverShell
      machineCode={code}
      title={preview?.machineName ?? 'Draw Bench'}
      loadingLabel="Loading draw bench handover…"
      cancelPath={cancelPath || '/drw'}
      footerLabels={{ submit: 'Submit Handover & Sign Out' }}
    >
      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Shift Summary" locked />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          <HandoverLockedField label="Date" value={preview?.shift?.prodDate} />
          <HandoverLockedField label="Shift" value={preview?.shift?.shiftCode} />
          <HandoverLockedField label="Machine" value={preview?.machineName ?? code} />
          <HandoverLockedField label="Process" value={preview?.processCode ?? 'DRW'} />
          <HandoverLockedField label="Open lots" value={openWork.length} />
          <HandoverLockedField label="Open stoppages" value={stoppages.length} />
        </div>
      </section>

      <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
        <HandoverSectionHeader title="Tooling / pass state" locked />
        {!openWork.length ? (
          <p className="muted">No open draw lots on this bench.</p>
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
          Record die / plug / pass progress and any tooling issues for the incoming operator.
        </p>
      </section>
    </ProcessOutgoingHandoverShell>
  );
}
