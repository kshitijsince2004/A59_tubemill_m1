import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function PlantHeadDashboard({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [dash, setDash] = useState(null);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, dd] = await Promise.all([
          plantReportsApi.dashboard(7),
          plantReportsApi.drilldown({ metric: 'production' }),
        ]);
        if (!cancelled) {
          setDash(data);
          setDrill(dd);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load plant dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpi = dash?.kpi ?? {};
  const alertCount = dash?.alerts?.length ?? 0;
  const processRows = drill?.items ?? Object.keys(dash?.byProcess ?? {}).map((id) => ({ id, label: id }));

  return (
    <PlantShell
      title="Overview"
      subtitle="Plant-wide KPIs across Tube Mill → Furnace → STP → Draw Bench (7-day window)"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="ph-kpi-strip">
          <div className="ph-kpi">
            <span className="ph-kpi__label">Prime MT (7d)</span>
            <strong>{kpi.todayMt ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Yield %</span>
            <strong>{kpi.yieldPct ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">OEE (est.)</span>
            <strong>{kpi.oee ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Downtime min</span>
            <strong>{kpi.downtimeMin ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Backlog orders</span>
            <strong>{kpi.backlogOrders ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Holds</span>
            <strong>{kpi.machinesHold ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Alerts</span>
            <strong>{alertCount}</strong>
          </div>
        </div>

        <section className="ph-panel">
          <div className="ph-panel__head">
            <h2 className="ph-panel__title">Process status</h2>
            <Link to="/plant/live">Live board</Link>
          </div>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Open</th>
                <th>Running</th>
                <th>Submitted</th>
                <th>Hold</th>
              </tr>
            </thead>
            <tbody>
              {processRows.map((item) => {
                const id = item.id ?? item;
                const label = item.label ?? id;
                const s = dash?.byProcess?.[id] ?? item;
                return (
                  <tr key={id}>
                    <td>
                      <Link to={`/plant/live?process=${encodeURIComponent(id)}`}>{label}</Link>
                      <span className="muted"> · {id}</span>
                    </td>
                    <td>{s.open ?? 0}</td>
                    <td>{s.running ?? 0}</td>
                    <td>{s.submitted ?? 0}</td>
                    <td>{s.hold ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!processRows.length ? <p className="ph-empty">No process rows yet.</p> : null}
        </section>

        <div className="ph-two-col">
          <section className="ph-panel">
            <div className="ph-panel__head">
              <h2 className="ph-panel__title">Top defects</h2>
              <Link to="/plant/defect-intelligence">All</Link>
            </div>
            <table className="ph-table">
              <thead>
                <tr>
                  <th>Defect</th>
                  <th>Count</th>
                  <th>MT</th>
                </tr>
              </thead>
              <tbody>
                {(dash?.topDefects ?? []).map((d) => (
                  <tr key={d.code}>
                    <td>{d.label}</td>
                    <td>{d.count}</td>
                    <td>{d.mt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dash?.topDefects?.length ? <p className="ph-empty">No defects in window.</p> : null}
          </section>
          <section className="ph-panel">
            <div className="ph-panel__head">
              <h2 className="ph-panel__title">Top stoppages</h2>
              <Link to="/plant/downtime-intelligence">All</Link>
            </div>
            <table className="ph-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Count</th>
                  <th>Min</th>
                </tr>
              </thead>
              <tbody>
                {(dash?.topStoppages ?? []).map((d) => (
                  <tr key={d.code}>
                    <td>{d.label}</td>
                    <td>{d.count}</td>
                    <td>{d.minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dash?.topStoppages?.length ? <p className="ph-empty">No stoppages in window.</p> : null}
          </section>
        </div>

        <div className="ph-link-row">
          <Link to="/plant/production">Production</Link>
          <Link to="/plant/orders">Orders</Link>
          <Link to="/plant/alerts">Alerts ({alertCount})</Link>
          <Link to="/plant/dpr-export">Exports</Link>
        </div>
      </div>
    </PlantShell>
  );
}
