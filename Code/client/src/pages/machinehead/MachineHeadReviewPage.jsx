import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZBadge, ZButton, ZInput } from '../../ui';
import { processPath } from '../../lib/roleHome';

export default function MachineHeadReviewPage({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [holdNote, setHoldNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await apiRequest('/reports/machine-head/pending');
    setItems(data?.items ?? data ?? []);
  }

  useEffect(() => {
    void load().catch((e) => setMsg(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  async function act(action) {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiRequest(`/reports/machine-head/${selected.process}/${selected.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(action === 'hold' ? { remark: holdNote || 'Held by Machine Head' } : {}),
      });
      setMsg(`${action} ok`);
      setSelected(null);
      setHoldNote('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MachineHeadShell
      title="Review"
      subtitle="Approve, hold, or reopen submitted runs and lots on your machines"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="mh-console">
        {msg ? <p className="mh-inline-msg">{msg}</p> : null}
        <div className="mh-split">
          <section className="mh-panel">
            <h2 className="mh-panel__title">Pending ({items.length})</h2>
            <ul className="mh-list">
              {items.map((it) => (
                <li key={`${it.process}-${it.id}`}>
                  <button
                    type="button"
                    className={`mh-list__item ${selected?.id === it.id ? 'active' : ''}`}
                    onClick={() => setSelected(it)}
                  >
                    <strong>
                      {it.process} · {it.machineCode}
                    </strong>
                    <span>{it.label ?? it.workOrderNo ?? it.id}</span>
                    <ZBadge tone="pending">{it.status}</ZBadge>
                  </button>
                </li>
              ))}
              {!items.length ? <li className="mh-empty">No submitted items on your machines.</li> : null}
            </ul>
          </section>
          <section className="mh-panel">
            <h2 className="mh-panel__title">Detail</h2>
            {!selected ? (
              <p className="mh-empty">Select an item</p>
            ) : (
              <>
                <dl className="mh-detail">
                  <div>
                    <dt>Process</dt>
                    <dd>{selected.process}</dd>
                  </div>
                  <div>
                    <dt>Machine</dt>
                    <dd className="mono">{selected.machineCode}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selected.status}</dd>
                  </div>
                  <div>
                    <dt>WO / label</dt>
                    <dd>{selected.label ?? selected.workOrderNo ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd className="muted">{selected.submittedAt ?? '—'}</dd>
                  </div>
                </dl>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <ZButton variant="primary" disabled={busy} onClick={() => void act('approve')}>
                    Approve
                  </ZButton>
                  <ZButton variant="danger" disabled={busy} onClick={() => void act('hold')}>
                    Hold
                  </ZButton>
                  <ZButton disabled={busy} onClick={() => void act('reopen')}>
                    Reopen
                  </ZButton>
                  <Link to={processPath(selected.process)}>Open floor</Link>
                </div>
                <label className="field" style={{ marginTop: 12 }}>
                  Hold note
                  <ZInput
                    value={holdNote}
                    onChange={(e) => setHoldNote(e.target.value)}
                    placeholder="Required for hold"
                  />
                </label>
              </>
            )}
          </section>
        </div>
      </div>
    </MachineHeadShell>
  );
}
