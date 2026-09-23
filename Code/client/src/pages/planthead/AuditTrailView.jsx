import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function AuditTrailView({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await plantReportsApi.audit(150);
        if (!cancelled) setEvents(Array.isArray(data) ? data : data?.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Audit failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PlantShell
      title="Audit"
      subtitle="User, review, and export change history"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}
        <section className="ph-panel">
          <h2 className="ph-panel__title">Events ({events.length})</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{e.at ? String(e.at) : ''}</td>
                  <td>{e.action}</td>
                  <td className="mono">
                    {e.entityType}/{e.entityId || '—'}
                  </td>
                  <td>{e.actorUsername || e.actorUserId || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!events.length ? <p className="ph-empty">No audit events yet.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
