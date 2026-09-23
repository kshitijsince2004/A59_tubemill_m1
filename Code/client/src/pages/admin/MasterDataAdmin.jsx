import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/layout/admin';
import { ZButton, ZInput } from '../../ui';
import { masterDataApi } from '../../api/masterDataApi';

const ENTITIES = [
  { id: 'grade', label: 'Grades', fields: ['code', 'label', 'densityKgM3'] },
  { id: 'customer', label: 'Customers', fields: ['code', 'name'] },
  { id: 'defect_code', label: 'Defect codes', fields: ['code', 'label', 'category'] },
  { id: 'stoppage_code', label: 'Stoppage codes', fields: ['code', 'label', 'category', 'isPlanned'] },
  { id: 'tm_consumable', label: 'TM consumables', fields: ['code', 'kind', 'status'] },
  {
    id: 'stp_bath_spec',
    label: 'STP bath specs',
    fields: ['bathCode', 'bathLabel', 'paramKey', 'minVal', 'maxVal', 'unit'],
  },
  {
    id: 'fur_zone_recipe',
    label: 'Furnace zone recipes',
    fields: ['gradeCode', 'furnaceCode', 'soakingSpecC', 'speedSpecMHr'],
  },
];

/** Natural-key fields that must stay stable for path id on update. */
function isLockedField(entityType, field) {
  if (['grade', 'customer', 'defect_code', 'stoppage_code', 'tm_consumable'].includes(entityType)) {
    return field === 'code';
  }
  return false;
}

function emptyForm(fields) {
  const o = {};
  for (const f of fields) o[f] = f === 'isPlanned' ? false : '';
  return o;
}

export default function MasterDataAdmin({ roleLabel, onLogout, firstFloorPath }) {
  const [entityType, setEntityType] = useState('grade');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const meta = ENTITIES.find((e) => e.id === entityType) ?? ENTITIES[0];
  const [form, setForm] = useState(() => emptyForm(meta.fields));

  async function refresh() {
    setError(null);
    try {
      setRows(await masterDataApi.list(entityType));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
      setRows([]);
    }
  }

  useEffect(() => {
    setEditId(null);
    setForm(emptyForm(meta.fields));
    void refresh();
  }, [entityType]);

  function buildBody() {
    const body = { ...form };
    for (const k of Object.keys(body)) {
      if (body[k] === '' || body[k] == null) delete body[k];
    }
    if (body.isPlanned != null) body.isPlanned = Boolean(body.isPlanned);
    for (const numKey of ['densityKgM3', 'minVal', 'maxVal', 'soakingSpecC', 'speedSpecMHr']) {
      if (body[numKey] != null && body[numKey] !== '') body[numKey] = Number(body[numKey]);
    }
    return body;
  }

  async function create() {
    setError(null);
    try {
      await masterDataApi.create(entityType, buildBody());
      setForm(emptyForm(meta.fields));
      setEditId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  }

  function startEdit(row) {
    const next = emptyForm(meta.fields);
    for (const f of meta.fields) {
      if (f === 'isPlanned') next[f] = Boolean(row[f]);
      else next[f] = row[f] != null ? String(row[f]) : '';
    }
    setForm(next);
    setEditId(rowId(row));
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm(meta.fields));
  }

  async function saveEdit() {
    if (!editId) return;
    setError(null);
    try {
      const body = buildBody();
      // Keep path id stable; omit immutable identity fields from patch when present as codes
      await masterDataApi.update(entityType, editId, body);
      setEditId(null);
      setForm(emptyForm(meta.fields));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this row?')) return;
    setError(null);
    try {
      await masterDataApi.remove(entityType, id);
      if (editId === id) cancelEdit();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function rowId(row) {
    return row.id ?? row.code ?? `${row.bathCode}:${row.paramKey}`;
  }

  return (
    <AdminShell
      title="Master data"
      subtitle="Reference entities for capture, defects, stoppages, and process specs"
      roleLabel={roleLabel}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <nav className="admin-tabs" aria-label="Master entities">
        {ENTITIES.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`admin-tabs__btn${entityType === e.id ? ' is-active' : ''}`}
            onClick={() => setEntityType(e.id)}
          >
            {e.label}
          </button>
        ))}
      </nav>
      {error ? <div className="error-strip">{error}</div> : null}
      <div className="admin-console__grid">
        <section className="admin-panel">
          <h2 className="admin-panel__title">{editId ? `Edit ${meta.label}` : `Add ${meta.label}`}</h2>
          {meta.fields.map((f) =>
            f === 'isPlanned' ? (
              <label key={f}>
                <input
                  type="checkbox"
                  checked={Boolean(form[f])}
                  onChange={(e) => setForm({ ...form, [f]: e.target.checked })}
                />{' '}
                Planned
              </label>
            ) : (
              <div key={f}>
                <label className="eyebrow">{f}</label>
                <ZInput
                  value={String(form[f] ?? '')}
                  disabled={Boolean(editId && isLockedField(entityType, f))}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </div>
            )
          )}
          {editId ? (
            <div className="admin-actions" style={{ marginTop: 12 }}>
              <ZButton variant="primary" type="button" onClick={() => void saveEdit()}>
                Save
              </ZButton>
              <ZButton type="button" onClick={cancelEdit}>
                Cancel
              </ZButton>
            </div>
          ) : (
            <div className="admin-actions" style={{ marginTop: 12 }}>
              <ZButton variant="primary" type="button" onClick={() => void create()}>
                Create
              </ZButton>
            </div>
          )}
        </section>
        <section className="admin-panel">
          <h2 className="admin-panel__title">
            {meta.label} ({rows.length})
          </h2>
          <table className="admin-table">
            <thead>
              <tr>
                {meta.fields.map((f) => (
                  <th key={f}>{f}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowId(row)}>
                  {meta.fields.map((f) => (
                    <td key={f} className={f === 'code' || f.includes('Code') ? 'mono' : undefined}>
                      {String(row[f] ?? '')}
                    </td>
                  ))}
                  <td style={{ display: 'flex', gap: 6 }}>
                    <ZButton type="button" onClick={() => startEdit(row)}>
                      Edit
                    </ZButton>
                    <ZButton type="button" onClick={() => void remove(rowId(row))}>
                      Delete
                    </ZButton>
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
