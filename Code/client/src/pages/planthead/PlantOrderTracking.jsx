import { useEffect, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';
import { ZButton, ZInput } from '../../ui';

export default function PlantOrderTracking({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [orders, setOrders] = useState(null);
  const [coilNo, setCoilNo] = useState('');
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await plantReportsApi.orders();
        if (!cancelled) setOrders(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Orders failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runTrace() {
    setError(null);
    try {
      setTrace(await plantReportsApi.coilTrace(coilNo.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trace failed');
    }
  }

  return (
    <PlantShell
      title="Orders"
      subtitle="ERP released backlog and coil / lot journey across the line"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <section className="ph-panel">
          <h2 className="ph-panel__title">Open ERP orders ({orders?.orders?.length ?? 0})</h2>
          <table className="ph-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Grade</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {(orders?.orders ?? []).map((o) => (
                <tr key={o.workOrderNo}>
                  <td className="mono">{o.workOrderNo}</td>
                  <td>{o.status}</td>
                  <td>{o.customerCode || '—'}</td>
                  <td>{o.gradeCode || '—'}</td>
                  <td>{o.qty ?? o.qtyPieces ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders?.orders?.length ? <p className="ph-empty">No open orders.</p> : null}
        </section>

        <section className="ph-panel">
          <h2 className="ph-panel__title">Coil / lot traceability</h2>
          <div className="ph-form-grid">
            <label>
              Coil / lot / WO
              <ZInput value={coilNo} onChange={(e) => setCoilNo(e.target.value)} placeholder="Coil tag" />
            </label>
          </div>
          <ZButton variant="primary" onClick={() => void runTrace()}>
            Trace
          </ZButton>
          {trace ? (
            <div className="ph-two-col" style={{ marginTop: 12 }}>
              <div>
                <h3 className="ph-panel__title">Lots</h3>
                <table className="ph-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Process</th>
                      <th>Status</th>
                      <th>WO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(trace.lots ?? []).map((l) => (
                      <tr key={l.id}>
                        <td className="mono">{l.lotTag}</td>
                        <td>{l.currentProcess}</td>
                        <td>{l.status}</td>
                        <td className="mono">{l.workOrderNo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!trace.lots?.length ? <p className="ph-empty">No material lots.</p> : null}
              </div>
              <div>
                <h3 className="ph-panel__title">Journey</h3>
                <table className="ph-table">
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                      <th>At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(trace.journey ?? []).map((j, i) => (
                      <tr key={`${j.materialLotId}-${i}`}>
                        <td>{j.fromProcess}</td>
                        <td>{j.toProcess}</td>
                        <td className="muted">{j.handedAt ? String(j.handedAt) : ''}</td>
                      </tr>
                    ))}
                    {(trace.tmCoils ?? []).map((c) => (
                      <tr key={c.runId}>
                        <td colSpan={2}>
                          TM {c.coilTag} · run {c.runNo} · {c.millCode}
                        </td>
                        <td>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!trace.journey?.length && !trace.tmCoils?.length ? (
                  <p className="ph-empty">No handoffs.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PlantShell>
  );
}
