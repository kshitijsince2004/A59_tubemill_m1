import { useEffect, useState } from 'react';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import {
  listMachineCrew,
  createMachineCrew,
  updateMachineCrew,
  deleteMachineCrew,
} from '../../lib/machineCrewService';
import { ZButton, ZInput, ZSelect } from '../../ui';

const emptyForm = {
  machineCode: '',
  roleLabel: 'Operator',
  personName: '',
  shiftCode: 'A',
};

export default function MachineHeadCrewPage({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [rows, setRows] = useState([]);
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  async function load() {
    const [crew, mach] = await Promise.all([
      listMachineCrew(),
      apiRequest('/machines/master').catch(() => []),
    ]);
    setRows(Array.isArray(crew) ? crew : crew?.items ?? []);
    setMachines(mach?.items ?? mach ?? []);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  async function save() {
    setMsg(null);
    try {
      if (editingId) {
        await updateMachineCrew(editingId, form);
        setEditingId(null);
      } else {
        await createMachineCrew(form);
      }
      setForm((f) => ({ ...f, personName: '' }));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  }

  function startEdit(row) {
    setEditingId(row.id ?? row.crewId);
    setForm({
      machineCode: row.machineCode ?? '',
      roleLabel: row.roleLabel ?? 'Operator',
      personName: row.personName ?? row.memberName ?? '',
      shiftCode: row.shiftCode ?? 'A',
    });
  }

  async function remove(row) {
    try {
      await deleteMachineCrew(row.id ?? row.crewId, row.machineCode);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Remove failed');
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
          <h2 className="mh-panel__title">{editingId ? 'Edit crew' : 'Add crew'}</h2>
          <div className="mh-form-grid">
            <label>
              Machine
              <ZSelect
                value={form.machineCode}
                onChange={(e) => setForm((f) => ({ ...f, machineCode: e.target.value }))}
                disabled={Boolean(editingId)}
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
          <div className="mh-form-actions" style={{ display: 'flex', gap: 8 }}>
            <ZButton variant="primary" onClick={() => void save()}>
              {editingId ? 'Update' : 'Add'}
            </ZButton>
            {editingId ? (
              <ZButton
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </ZButton>
            ) : null}
          </div>
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
                <tr key={r.id ?? r.crewId}>
                  <td className="mono">{r.machineCode}</td>
                  <td>{r.roleLabel}</td>
                  <td>{r.personName ?? r.memberName}</td>
                  <td>{r.shiftCode}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <ZButton onClick={() => startEdit(r)}>Edit</ZButton>
                    <ZButton onClick={() => void remove(r)}>Remove</ZButton>
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
