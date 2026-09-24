import { useEffect, useRef, useState } from 'react';
import { ZButton } from '../ui';
import {
  listMachineCrew,
  ensureMachineSession,
  attachCrewToSession,
} from '../lib/machineCrewService';
import { isConcreteMachineCode } from '../lib/machineCodes';

/**
 * Soft-mandatory crew capture at session start / resume.
 * Dismissible; parent should re-open when needsCrew remains true on next entry.
 */
export default function CrewCaptureModal({
  open,
  machineCode,
  sessionId,
  onClose,
  onAttached,
}) {
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open || !machineCode) return;
    let cancelled = false;
    setErr(null);
    void listMachineCrew(machineCode)
      .then((items) => {
        if (cancelled) return;
        const list = Array.isArray(items) ? items : items?.items ?? [];
        setRoster(list);
        setSelected(new Set());
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load roster');
      });
    return () => {
      cancelled = true;
    };
  }, [open, machineCode]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!sessionId) {
      setErr('No active session');
      return;
    }
    if (!selected.size) {
      setErr('Select at least one crew member');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await attachCrewToSession(sessionId, [...selected]);
      onAttached?.();
      onClose?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Attach failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-scrim" role="presentation">
      <div
        className="modal-card crew-capture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crew-capture-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="crew-capture-modal__header">
          <span className="crew-capture-modal__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.67 0-8 1.34-8 4v2h10v-2c0-1.48.81-2.79 2.09-3.64A12.3 12.3 0 0 0 8 13Zm8 0c-.29 0-.62.02-.97.05A5.37 5.37 0 0 1 16 17v2h8v-2c0-2.66-5.33-4-8-4Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div>
            <h2 id="crew-capture-title">Who is on this shift?</h2>
            <p className="crew-capture-modal__machine">{machineCode || '—'}</p>
          </div>
        </header>

        <div className="crew-capture-modal__body">
          <p className="crew-capture-modal__hint">
            Confirm crew for this session. You can snooze and we&apos;ll ask again — production is
            not blocked.
          </p>

          {err ? <p className="mh-inline-msg">{err}</p> : null}

          {!roster.length && !err ? (
            <p className="muted">
              No active roster for this machine. Ask Machine Head to add crew.
            </p>
          ) : (
            <ul className="crew-capture-list">
              {roster.map((r) => {
                const id = r.id ?? r.crewId;
                const checked = selected.has(id);
                return (
                  <li key={id}>
                    <label className={`crew-capture-row${checked ? ' is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                      />
                      <span className="crew-capture-row__name">
                        {r.personName ?? r.memberName}
                      </span>
                      <span className="crew-capture-row__role">
                        {String(r.roleLabel || 'OPERATOR').toUpperCase()}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="crew-capture-modal__footer">
          <ZButton variant="ghost" onClick={onClose} disabled={busy}>
            Remind Me Later (5m)
          </ZButton>
          <ZButton variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Confirm Crew'}
          </ZButton>
        </footer>
      </div>
    </div>
  );
}

/**
 * Hook: ensure active session for machine; expose needsCrew + modal state.
 * Skips process aliases; treats 409 conflicts as soft state (no retry stampede).
 */
export function useCrewSession(machineCode, { shiftCode, enabled = true } = {}) {
  const [session, setSession] = useState(null);
  const [needsCrew, setNeedsCrew] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [conflictCode, setConflictCode] = useState(null);
  const hardFailRef = useRef(false);

  const canRun = Boolean(enabled && machineCode && isConcreteMachineCode(machineCode));

  async function refresh({ force = false } = {}) {
    if (!canRun) return null;
    if (hardFailRef.current && !force) return null;
    try {
      const data = await ensureMachineSession(machineCode, { shiftCode });
      hardFailRef.current = false;
      setConflictCode(null);
      setSession(data?.session ?? null);
      const need = Boolean(data?.needsCrew);
      setNeedsCrew(need);
      if (need) setShowModal(true);
      setError(null);
      return data;
    } catch (e) {
      const status = e?.status;
      const code = e?.code || (String(e?.message || '').includes('PENDING_HANDOVER')
        ? 'PENDING_HANDOVER'
        : String(e?.message || '').includes('ACTIVE_SESSION_CONFLICT')
          ? 'ACTIVE_SESSION_CONFLICT'
          : null);
      if (status === 401 || status === 403) hardFailRef.current = true;
      // 409 = expected gate (other operator / pending handover) — stop auto-retry noise
      if (status === 409) {
        hardFailRef.current = true;
        setConflictCode(code);
      }
      setError(e instanceof Error ? e.message : 'Session failed');
      setSession(null);
      setNeedsCrew(false);
      return null;
    }
  }

  useEffect(() => {
    hardFailRef.current = false;
    setConflictCode(null);
    setError(null);
    if (!canRun) {
      setSession(null);
      setNeedsCrew(false);
      setShowModal(false);
      return;
    }
    void refresh();
    function onVis() {
      // Do not re-POST ensure while a 409 conflict is latched — avoids stampede.
      if (document.visibilityState === 'visible' && !hardFailRef.current) void refresh();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on machine/shift/enable only
  }, [machineCode, shiftCode, canRun]);

  return {
    session,
    needsCrew,
    showModal,
    setShowModal,
    error,
    conflictCode,
    refresh: () => refresh({ force: true }),
    sessionId: session?.sessionId ?? session?.id ?? null,
    shiftLogId: session?.shiftLogId ?? null,
  };
}
