import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/layout/admin';
import { plantReportsApi } from '../../api/plantReportsApi';

/** Audit trail inside Admin shell (same data as /plant/audit). */
export default function AdminAuditPage({ roleLabel, onLogout, firstFloorPath }) {
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
    <AdminShell
      title="Audit trail"
      subtitle="User, review, and export change history"
      roleLabel={roleLabel}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      {error ? <div className="error-strip">{error}</div> : null}
      <section className="admin-panel">
        <table className="admin-table">
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
                <td className="muted">{e.at ? String(e.at) : '—'}</td>
                <td>{e.action}</td>
                <td className="mono">
                  {e.entityType}/{e.entityId || '—'}
                </td>
                <td>{e.actorUsername || e.actorUserId || 'system'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length ? <p className="admin-empty">No audit events yet</p> : null}
      </section>
    </AdminShell>
  );
}
