import { useEffect, useState } from 'react';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZButton, ZInput, ZSelect } from '../../ui';

export default function MachineHeadCrewPage({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [rows, setRows] = useState([]);
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState({
    machineCode: '',
    roleLabel: 'Operator',
    personName: '',
    shiftCode: 'A',
  });
  const [msg, setMsg] = useState(null);

  async function load() {
    const [crew, mach] = await Promise.all([
      apiRequest('/machine-head/crew'),
      apiRequest('/machines/master').catch(() => []),
    ]);
    setRows(crew?.items ?? crew ?? []);
    setMachines(mach?.items ?? mach ?? []);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  async function add() {
    setMsg(null);
    try {
      await apiRequest('/machine-head/crew', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm((f) => ({ ...f, personName: '' }));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Add failed');
    }
  }

  async function remove(id) {
    try {
      await apiRequest(`/machine-head/crew/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <MachineHeadShell
      title="Crew"
      subtitle="Named crew roles on machines in your access"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <section className="mh-panel">
          <h2 className="mh-panel__title">Add crew</h2>
          <div className="mh-form-grid">
            <label>
              Machine
              <ZSelect
                value={form.machineCode}
                onChange={(e) => setForm((f) => ({ ...f, machineCode: e.target.value }))}
              >
                <option value="">Select…</option>
                {machines.map((m) => (
                  <option key={m.machineCode ?? m.code} value={m.machineCode ?? m.code}>
                    {m.machineCode ?? m.code} ({m.processCode ?? m.process_code})
                  </option>
                ))}
              </ZSelect>
            </label>
            <label>
              Role
              <ZInput
                value={form.roleLabel}
                onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
              />
            </label>
            <label>
              Person
              <ZInput
                value={form.personName}
                onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
              />
            </label>
            <label>
              Shift
              <ZSelect
                value={form.shiftCode}
                onChange={(e) => setForm((f) => ({ ...f, shiftCode: e.target.value }))}
              >
                {['A', 'B', 'C', 'G'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </ZSelect>
            </label>
          </div>
          <ZButton variant="primary" onClick={() => void add()}>
            Add
          </ZButton>
        </section>
        <section className="mh-panel">
          <h2 className="mh-panel__title">Roster ({rows.length})</h2>
          <table className="mh-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Role</th>
                <th>Person</th>
                <th>Shift</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.machineCode}</td>
                  <td>{r.roleLabel}</td>
                  <td>{r.personName}</td>
                  <td>{r.shiftCode}</td>
                  <td>
                    <ZButton onClick={() => void remove(r.id)}>Remove</ZButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="mh-empty">No crew rows yet.</p> : null}
        </section>
      </div>
    </MachineHeadShell>
  );
}
