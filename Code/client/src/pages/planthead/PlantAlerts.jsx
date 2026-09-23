import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function PlantAlerts({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dash = await plantReportsApi.dashboard(7);
        if (!cancelled) setAlerts(dash?.alerts ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PlantShell
      title="Alerts"
      subtitle="Rule-based operational exceptions (not PLC alarms)"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}
        <section className="ph-panel">
          <h2 className="ph-panel__title">Active alerts ({alerts.length})</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Code</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.code} className={a.severity === 'warn' ? 'ph-alert--warn' : ''}>
                  <td>
                    <span className="ph-status-chip">{a.severity}</span>
                  </td>
                  <td className="mono">{a.code}</td>
                  <td>{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!alerts.length ? <p className="ph-empty">No active alerts.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
