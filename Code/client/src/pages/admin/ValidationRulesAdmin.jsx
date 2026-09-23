import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/layout/admin';
import { ZButton, ZInput } from '../../ui';
import { validationRulesApi } from '../../api/validationRulesApi';

const PROCESSES = ['TM', 'FUR', 'STP', 'DRW', 'SWG'];
const RULE_TYPES = ['required', 'range', 'oneOf', 'toleranceVsSpec'];

export default function ValidationRulesAdmin({ roleLabel, onLogout, firstFloorPath }) {
  const [processCode, setProcessCode] = useState('FUR');
  const [rules, setRules] = useState([]);
  const [version, setVersion] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    field: '',
    ruleType: 'range',
    min: '',
    max: '',
    values: '',
    severity: 'ERROR',
    enabled: true,
  });

  async function refresh() {
    setError(null);
    try {
      const [list, ver] = await Promise.all([
        validationRulesApi.list(processCode),
        validationRulesApi.version(),
      ]);
      setRules(list);
      setVersion(ver);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  useEffect(() => {
    void refresh();
  }, [processCode]);

  async function save() {
    setError(null);
    try {
      const params = {};
      if (form.ruleType === 'range') {
        if (form.min !== '') params.min = Number(form.min);
        if (form.max !== '') params.max = Number(form.max);
      }
      if (form.ruleType === 'oneOf' && form.values) {
        params.values = form.values.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (form.ruleType === 'toleranceVsSpec') {
        if (form.min !== '') params.tol = Number(form.min);
      }
      await validationRulesApi.upsert({
        processCode,
        field: form.field.trim(),
        ruleType: form.ruleType,
        params,
        severity: form.severity,
        enabled: form.enabled,
      });
      setForm({ ...form, field: '', min: '', max: '', values: '' });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete overlay rule?')) return;
    try {
      await validationRulesApi.remove(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <AdminShell
      title="Validation rules"
      subtitle="DB overlays on shared capture rulesets (ANN / STP / DB / TM / SWG)"
      roleLabel={roleLabel}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={version != null ? <span className="muted mono">v{version}</span> : null}
    >
      <nav className="admin-tabs" aria-label="Process rules">
        {PROCESSES.map((p) => (
          <button
            key={p}
            type="button"
            className={`admin-tabs__btn${processCode === p ? ' is-active' : ''}`}
            onClick={() => setProcessCode(p)}
          >
            {p}
          </button>
        ))}
      </nav>
      {error ? <div className="error-strip">{error}</div> : null}
      <div className="admin-console__grid">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Upsert overlay</h2>
          <label className="eyebrow">Field</label>
          <ZInput value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} />
          <label className="eyebrow">Rule type</label>
          <select
            className="z-select"
            value={form.ruleType}
            onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {(form.ruleType === 'range' || form.ruleType === 'toleranceVsSpec') && (
            <>
              <label className="eyebrow">{form.ruleType === 'range' ? 'Min' : 'Tolerance'}</label>
              <ZInput value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} />
              {form.ruleType === 'range' ? (
                <>
                  <label className="eyebrow">Max</label>
                  <ZInput value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
                </>
              ) : null}
            </>
          )}
          {form.ruleType === 'oneOf' ? (
            <>
              <label className="eyebrow">Values (comma-separated)</label>
              <ZInput value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} />
            </>
          ) : null}
          <label className="eyebrow">Severity</label>
          <select
            className="z-select"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
          >
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />{' '}
            Enabled
          </label>
          <div className="admin-actions" style={{ marginTop: 12 }}>
            <ZButton variant="primary" type="button" onClick={() => void save()}>
              Save
            </ZButton>
          </div>
        </section>
        <section className="admin-panel">
          <h2 className="admin-panel__title">Overlays ({rules.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Params</th>
                <th>Sev</th>
                <th>On</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.field}</td>
                  <td>{r.ruleType}</td>
                  <td className="mono">{JSON.stringify(r.params ?? {})}</td>
                  <td>{r.severity}</td>
                  <td>{r.enabled ? 'Y' : 'N'}</td>
                  <td>
                    <ZButton type="button" onClick={() => void remove(r.id)}>
                      Delete
                    </ZButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rules.length ? <p className="admin-empty">No DB overlays — code rulesets still apply.</p> : null}
        </section>
      </div>
    </AdminShell>
  );
}
