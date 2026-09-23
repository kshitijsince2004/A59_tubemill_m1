import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell } from '../../components/layout/admin';
import { ZButton } from '../../ui';
import { apiRequest } from '../../api/http';
import { erpApi } from '../../api/erpApi';

const TABS = [
  { id: 'connector', label: 'Connector' },
  { id: 'orders', label: 'Orders' },
  { id: 'health', label: 'Health' },
];

export default function IntegrationsAdmin({ roleLabel, onLogout, firstFloorPath }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : 'connector';

  const [health, setHealth] = useState(null);
  const [erpHealth, setErpHealth] = useState(null);
  const [watermarks, setWatermarks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const adapter = useMemo(() => {
    if (!erpHealth || typeof erpHealth !== 'object') return '—';
    return erpHealth.adapter ?? erpHealth.bcAdapter ?? 'file';
  }, [erpHealth]);

  async function refresh() {
    setError(null);
    try {
      const [h, eh, w, o] = await Promise.all([
        apiRequest('/health').catch(() => ({ status: 'unknown' })),
        erpApi.health(),
        erpApi.watermarks(),
        erpApi.orders('Released'),
      ]);
      setHealth(h);
      setErpHealth(eh);
      setWatermarks(Array.isArray(w) ? w : []);
      setOrders(Array.isArray(o) ? o : o?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function setTab(id) {
    setSearchParams(id === 'connector' ? {} : { tab: id });
  }

  async function sync() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const r = await erpApi.sync();
      const results = Array.isArray(r?.results) ? r.results : [];
      const summary = results.length
        ? results.map((x) => `${x.entity}:${x.status}${x.upserted != null ? `(${x.upserted})` : ''}`).join(', ')
        : 'ok';
      setMessage(`Sync complete — ${summary}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  async function flush() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const r = await erpApi.flushWriteback(50);
      setMessage(`Writeback flush: ${JSON.stringify(r)}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Flush failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Integrations"
      subtitle="ERP connector, released orders, and platform health — UI talks only to /erp and /health"
      roleLabel={roleLabel}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        tab === 'connector' || tab === 'orders' ? (
          <ZButton variant="primary" type="button" disabled={busy} onClick={() => void sync()}>
            {busy ? 'Working…' : 'Sync ERP'}
          </ZButton>
        ) : null
      }
    >
      <nav className="admin-tabs" aria-label="Integrations sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tabs__btn${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error ? <div className="error-strip">{error}</div> : null}
      {message ? <p className="admin-inline-msg">{message}</p> : null}

      {tab === 'connector' ? (
        <div className="admin-stack">
          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2 className="admin-panel__title">Business Central adapter</h2>
              <span className="admin-badge">{adapter}</span>
            </div>
            <p className="admin-panel__hint">
              Pull masters, codes, and released orders through the configured BC adapter. Changing adapters is
              server config (`BC_ADAPTER`) — this console does not embed connector credentials.
            </p>
            <div className="admin-actions">
              <ZButton variant="primary" type="button" disabled={busy} onClick={() => void sync()}>
                Sync
              </ZButton>
              <ZButton type="button" disabled={busy} onClick={() => void flush()}>
                Flush writeback
              </ZButton>
              <ZButton type="button" disabled={busy} onClick={() => void refresh()}>
                Refresh
              </ZButton>
            </div>
          </section>
          <section className="admin-panel">
            <h2 className="admin-panel__title">Sync watermarks</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Last run</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {watermarks.map((w) => (
                  <tr key={w.entity}>
                    <td className="mono">{w.entity}</td>
                    <td>{w.status}</td>
                    <td>{w.rowCount ?? '—'}</td>
                    <td className="muted">{w.lastRunAt ? String(w.lastRunAt) : '—'}</td>
                    <td className="muted">{w.lastError ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!watermarks.length ? <p className="admin-empty">No watermarks yet — run Sync.</p> : null}
          </section>
          {erpHealth ? (
            <section className="admin-panel">
              <h2 className="admin-panel__title">ERP health payload</h2>
              <pre className="admin-pre">{JSON.stringify(erpHealth, null, 2)}</pre>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'orders' ? (
        <section className="admin-panel">
          <div className="admin-panel__head">
            <h2 className="admin-panel__title">Released orders ({orders.length})</h2>
          </div>
          <p className="admin-panel__hint">
            Floor assignment stays with Machine Head. This list is the ERP feed after sync.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Customer</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Mill</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 200).map((o, i) => (
                <tr key={o.workOrderNo ?? o.bcId ?? i}>
                  <td className="mono">{o.workOrderNo ?? o.work_order_no}</td>
                  <td>{o.customerCode ?? o.customer_code ?? '—'}</td>
                  <td>{o.gradeCode ?? o.grade_code ?? '—'}</td>
                  <td>{o.status}</td>
                  <td className="mono">{o.millCode ?? o.mill_code ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length ? <p className="admin-empty">No released orders — Sync ERP on the Connector tab.</p> : null}
        </section>
      ) : null}

      {tab === 'health' ? (
        <section className="admin-panel">
          <div className="admin-panel__head">
            <h2 className="admin-panel__title">Application health</h2>
            <ZButton type="button" onClick={() => void refresh()}>
              Refresh
            </ZButton>
          </div>
          <pre className="admin-pre">{JSON.stringify(health ?? { status: 'unknown' }, null, 2)}</pre>
        </section>
      ) : null}
    </AdminShell>
  );
}
