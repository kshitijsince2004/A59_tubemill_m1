import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { adminApi } from '../../api/adminApi';

export default function PlantSetupPage({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [machines, setMachines] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await adminApi.listMachines();
        if (!cancelled) setMachines(m);
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
      title="Lines"
      subtitle="Read-only machine / line registry — Admin owns master writes"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}
        <section className="ph-panel">
          <h2 className="ph-panel__title">Machines ({machines.length})</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Process</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.machineCode}>
                  <td className="mono">{m.machineCode}</td>
                  <td>{m.label}</td>
                  <td>{m.processCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!machines.length ? <p className="ph-empty">No machines.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
