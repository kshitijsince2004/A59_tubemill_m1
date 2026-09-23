import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function PlantDefects({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await plantReportsApi.defects(14);
        if (!cancelled) setData(d);
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
      title="Defects"
      subtitle="Top defects and scrap across the plant window"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}
        <p className="ph-inline-msg">
          Window {data?.windowDays ?? 14}d · Scrap MT {data?.scrapMt ?? '—'}
        </p>
        <section className="ph-panel">
          <h2 className="ph-panel__title">Top defects</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Defect</th>
                <th>Code</th>
                <th>Events</th>
                <th>MT</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topDefects ?? []).map((d) => (
                <tr key={d.code}>
                  <td>{d.label}</td>
                  <td className="mono">{d.code}</td>
                  <td>{d.count}</td>
                  <td>{d.mt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.topDefects?.length ? <p className="ph-empty">No defects recorded.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
