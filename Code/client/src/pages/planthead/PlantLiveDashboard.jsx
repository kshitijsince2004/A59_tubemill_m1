import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';
import { PROCESS_META } from '../../lib/roleHome';
import { ZSelect } from '../../ui';

export default function PlantLiveDashboard({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const processFilter = searchParams.get('process') || '';
  const [dash, setDash] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await plantReportsApi.dashboard(1);
        if (!cancelled) {
          setDash(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Live load failed');
      }
    }
    void load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const byProcess = dash?.byProcess ?? {};
  const kpi = dash?.kpi ?? {};
  const rows = useMemo(() => {
    if (!processFilter) return PROCESS_META;
    return PROCESS_META.filter((p) => p.id === processFilter);
  }, [processFilter]);

  return (
    <PlantShell
      title="Live"
      subtitle="Plant status from capture DB aggregates (not PLC) — refreshes every 30s"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="ph-kpi-strip">
          <div className="ph-kpi">
            <span className="ph-kpi__label">Running</span>
            <strong>{kpi.machinesRunning ?? 0}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Open</span>
            <strong>{kpi.machinesOpen ?? 0}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Hold</span>
            <strong>{kpi.machinesHold ?? 0}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Machines</span>
            <strong>{kpi.machinesTotal ?? 0}</strong>
          </div>
        </div>

        <div className="ph-toolbar">
          <label>
            Process
            <ZSelect
              value={processFilter}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setSearchParams({ process: v });
                else setSearchParams({});
              }}
            >
              <option value="">All</option>
              {PROCESS_META.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </ZSelect>
          </label>
          <Link to="/plant/production">Production drill-down</Link>
        </div>

        <section className="ph-panel">
          <h2 className="ph-panel__title">Process board</h2>
          <table className="ph-table">
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
              {rows.map((p) => {
                const s = byProcess[p.id] ?? { open: 0, running: 0, submitted: 0, hold: 0 };
                const live = Boolean(s.running);
                return (
                  <tr key={p.id} className={processFilter === p.id ? 'is-highlight' : ''}>
                    <td>
                      <strong>{p.label}</strong>
                      <span className="muted"> · {p.id}</span>
                    </td>
                    <td className="mono">{p.machineCode}</td>
                    <td>
                      <span className={`ph-status-chip${live ? ' is-live' : ''}`}>
                        {live ? 'Running' : 'Idle'}
                      </span>
                    </td>
                    <td>{s.open ?? 0}</td>
                    <td>{s.running ?? 0}</td>
                    <td>{s.submitted ?? 0}</td>
                    <td>{s.hold ?? 0}</td>
                    <td>
                      <Link to={`/plant/production`}>Details</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </PlantShell>
  );
}
