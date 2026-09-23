import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZButton, ZInput, ZSelect } from '../../ui';

export default function QualitySpecsPage({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [specs, setSpecs] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    void apiRequest('/quality/specs')
      .then((d) => setSpecs(d?.items ?? d ?? []))
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  return (
    <MachineHeadShell
      title="Quality"
      subtitle="Process quality specification sheets (QSS)"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <Link to="/quality/specs/new">
          <ZButton variant="primary">New spec</ZButton>
        </Link>
      }
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <section className="mh-panel">
          <h2 className="mh-panel__title">Specs ({specs.length})</h2>
          <table className="mh-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Title</th>
                <th>Machine</th>
                <th>Version</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {specs.map((s) => (
                <tr key={s.id}>
                  <td>{s.processCode}</td>
                  <td>{s.title}</td>
                  <td className="mono">{s.machineCode ?? '—'}</td>
                  <td>{s.version}</td>
                  <td>{s.status}</td>
                  <td>
                    <Link to={`/quality/specs/${s.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!specs.length ? <p className="mh-empty">No specs yet.</p> : null}
        </section>
      </div>
    </MachineHeadShell>
  );
}

export function QualitySpecEditorPage({
  specId,
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const isNew = !specId || specId === 'new';
  const [form, setForm] = useState({
    processCode: 'TM',
    machineCode: '',
    title: '',
    version: '1',
    status: 'DRAFT',
    payloadText: '{\n  "notes": ""\n}',
  });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (isNew) return;
    void apiRequest(`/quality/specs/${specId}`)
      .then((s) => {
        setForm({
          processCode: s.processCode,
          machineCode: s.machineCode ?? '',
          title: s.title,
          version: String(s.version ?? '1'),
          status: s.status ?? 'DRAFT',
          payloadText: JSON.stringify(s.payload ?? {}, null, 2),
        });
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, [specId, isNew]);

  async function save() {
    setMsg(null);
    let payload;
    try {
      payload = JSON.parse(form.payloadText);
    } catch {
      setMsg('Payload must be valid JSON');
      return;
    }
    const body = {
      processCode: form.processCode,
      machineCode: form.machineCode || null,
      title: form.title,
      version: Number(form.version) || 1,
      status: form.status,
      payload,
    };
    try {
      if (isNew) {
        await apiRequest('/quality/specs', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiRequest(`/quality/specs/${specId}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      setMsg('Saved');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return (
    <MachineHeadShell
      title={isNew ? 'New quality spec' : 'Edit quality spec'}
      subtitle="QSS payload for process / machine"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <Link to="/quality/specs" className="mh-consoles__btn">
          Back
        </Link>
      }
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <section className="mh-panel">
          <h2 className="mh-panel__title">Spec</h2>
          <div className="mh-form-grid">
            <label>
              Process
              <ZSelect
                value={form.processCode}
                onChange={(e) => setForm((f) => ({ ...f, processCode: e.target.value }))}
              >
                {['TM', 'FUR', 'STP', 'DRW', 'SWG'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </ZSelect>
            </label>
            <label>
              Machine (optional)
              <ZInput
                value={form.machineCode}
                onChange={(e) => setForm((f) => ({ ...f, machineCode: e.target.value }))}
              />
            </label>
            <label>
              Title
              <ZInput value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
            <label>
              Version
              <ZInput
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              />
            </label>
            <label>
              Status
              <ZSelect
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </ZSelect>
            </label>
          </div>
          <label className="field">
            Payload JSON
            <textarea
              className="z-textarea"
              rows={12}
              value={form.payloadText}
              onChange={(e) => setForm((f) => ({ ...f, payloadText: e.target.value }))}
            />
          </label>
          <ZButton variant="primary" onClick={() => void save()}>
            Save
          </ZButton>
        </section>
      </div>
    </MachineHeadShell>
  );
}
