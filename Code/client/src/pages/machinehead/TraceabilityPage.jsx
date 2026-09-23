import { useState } from 'react';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZButton, ZInput, ZSelect } from '../../ui';

export default function TraceabilityPage({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [process, setProcess] = useState('FUR');
  const [wo, setWo] = useState('');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState(null);

  async function search() {
    setMsg(null);
    try {
      const q = new URLSearchParams({ process });
      if (wo.trim()) q.set('workOrderNo', wo.trim());
      const data = await apiRequest(`/genealogy/upstream?${q}`);
      setRows(data?.items ?? data ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Search failed');
    }
  }

  async function open(id) {
    try {
      setDetail(await apiRequest(`/genealogy/${id}`));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Detail failed');
    }
  }

  return (
    <MachineHeadShell
      title="Trace"
      subtitle="Upstream lots and genealogy"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <section className="mh-panel">
          <h2 className="mh-panel__title">Search</h2>
          <div className="mh-form-grid">
            <label>
              To process
              <ZSelect value={process} onChange={(e) => setProcess(e.target.value)}>
                {['TM', 'FUR', 'STP', 'DRW', 'SWG'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </ZSelect>
            </label>
            <label>
              Work order
              <ZInput value={wo} onChange={(e) => setWo(e.target.value)} placeholder="Optional" />
            </label>
          </div>
          <ZButton variant="primary" onClick={() => void search()}>
            Search
          </ZButton>
        </section>
        <section className="mh-panel">
          <h2 className="mh-panel__title">Results</h2>
          <table className="mh-table">
            <thead>
              <tr>
                <th>Lot / id</th>
                <th>WO</th>
                <th>From</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(rows) ? rows : []).map((r) => (
                <tr key={r.id ?? r.materialLotId}>
                  <td className="mono">{r.id ?? r.materialLotId}</td>
                  <td className="mono">{r.workOrderNo ?? '—'}</td>
                  <td>{r.fromProcess ?? r.processCode ?? '—'}</td>
                  <td>
                    <ZButton onClick={() => void open(r.id ?? r.materialLotId)}>Open</ZButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="mh-empty">No rows — run a search.</p> : null}
          {detail ? <pre className="mh-json">{JSON.stringify(detail, null, 2)}</pre> : null}
        </section>
      </div>
    </MachineHeadShell>
  );
}
