import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';

export default function PlantProduction({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [data, setData] = useState(null);
  const [process, setProcess] = useState('');
  const [machine, setMachine] = useState('');
  const [drill, setDrill] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prod, dd] = await Promise.all([
          plantReportsApi.production(7),
          plantReportsApi.drilldown({
            metric: 'production',
            process: process || undefined,
            machine: machine || undefined,
          }),
        ]);
        if (!cancelled) {
          setData(prod);
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
  }, [process, machine]);

  return (
    <PlantShell
      title="Production"
      subtitle="Output by process / machine — drill stays in plant context"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}

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

        {data?.daily ? (
          <section className="ph-panel">
            <h2 className="ph-panel__title">Today TM</h2>
            <table className="ph-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Prime MT</th>
                  <th>Raw MT</th>
                  <th>Yield %</th>
                </tr>
              </thead>
              <tbody>
                {(data.daily.tm ?? []).map((r) => (
                  <tr key={r.machineCode}>
                    <td className="mono">{r.machineCode}</td>
                    <td>{r.primeMt}</td>
                    <td>{r.rawMt}</td>
                    <td>{r.yieldPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.daily.tm?.length ? <p className="ph-empty">No TM output today.</p> : null}
          </section>
        ) : null}
      </div>
    </PlantShell>
  );
}
