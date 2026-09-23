import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ZButton, ZInput } from '../../ui';
import { adminApi } from '../../api/adminApi';

const ROLES_PH = ['OPERATOR', 'MACHINE_HEAD', 'PLANT_HEAD'];
const ROLES_ADMIN = ['OPERATOR', 'MACHINE_HEAD', 'PLANT_HEAD', 'ADMIN'];
const PROCESSES = ['TM', 'FUR', 'STP', 'DRW', 'SWG'];

function primaryRoleOf(user) {
  const roles = user?.roles ?? [];
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('PLANT_HEAD')) return 'PLANT_HEAD';
  if (roles.includes('MACHINE_HEAD')) return 'MACHINE_HEAD';
  return 'OPERATOR';
}

export function hasImplicitAllMachines(role) {
  return role === 'ADMIN' || role === 'PLANT_HEAD';
}

const emptyCreateForm = () => ({
  username: '',
  fullName: '',
  empCode: '',
  email: '',
  pin: '1234',
  role: 'OPERATOR',
  processes: ['TM'],
  machineCode: '',
});

/**
 * Users + access management for Plant Head / Admin.
 * Access tab deep-link: ?tab=assignment
 * @param {{ allowAdminRole?: boolean, defaultTab?: 'users'|'assignment' }} props
 */
