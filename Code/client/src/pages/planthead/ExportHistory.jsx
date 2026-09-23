import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function ExportHistory({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await plantReportsApi.exportHistory();
        if (!cancelled) setHistory(Array.isArray(h) ? h : []);
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
      title="Export history"
      subtitle="Past plant DPR / FT / line-log jobs"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <Link to="/plant/dpr-export" className="ph-consoles__btn">
          Back to exports
        </Link>
      }
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}
        <section className="ph-panel">
          <h2 className="ph-panel__title">Jobs ({history.length})</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Report</th>
                <th>File</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id || `${h.createdAt}-${h.reportCode}`}>
                  <td className="muted">{h.createdAt ? String(h.createdAt) : ''}</td>
                  <td className="mono">{h.reportCode}</td>
                  <td>{h.fileName || h.label || ''}</td>
                  <td>{h.createdBy || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length ? <p className="ph-empty">No persisted export jobs yet.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
