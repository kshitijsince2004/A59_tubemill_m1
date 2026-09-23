import { useState } from 'react';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { getAccessToken } from '../../lib/authStore';
import { ZButton, ZInput, ZSelect } from '../../ui';

const REPORTS = [
  { process: 'TM', report: 'TM-FT-02', endpoint: '/api/tubemill/export', needsId: true },
  { process: 'FUR', report: 'ANN-FT-01', endpoint: '/api/furnace/export', needsId: true },
  { process: 'STP', report: 'STP-FT-01A', endpoint: '/api/stp/export', needsId: true },
  { process: 'DRW', report: 'DB-FT-01', endpoint: '/api/drawbench/export', needsId: true },
  { process: 'DRW', report: 'DB-FT-03', endpoint: '/api/drawbench/export', needsId: true },
  { process: 'DRW', report: 'DB-FT-08', endpoint: '/api/drawbench/export', needsId: true },
];

async function downloadXlsx(url, body) {
  const headers = { 'Content-Type': 'application/json', 'st-auth-mode': 'header' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const role = localStorage.getItem('a59-role');
  if (role) headers['x-app-role'] = role;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${body.report || 'export'}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function MachineDprExportPage({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [report, setReport] = useState(REPORTS[0].report);
  const [recordId, setRecordId] = useState('');
  const [msg, setMsg] = useState(null);
  const [history, setHistory] = useState([]);

  const meta = REPORTS.find((r) => r.report === report) ?? REPORTS[0];

  async function run() {
    setMsg(null);
    try {
      if (!recordId.trim()) throw new Error('Enter run/lot id');
      await downloadXlsx(meta.endpoint, { report: meta.report, id: recordId.trim() });
      const entry = { at: new Date().toISOString(), report: meta.report, id: recordId.trim() };
      setHistory((h) => [entry, ...h].slice(0, 20));
      setMsg('Download started');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed');
    }
  }

  return (
    <MachineHeadShell
      title="Exports"
      subtitle="Machine-scoped FT / XLSX — recent list is this browser session only (Plant has persisted history)"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <section className="mh-panel">
          <h2 className="mh-panel__title">FT export</h2>
          <div className="mh-form-grid">
            <label>
              Report
              <ZSelect value={report} onChange={(e) => setReport(e.target.value)}>
                {REPORTS.map((r) => (
                  <option key={r.report} value={r.report}>
                    {r.process} · {r.report}
                  </option>
                ))}
              </ZSelect>
            </label>
            <label>
              Run / lot id
              <ZInput value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="UUID" />
            </label>
          </div>
          <ZButton variant="primary" onClick={() => void run()}>
            Export XLSX
          </ZButton>
        </section>
        <section className="mh-panel">
          <h2 className="mh-panel__title">Recent (this session)</h2>
          <table className="mh-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Report</th>
                <th>Id</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={`${h.at}-${i}`}>
                  <td className="muted">{h.at}</td>
                  <td className="mono">{h.report}</td>
                  <td className="mono">{h.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length ? <p className="mh-empty">No exports yet this session.</p> : null}
        </section>
      </div>
    </MachineHeadShell>
  );
}
