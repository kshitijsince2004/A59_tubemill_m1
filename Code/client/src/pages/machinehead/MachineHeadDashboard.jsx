import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { PROCESS_META, allowedProcesses } from '../../lib/roleHome';

const DESK_PATH = {
  TM: '/machine-head/tm/live',
  FUR: '/machine-head/fur/live',
  STP: '/machine-head/stp/live',
  DRW: '/machine-head/drw/live',
  SWG: '/machine-head/swg/live',
};

export default function MachineHeadDashboard({
  user,
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [dash, setDash] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [error, setError] = useState(null);

  const processes = useMemo(() => {
    if (!user) return PROCESS_META;
    const allowed = allowedProcesses(user);
    return allowed.length ? allowed : PROCESS_META;
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, pending] = await Promise.all([
          apiRequest('/reports/machine-head'),
          apiRequest('/reports/machine-head/pending').catch(() => null),
        ]);
        if (!cancelled) {
          setDash(data);
          const items = pending?.items ?? pending ?? [];
          setPendingCount(Array.isArray(items) ? items.length : null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load desk');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byProcess = dash?.byProcess ?? {};
  const scope = dash?.machineScope;
  const submittedTotal = processes.reduce((n, p) => n + (byProcess[p.id]?.submitted ?? 0), 0);
  const runningTotal = processes.reduce((n, p) => n + (byProcess[p.id]?.running ?? 0), 0);
  const holdTotal = processes.reduce((n, p) => n + (byProcess[p.id]?.hold ?? 0), 0);
  const subtitle = [
    'Machine-scoped status across your assigned processes',
    scope != null
      ? Array.isArray(scope)
        ? `Scope: ${scope.length ? scope.join(', ') : 'all accessible'}`
        : `Scope: ${String(scope)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <MachineHeadShell
      title="Desk"
      subtitle={subtitle}
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="mh-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="mh-kpi-strip">
          <div className="mh-kpi">
            <span className="mh-kpi__label">Processes</span>
            <strong>{processes.length}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Running</span>
            <strong>{runningTotal}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Submitted</span>
            <strong>{submittedTotal}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Hold</span>
            <strong>{holdTotal}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Pending review</span>
            <strong>{pendingCount ?? submittedTotal}</strong>
          </div>
        </div>

        <section className="mh-panel">
          <div className="mh-panel__head">
            <h2 className="mh-panel__title">Process status</h2>
            <Link to="/machine-head/shift-review">Review queue</Link>
          </div>
          <table className="mh-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Line</th>
                <th>Status</th>
                <th>Open</th>
                <th>Running</th>
                <th>Submitted</th>
                <th>Hold</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => {
                const s = byProcess[p.id] ?? { open: 0, running: 0, submitted: 0, hold: 0 };
                const chip =
                  (s.hold ?? 0) > 0 ? 'is-hold' : (s.running ?? 0) > 0 ? 'is-live' : '';
                const label =
                  (s.hold ?? 0) > 0 ? 'Hold' : (s.running ?? 0) > 0 ? 'Running' : 'Idle';
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.label}</strong>
                      <span className="muted"> · {p.id}</span>
                    </td>
                    <td className="mono">{p.machineCode}</td>
                    <td>
                      <span className={`mh-status-chip ${chip}`.trim()}>{label}</span>
                    </td>
                    <td>{s.open ?? 0}</td>
                    <td>{s.running ?? 0}</td>
                    <td>{s.submitted ?? 0}</td>
                    <td>{s.hold ?? 0}</td>
                    <td>
                      <Link to={DESK_PATH[p.id]}>Open desk</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!processes.length ? <p className="mh-empty">No processes in your access.</p> : null}
        </section>

        <div className="mh-link-row">
          <Link to="/machine-head/shift-review">
            Shift review{pendingCount != null ? ` (${pendingCount})` : ''}
          </Link>
          <Link to="/order-assignment">Orders</Link>
          <Link to="/machine-head/dpr-export">Exports</Link>
        </div>
      </div>
    </MachineHeadShell>
  );
}
