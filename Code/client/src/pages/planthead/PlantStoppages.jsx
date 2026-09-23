import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function PlantStoppages({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await plantReportsApi.downtime(14);
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
      title="Downtime"
      subtitle="Stoppage / loss analysis plant-wide"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}
        <p className="ph-inline-msg">
          Window {data?.windowDays ?? 14}d · Total {data?.downtimeMin ?? 0} min · Open{' '}
          {data?.openStoppages ?? 0}
        </p>
        <section className="ph-panel">
          <h2 className="ph-panel__title">Top stoppages</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Stoppage</th>
                <th>Code</th>
                <th>Count</th>
                <th>Minutes</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topStoppages ?? []).map((d) => (
                <tr key={d.code}>
                  <td>{d.label}</td>
                  <td className="mono">{d.code}</td>
                  <td>{d.count}</td>
                  <td>{d.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.topStoppages?.length ? <p className="ph-empty">No stoppages recorded.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
