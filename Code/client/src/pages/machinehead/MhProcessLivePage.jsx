import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZButton } from '../../ui';
import { PROCESS_META, processPath } from '../../lib/roleHome';

const PROCESS_LIVE = [
  { id: 'tm', code: 'TM' },
  { id: 'fur', code: 'FUR' },
  { id: 'stp', code: 'STP' },
  { id: 'drw', code: 'DRW' },
  { id: 'swg', code: 'SWG' },
];

export default function MhProcessLivePage({
  processId,
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const entry = PROCESS_LIVE.find((p) => p.id === processId) ?? PROCESS_LIVE[0];
  const meta = PROCESS_META.find((p) => p.id === entry.code) ?? PROCESS_META[0];
  const floor = processPath(meta.id);
  const [stats, setStats] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dash, pending] = await Promise.all([
          apiRequest('/reports/machine-head'),
          apiRequest('/reports/machine-head/pending').catch(() => null),
        ]);
        if (cancelled) return;
        setStats(dash?.byProcess?.[meta.id] ?? { open: 0, running: 0, submitted: 0, hold: 0 });
        const items = pending?.items ?? pending ?? [];
        const list = Array.isArray(items) ? items : [];
        setPendingCount(list.filter((it) => it.process === meta.id).length);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.id]);

  const s = stats ?? { open: 0, running: 0, submitted: 0, hold: 0 };

  return (
    <MachineHeadShell
      title={`${meta.label} desk`}
      subtitle="Machine-scoped counts from capture DB — open the floor for production capture (not PLC live)"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <Link to={floor}>
          <ZButton variant="primary">Open floor</ZButton>
        </Link>
      }
    >
      <div className="mh-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="mh-kpi-strip">
          <div className="mh-kpi">
            <span className="mh-kpi__label">Open</span>
            <strong>{s.open ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Running</span>
            <strong>{s.running ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Submitted</span>
            <strong>{s.submitted ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Hold</span>
            <strong>{s.hold ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Pending review</span>
            <strong>{pendingCount ?? s.submitted ?? 0}</strong>
          </div>
        </div>

        <section className="mh-panel">
          <h2 className="mh-panel__title">{meta.label} · {meta.machineCode}</h2>
          <p className="mh-panel__hint">
            Use Review for submitted approvals and Exports for FT reports. Capture and live boards stay on
            the operator floor.
          </p>
          <div className="mh-link-row">
            <Link to="/machine-head/shift-review">Shift review</Link>
            <Link to="/machine-head-dashboard">All processes</Link>
            <Link to={floor}>Floor capture</Link>
            <Link to="/machine-head/dpr-export">Exports</Link>
          </div>
        </section>
      </div>
    </MachineHeadShell>
  );
}
