import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';
import { ParetoBar } from '../../components/charts';

const WINDOWS = [7, 14, 30];

export default function PlantDefects({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [windowDays, setWindowDays] = useState(14);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await plantReportsApi.defects(windowDays);
        if (!cancelled) {
          setData(d);
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

  const pareto = (data?.topDefects ?? []).map((d) => ({
    label: d.label || d.code,
    value: d.count,
    mt: d.mt,
    code: d.code,
  }));

  return (
    <PlantShell
      title="Defects"
      subtitle={`Top defects and scrap · ${windowDays}-day window`}
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
          Window {data?.windowDays ?? windowDays}d · Scrap MT {data?.scrapMt ?? '—'}
        </p>

        <div className="ph-graph-grid">
          <ParetoBar
            className="chart-frame--wide"
            title="Defect Pareto"
            subtitle="Tube Mill defects"
            data={pareto}
            nameKey="label"
            valueKey="value"
            error={error}
          />
        </div>

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
