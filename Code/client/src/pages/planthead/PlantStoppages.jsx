import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';
import { ParetoBar, TrendLine } from '../../components/charts';

const WINDOWS = [7, 14, 30];

export default function PlantStoppages({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [windowDays, setWindowDays] = useState(14);
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, tr] = await Promise.all([
          plantReportsApi.downtime(windowDays),
          plantReportsApi.trend(windowDays),
        ]);
        if (!cancelled) {
          setData(d);
          setTrend(tr);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  const pareto = (data?.topStoppages ?? []).map((d) => ({
    label: d.label || d.code,
    value: d.minutes,
    code: d.code,
  }));

  return (
    <PlantShell
      title="Downtime"
      subtitle={`Stoppage / loss analysis · ${windowDays}-day window`}
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="ph-window-pills" role="group" aria-label="Window days">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              className={windowDays === d ? 'is-active' : ''}
              onClick={() => setWindowDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>

        <p className="ph-inline-msg">
          Window {data?.windowDays ?? windowDays}d · Total {data?.downtimeMin ?? 0} min · Open{' '}
          {data?.openStoppages ?? 0}
        </p>

        <div className="ph-graph-grid">
          <TrendLine
            title="Daily downtime"
            subtitle="Minutes per day"
            data={trend?.series ?? []}
            xKey="date"
            yKey="downtimeMin"
            yLabel="Min"
            area
            error={error}
          />
          <ParetoBar
            title="Downtime Pareto"
            subtitle="Top stoppage minutes"
            data={pareto}
            nameKey="label"
            valueKey="value"
            error={error}
          />
        </div>

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
