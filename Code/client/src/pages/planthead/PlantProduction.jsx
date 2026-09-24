import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';
import { TrendLine, BarSeries } from '../../components/charts';

const WINDOWS = [7, 14, 30];

export default function PlantProduction({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [windowDays, setWindowDays] = useState(7);
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState(null);
  const [stages, setStages] = useState(null);
  const [process, setProcess] = useState('');
  const [machine, setMachine] = useState('');
  const [drill, setDrill] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prod, tr, st, dd] = await Promise.all([
          plantReportsApi.production(windowDays),
          plantReportsApi.trend(windowDays),
          plantReportsApi.stages(windowDays),
          plantReportsApi.drilldown({
            metric: 'production',
            process: process || undefined,
            machine: machine || undefined,
          }),
        ]);
        if (!cancelled) {
          setData(prod);
          setTrend(tr);
          setStages(st);
          setDrill(dd);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays, process, machine]);

  const series = trend?.series ?? [];
  const stageRows = (stages?.stages ?? []).map((s) => ({
    name: s.process,
    mt: s.outputMt != null ? s.outputMt : 0,
    count: s.count ?? 0,
  }));

  return (
    <PlantShell
      title="Production"
      subtitle={`Output by process / machine — ${windowDays}-day window`}
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

        <div className="ph-kpi-strip">
          <div className="ph-kpi">
            <span className="ph-kpi__label">Prime MT</span>
            <strong>{data?.kpi?.todayMt ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Yield %</span>
            <strong>{data?.kpi?.yieldPct ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">OEE (est.)</span>
            <strong>{data?.kpi?.oee ?? '—'}</strong>
          </div>
        </div>

        <div className="ph-graph-grid">
          <TrendLine
            className="chart-frame--wide"
            title="Prime MT trend"
            data={series}
            xKey="date"
            yKey="primeMt"
            yLabel="Prime MT"
            area
            error={error}
          />
          <TrendLine
            title="Yield %"
            subtitle="Target 90%"
            data={series}
            xKey="date"
            yKey="yieldPct"
            yLabel="Yield %"
            target={90}
            error={error}
          />
          <BarSeries
            title="Stage throughput"
            subtitle="MT where available"
            data={stageRows}
            xKey="name"
            series={[
              { key: 'mt', label: 'Output MT' },
              { key: 'count', label: 'Count' },
            ]}
            layout="vertical"
            error={error}
          />
        </div>

        <div className="ph-toolbar">
          <span className="ph-inline-msg">
            Level: {drill?.level ?? '—'}
            {process ? ` · Process ${process}` : ''}
            {machine ? ` · Machine ${machine}` : ''}
          </span>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setProcess('');
              setMachine('');
            }}
          >
            Reset drill
          </button>
        </div>

        <section className="ph-panel">
          <h2 className="ph-panel__title">Drill-down</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Open</th>
                <th>Running</th>
                <th>Submitted</th>
                <th>Hold</th>
                <th>MT / Status</th>
              </tr>
            </thead>
            <tbody>
              {(drill?.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => {
                        if (drill.level === 'process') {
                          setProcess(item.id);
                          setMachine('');
                        } else if (drill.level === 'machine') {
                          setMachine(item.id);
                        }
                      }}
                    >
                      {item.label || item.id}
                    </button>
                  </td>
                  <td>{item.open ?? '—'}</td>
                  <td>{item.running ?? '—'}</td>
                  <td>{item.submitted ?? '—'}</td>
                  <td>{item.hold ?? '—'}</td>
                  <td className="muted">
                    {item.mt != null ? `${item.mt} MT` : item.status || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!drill?.items?.length ? <p className="ph-empty">No rows for this drill level.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
