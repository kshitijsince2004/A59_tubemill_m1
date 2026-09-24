import { useState } from 'react';
import { ZButton, ZTextarea } from '../ui';
import { machineHandoverService } from '../lib/machineHandoverService';

/**
 * Full-screen accept / clarify UI for a pending handover.
 */
export default function HandoverAcceptPage({ handover, onAccepted }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [clarify, setClarify] = useState(false);
  const [notes, setNotes] = useState('');

  if (!handover) return null;

  const ps = handover.production_snapshot || {};
  const openWork = ps.openWork || [];
  const stoppages = handover.open_stoppages || [];

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      await machineHandoverService.accept(handover.handover_id || handover.handoverId);
      onAccepted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setBusy(false);
    }
  }

  async function requestClarification() {
    if (notes.trim().length < 5) {
      setErr('Clarification notes required (min 5 characters)');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await machineHandoverService.requestClarification(
        handover.handover_id || handover.handoverId,
        notes.trim()
      );
      onAccepted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Clarification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="handover-accept-page"
      style={{
        minHeight: '100%',
        background: 'rgba(15,23,42,0.92)',
        color: '#f8fafc',
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          background: '#0f172a',
          borderRadius: 16,
          padding: 24,
          border: '1px solid #334155',
        }}
      >
        <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
          Incoming handover
        </p>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22 }}>
          {handover.machine_code || handover.machineCode}
        </h1>
        <p style={{ margin: '0 0 16px', opacity: 0.8, fontSize: 13 }}>
          Shift {handover.outgoing_shift_code} → {handover.incoming_shift_code} ·{' '}
          {String(handover.outgoing_prod_date || '').slice(0, 10)}
          {' · '}
          {handover.machine_status}
          {' · '}
          Priority {handover.handover_priority || 'MEDIUM'}
        </p>

        <section style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>Remarks</h3>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{handover.remarks}</p>
        </section>

        {openWork.length ? (
          <section style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>
              Open work ({openWork.length})
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {openWork.slice(0, 8).map((w) => (
                <li key={w.id}>
                  {w.run_no || w.charge_no || w.lot_no || w.id} · {w.status || w.run_state}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {stoppages.length ? (
          <section style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>
              Open stoppages ({stoppages.length})
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {stoppages.slice(0, 5).map((s) => (
                <li key={s.stoppageId || s.startAt}>
                  {s.category || 'Stop'} — {s.reason || '—'}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {clarify ? (
          <div style={{ marginBottom: 16 }}>
            <ZTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What needs clarification?"
              rows={3}
            />
          </div>
        ) : null}

        {err ? <p style={{ color: '#fca5a5', fontSize: 13 }}>{err}</p> : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {!clarify ? (
            <ZButton variant="ghost" onClick={() => setClarify(true)} disabled={busy}>
              Request clarification
            </ZButton>
          ) : (
            <ZButton variant="secondary" onClick={() => void requestClarification()} disabled={busy}>
              {busy ? 'Sending…' : 'Send clarification'}
            </ZButton>
          )}
          <ZButton variant="primary" onClick={() => void accept()} disabled={busy}>
            {busy && !clarify ? 'Accepting…' : 'Accept & continue'}
          </ZButton>
        </div>
      </div>
    </div>
  );
}
