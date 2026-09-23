import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlantShell } from '../../components/layout/planthead';
import { downloadPlantBlob, plantReportsApi } from '../../api/plantReportsApi';
import { ZButton, ZInput, ZSelect } from '../../ui';

const LINE_LOGS = [
  { process: 'FUR', label: 'Furnace line log' },
  { process: 'STP', label: 'STP line log' },
  { process: 'DRW', label: 'Draw Bench line log' },
];

const FT_DEFAULT = [
  { process: 'TM', report: 'TM-FT-02' },
  { process: 'FUR', report: 'ANN-FT-01' },
  { process: 'STP', report: 'STP-FT-01A' },
  { process: 'DRW', report: 'DB-FT-01' },
];

export default function PlantDprExport({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [report, setReport] = useState(FT_DEFAULT[0].report);
  const [recordId, setRecordId] = useState('');
  const [lineProcess, setLineProcess] = useState('FUR');
  const [msg, setMsg] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await plantReportsApi.exportHistory();
        if (!cancelled) setHistory(Array.isArray(h) ? h : []);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function exportFt() {
    setMsg(null);
    try {
      if (!recordId.trim()) throw new Error('Enter run/lot id');
      const name = await downloadPlantBlob('/api/plant/exports/ft', {
        report,
        id: recordId.trim(),
      });
      setMsg(`Downloaded ${name}`);
      setHistory((h) =>
        [{ createdAt: new Date().toISOString(), reportCode: report, fileName: name }, ...h].slice(0, 30)
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed');
    }
  }

  async function exportLineLog() {
    setMsg(null);
    try {
      const name = await downloadPlantBlob('/api/plant/exports/line-log', {
        process: lineProcess,
        windowDays: 7,
      });
      setMsg(`Downloaded ${name}`);
      setHistory((h) =>
        [
          { createdAt: new Date().toISOString(), reportCode: `LINE-LOG-${lineProcess}`, fileName: name },
          ...h,
        ].slice(0, 30)
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Line log failed');
    }
  }

  return (
    <PlantShell
      title="Exports"
      subtitle="Plant-wide FT reports and A-59 line logs"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <Link to="/plant/exports/history" className="ph-consoles__btn">
          Full history
        </Link>
      }
    >
      <div className="ph-console">
        {msg ? <p className="ph-inline-msg">{msg}</p> : null}

        <section className="ph-panel">
          <h2 className="ph-panel__title">FT report (by record)</h2>
          <div className="ph-form-grid">
            <label>
              Report
              <ZSelect value={report} onChange={(e) => setReport(e.target.value)}>
                {FT_DEFAULT.map((r) => (
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
          <ZButton variant="primary" onClick={() => void exportFt()}>
            Export FT XLSX
          </ZButton>
        </section>

        <section className="ph-panel">
          <h2 className="ph-panel__title">Line log (plant-wide CSV)</h2>
          <div className="ph-form-grid">
            <label>
              Process
              <ZSelect value={lineProcess} onChange={(e) => setLineProcess(e.target.value)}>
                {LINE_LOGS.map((r) => (
                  <option key={r.process} value={r.process}>
                    {r.label}
                  </option>
                ))}
              </ZSelect>
            </label>
          </div>
          <ZButton variant="primary" onClick={() => void exportLineLog()}>
            Export line log
          </ZButton>
        </section>

        <section className="ph-panel">
          <div className="ph-panel__head">
            <h2 className="ph-panel__title">Recent</h2>
            <Link to="/plant/exports/history">History</Link>
          </div>
          <table className="ph-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Report</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={`${h.createdAt}-${i}`}>
                  <td className="muted">{h.createdAt ? String(h.createdAt) : ''}</td>
                  <td className="mono">{h.reportCode}</td>
                  <td>{h.fileName || h.label || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length ? <p className="ph-empty">No exports yet.</p> : null}
        </section>
      </div>
    </PlantShell>
  );
}
