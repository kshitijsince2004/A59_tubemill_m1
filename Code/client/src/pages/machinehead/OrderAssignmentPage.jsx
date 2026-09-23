import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZButton } from '../../ui';
import { PROCESS_META, firstProcessPath, processPath } from '../../lib/roleHome';

function floorForOrder(order, user, firstFloorPath) {
  const mill = String(order?.millCode ?? order?.mill_code ?? '').toUpperCase();
  const proc = String(order?.processCode ?? order?.process_code ?? '').toUpperCase();
  if (PROCESS_META.some((p) => p.id === proc)) return processPath(proc);
  if (mill.includes('RHF') || mill.includes('FUR') || mill.includes('ANN')) return '/fur';
  if (mill.includes('STP')) return '/stp';
  if (mill.includes('DRW') || mill.includes('DB')) return '/drw';
  if (mill.includes('SWG')) return '/swg';
  if (mill.includes('A-59') || mill.includes('TM') || mill.includes('A59')) return '/tm';
  if (user) return firstProcessPath(user);
  return firstFloorPath || '/tm';
}

export default function OrderAssignmentPage({
  user,
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await apiRequest('/erp/orders?status=Released');
    setOrders(data?.items ?? data ?? []);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await apiRequest('/erp/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const results = Array.isArray(data?.results) ? data.results : [];
      const summary = results.length
        ? results.map((x) => `${x.entity}:${x.status}`).join(', ')
        : 'ok';
      setMsg(`Sync complete — ${summary}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MachineHeadShell
      title="Orders"
      subtitle="Released ERP work orders — sync, then assign on the floor (floor is system of record)"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <ZButton variant="primary" disabled={busy} onClick={() => void sync()}>
          {busy ? 'Syncing…' : 'Sync ERP'}
        </ZButton>
      }
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <section className="mh-panel">
          <h2 className="mh-panel__title">Released ({orders.length})</h2>
          <table className="mh-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Customer</th>
                <th>Grade</th>
                <th>Mill</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const floor = floorForOrder(o, user, firstFloorPath);
                return (
                  <tr key={o.id ?? o.workOrderNo}>
                    <td className="mono">{o.workOrderNo ?? o.no}</td>
                    <td>{o.customerName ?? o.customerCode ?? o.customer ?? '—'}</td>
                    <td>{o.grade ?? o.gradeCode ?? '—'}</td>
                    <td className="mono">{o.millCode ?? o.mill_code ?? '—'}</td>
                    <td>{o.status ?? 'Released'}</td>
                    <td>
                      <Link to={floor}>Open floor</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!orders.length ? <p className="mh-empty">No released orders — Sync ERP.</p> : null}
        </section>
      </div>
    </MachineHeadShell>
  );
}
