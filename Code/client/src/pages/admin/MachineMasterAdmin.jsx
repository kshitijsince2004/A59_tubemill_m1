import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/layout/admin';
import { ZButton, ZInput } from '../../ui';
import { adminApi } from '../../api/adminApi';

const PROCESSES = ['TM', 'FUR', 'STP', 'DRW', 'SWG'];

export default function MachineMasterAdmin({ roleLabel, onLogout, firstFloorPath }) {
  const [machines, setMachines] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ machineCode: '', label: '', processCode: 'TM' });
  const [editCode, setEditCode] = useState('');
  const [edit, setEdit] = useState({ label: '', processCode: 'TM' });

  async function refresh() {
    setError(null);
    try {
      setMachines(await adminApi.listMachines());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create() {
    setError(null);
    try {
      await adminApi.createMachine({
        machineCode: form.machineCode.trim(),
        label: form.label.trim(),
        processCode: form.processCode,
      });
      setForm({ machineCode: '', label: '', processCode: 'TM' });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  }

  async function saveEdit() {
    if (!editCode) return;
    setError(null);
    try {
      await adminApi.updateMachine(editCode, {
        label: edit.label,
        processCode: edit.processCode,
      });
      setEditCode('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function startEdit(m) {
    setEditCode(m.machineCode);
    setEdit({ label: m.label ?? '', processCode: m.processCode ?? 'TM' });
  }

  return (
    <AdminShell
      title="Machines"
      subtitle="Machine master — process binding for scoping and approvals"
      roleLabel={roleLabel}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      {error ? <div className="error-strip">{error}</div> : null}
      <div className="admin-console__grid">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Add machine</h2>
          <label className="eyebrow">Code</label>
          <ZInput
            value={form.machineCode}
            onChange={(e) => setForm({ ...form, machineCode: e.target.value })}
          />
          <label className="eyebrow">Label</label>
          <ZInput value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <label className="eyebrow">Process</label>
          <select
            className="z-select"
            value={form.processCode}
            onChange={(e) => setForm({ ...form, processCode: e.target.value })}
          >
            {PROCESSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <div className="admin-actions" style={{ marginTop: 12 }}>
            <ZButton variant="primary" type="button" onClick={() => void create()}>
              Create
            </ZButton>
          </div>
        </section>
        <section className="admin-panel">
          <h2 className="admin-panel__title">Machines ({machines.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Process</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.machineCode}>
                  <td className="mono">{m.machineCode}</td>
                  <td>
                    {editCode === m.machineCode ? (
                      <ZInput
                        value={edit.label}
                        onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                      />
                    ) : (
                      m.label
                    )}
                  </td>
                  <td>
                    {editCode === m.machineCode ? (
                      <select
                        className="z-select"
                        value={edit.processCode}
                        onChange={(e) => setEdit({ ...edit, processCode: e.target.value })}
                      >
                        {PROCESSES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      m.processCode
                    )}
                  </td>
                  <td>
                    {editCode === m.machineCode ? (
                      <>
                        <ZButton type="button" variant="primary" onClick={() => void saveEdit()}>
                          Save
                        </ZButton>{' '}
                        <ZButton type="button" onClick={() => setEditCode('')}>
                          Cancel
                        </ZButton>
                      </>
                    ) : (
                      <ZButton type="button" onClick={() => startEdit(m)}>
                        Edit
                      </ZButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AdminShell>
  );
}