export default function UsersAdmin({ allowAdminRole = false, defaultTab = 'users' }) {
  const roles = allowAdminRole ? ROLES_ADMIN : ROLES_PH;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') === 'assignment' ? 'assignment' : 'users';
  const [tab, setTab] = useState(
    defaultTab === 'assignment' || tabFromUrl === 'assignment' ? 'assignment' : 'users'
  );
  const [users, setUsers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState(emptyCreateForm);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    fullName: '',
    empCode: '',
    email: '',
    pin: '',
    role: 'OPERATOR',
    status: 'ACTIVE',
  });

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  function selectTab(next) {
    setTab(next);
    if (next === 'assignment') setSearchParams({ tab: 'assignment' });
    else setSearchParams({});
  }

  async function refresh() {
    setError(null);
    try {
      const [u, m] = await Promise.all([adminApi.listUsers(), adminApi.listMachines()]);
      setUsers(u);
      setMachines(m);
      if (!selectedUserId && u[0]) setSelectedUserId(u[0].userId);
      if (!form.machineCode && m[0]) {
        setForm((f) => ({ ...f, machineCode: m[0].machineCode }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resolveCreateMachineAccess() {
    if (hasImplicitAllMachines(form.role)) return [];
    if (form.role === 'OPERATOR') {
      if (!form.machineCode) return [];
      return [{ machineCode: form.machineCode, level: 'WRITE' }];
    }
    return machines
      .filter((m) => form.processes.includes(m.processCode ?? ''))
      .map((m) => ({ machineCode: m.machineCode, level: 'WRITE' }));
  }

  async function createUser() {
    setError(null);
    try {
      if (form.role === 'OPERATOR' && !form.machineCode) {
        throw new Error('Operator requires a single assigned machine');
      }
      await adminApi.createUser({
        username: form.username,
        fullName: form.fullName,
        empCode: form.empCode || null,
        email: form.email || null,
        pin: form.pin || null,
        roles: [form.role],
        processAccess: form.processes.map((p) => ({
          processCode: p,
          level: form.role === 'PLANT_HEAD' ? 'READ' : form.role === 'OPERATOR' ? 'WRITE' : 'APPROVE',
        })),
        machineAccess: resolveCreateMachineAccess(),
      });
      setForm({ ...emptyCreateForm(), machineCode: form.machineCode || machines[0]?.machineCode || '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  function startEdit(u) {
    setEditUserId(u.userId);
    setEditForm({
      username: u.username ?? '',
      fullName: u.fullName ?? '',
      empCode: u.empCode ?? '',
      email: u.email ?? '',
      pin: '',
      role: primaryRoleOf(u),
      status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
    setError(null);
  }

  function cancelEdit() {
    setEditUserId(null);
  }

  async function saveEdit() {
    if (!editUserId) return;
    setError(null);
    try {
      if (!editForm.username.trim() || !editForm.fullName.trim()) {
        throw new Error('Username and full name are required');
      }
      if (!roles.includes(editForm.role)) {
        throw new Error('Cannot assign that role');
      }
      const body = {
        username: editForm.username.trim(),
        fullName: editForm.fullName.trim(),
        empCode: editForm.empCode.trim() || null,
        email: editForm.email.trim() || null,
        status: editForm.status,
        roles: [editForm.role],
      };
      if (editForm.pin && editForm.pin.length > 0) {
        body.pin = editForm.pin;
      }
      await adminApi.updateUser(editUserId, body);
      setEditUserId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function saveAssignment() {
    const user = users.find((u) => u.userId === selectedUserId);
    if (!user) return;
    setError(null);
    const role = primaryRoleOf(user);
    try {
      await adminApi.setProcessAccess(user.userId, user.processAccess);
      const machineGrants = hasImplicitAllMachines(role) ? [] : user.machineAccess;
      if (role === 'OPERATOR' && machineGrants.length > 1) {
        throw new Error('Operator may have only one machine');
      }
      await adminApi.setMachineAccess(user.userId, machineGrants);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function toggleUserProcess(processCode) {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.userId !== selectedUserId) return u;
        const exists = u.processAccess.some((p) => p.processCode === processCode);
        return {
          ...u,
          processAccess: exists
            ? u.processAccess.filter((p) => p.processCode !== processCode)
            : [...u.processAccess, { processCode, level: 'WRITE' }],
        };
      })
    );
  }

  function toggleUserMachine(machineCode) {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.userId !== selectedUserId) return u;
        const role = primaryRoleOf(u);
        if (hasImplicitAllMachines(role)) return u;
        if (role === 'OPERATOR') {
          return {
            ...u,
            machineAccess: [{ machineCode, level: 'WRITE' }],
          };
        }
        const exists = u.machineAccess.some((m) => m.machineCode === machineCode);
        return {
          ...u,
          machineAccess: exists
            ? u.machineAccess.filter((m) => m.machineCode !== machineCode)
            : [...u.machineAccess, { machineCode, level: 'WRITE' }],
        };
      })
    );
  }

  const selected = users.find((u) => u.userId === selectedUserId);
  const selectedRole = selected ? primaryRoleOf(selected) : 'OPERATOR';
  const showMachinePicker = !hasImplicitAllMachines(form.role);
  const showAssignmentMachines = selected && !hasImplicitAllMachines(selectedRole);
  const editing = editUserId ? users.find((u) => u.userId === editUserId) : null;

  return (
    <div className="admin-console">
      <nav className="admin-tabs" aria-label="Users sections">
        {['users', 'assignment'].map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-tabs__btn${tab === t ? ' is-active' : ''}`}
            onClick={() => selectTab(t)}
          >
            {t === 'users' ? 'Users' : 'Access'}
          </button>
        ))}
      </nav>
      {error ? <div className="error-strip">{error}</div> : null}

      {tab === 'users' ? (
        <div className="admin-console__grid">
          <section className="admin-panel">
            {editing ? (
              <>
                <h2 className="admin-panel__title">Edit user</h2>
                <p className="muted mono">{editing.username}</p>
                <label className="eyebrow">Username</label>
                <ZInput
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
                <label className="eyebrow">Full name</label>
                <ZInput
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
                <label className="eyebrow">Badge / emp code</label>
                <ZInput
                  value={editForm.empCode}
                  onChange={(e) => setEditForm({ ...editForm, empCode: e.target.value })}
                />
                <label className="eyebrow">Email (staff)</label>
                <ZInput
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
                <label className="eyebrow">New PIN (blank = keep)</label>
                <ZInput
                  value={editForm.pin}
                  onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })}
                  placeholder="····"
                />
                <label className="eyebrow">Role</label>
                <select
                  className="z-select"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <label className="eyebrow">Status</label>
                <select
                  className="z-select"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <div className="admin-actions" style={{ marginTop: 12 }}>
                  <ZButton variant="primary" type="button" onClick={() => void saveEdit()}>
                    Save
                  </ZButton>
                  <ZButton type="button" onClick={cancelEdit}>
                    Cancel
                  </ZButton>
                </div>
              </>
            ) : (
              <>
                <h2 className="admin-panel__title">Create user</h2>
                <label className="eyebrow">Username</label>
                <ZInput value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <label className="eyebrow">Full name</label>
                <ZInput value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                <label className="eyebrow">Badge / emp code</label>
                <ZInput value={form.empCode} onChange={(e) => setForm({ ...form, empCode: e.target.value })} />
                <label className="eyebrow">Email (staff)</label>
                <ZInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <label className="eyebrow">PIN</label>
                <ZInput value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
                <label className="eyebrow">Role</label>
                <select
                  className="z-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <label className="eyebrow">Processes</label>
                <div className="admin-console__checks">
                  {PROCESSES.map((p) => (
                    <label key={p}>
                      <input
                        type="checkbox"
                        checked={form.processes.includes(p)}
                        onChange={() =>
                          setForm({
                            ...form,
                            processes: form.processes.includes(p)
                              ? form.processes.filter((x) => x !== p)
                              : [...form.processes, p],
                          })
                        }
                      />{' '}
                      {p}
                    </label>
                  ))}
                </div>
                {showMachinePicker ? (
                  <>
                    <label className="eyebrow">
                      {form.role === 'OPERATOR' ? 'Assigned machine (one)' : 'Machines (from selected processes)'}
                    </label>
                    {form.role === 'OPERATOR' ? (
                      <select
                        className="z-select"
                        value={form.machineCode}
                        onChange={(e) => setForm({ ...form, machineCode: e.target.value })}
                      >
                        {machines.map((m) => (
                          <option key={m.machineCode} value={m.machineCode}>
                            {m.machineCode} ({m.processCode})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="admin-panel__hint">Machine Head gets all machines under the checked processes on create.</p>
                    )}
                  </>
                ) : (
                  <p className="admin-panel__hint">Plant Head / Admin have implicit access to all machines.</p>
                )}
                <div className="admin-actions" style={{ marginTop: 12 }}>
                  <ZButton variant="primary" type="button" onClick={() => void createUser()}>
                    Create
                  </ZButton>
                </div>
              </>
            )}
          </section>
          <section className="admin-panel">
            <h2 className="admin-panel__title">Users ({users.length})</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Badge</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className={editUserId === u.userId ? 'is-selected' : undefined}>
                    <td>
                      {u.fullName}
                      <div className="muted mono">{u.username}</div>
                    </td>
                    <td className="mono">{u.empCode}</td>
                    <td>{u.roles.join(', ')}</td>
                    <td>{u.status}</td>
                    <td>
                      <ZButton type="button" onClick={() => startEdit(u)}>
                        Edit
                      </ZButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === 'assignment' && selected ? (
        <div className="admin-console__grid">
          <section className="admin-panel">
            <h2 className="admin-panel__title">User</h2>
            <p className="admin-panel__hint">Process and machine ACL for the selected person.</p>
            <select
              className="z-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.fullName} ({u.username}) — {primaryRoleOf(u)}
                </option>
              ))}
            </select>
            <h3 className="admin-panel__subtitle">Processes</h3>
            <div className="admin-console__checks">
              {PROCESSES.map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={selected.processAccess.some((g) => g.processCode === p)}
                    onChange={() => toggleUserProcess(p)}
                  />{' '}
                  {p}
                </label>
              ))}
            </div>
            <div className="admin-actions" style={{ marginTop: 12 }}>
              <ZButton variant="primary" type="button" onClick={() => void saveAssignment()}>
                Save access
              </ZButton>
            </div>
          </section>
          <section className="admin-panel">
            <h3 className="admin-panel__subtitle">Machines</h3>
            {showAssignmentMachines ? (
              <div className="admin-console__checks admin-console__checks--cols">
                {machines.map((m) => (
                  <label key={m.machineCode}>
                    <input
                      type={selectedRole === 'OPERATOR' ? 'radio' : 'checkbox'}
                      name="op-machine"
                      checked={selected.machineAccess.some((g) => g.machineCode === m.machineCode)}
                      onChange={() => toggleUserMachine(m.machineCode)}
                    />{' '}
                    {m.machineCode} <span className="muted">({m.processCode})</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="admin-panel__hint">Implicit all machines for {selectedRole}. Machine grants cleared on save.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
