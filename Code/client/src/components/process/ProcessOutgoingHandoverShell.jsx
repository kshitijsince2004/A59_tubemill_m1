import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZButton, ZTextarea } from '../../ui';
import { machineHandoverService } from '../../lib/machineHandoverService';
import { useHandoverDraft, useHandoverPreview } from '../../hooks/useHandoverState';
import { clearAuth } from '../../lib/authStore';
import { signOutSession } from '../../lib/supertokens';

export const HANDOVER_MIN_NOTES = 20;
export const HANDOVER_AUTO_SAVE_MS = 30_000;
export const HANDOVER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

export function HandoverSectionHeader({ title, locked }) {
  return (
    <div className="handover-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
      {locked ? <span className="muted" style={{ fontSize: 10 }}>AUTO</span> : null}
    </div>
  );
}

export function HandoverLockedField({ label, value }) {
  return (
    <div className="handover-locked-field" style={{ padding: '8px 12px', background: 'var(--z-surface-2, #f4f4f5)', borderRadius: 8 }}>
      <p className="muted" style={{ margin: 0, fontSize: 10, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600 }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

/**
 * Shared outgoing handover chrome for A59 process pages.
 */
export function ProcessOutgoingHandoverShell({
  machineCode,
  title,
  loadingLabel,
  children,
  extraPayload,
  hydrateExtra,
  footerLabels,
  notesExtra,
  cancelPath,
}) {
  const navigate = useNavigate();
  const {
    data: preview,
    error: previewError,
    isLoading: previewLoading,
    mutate: mutatePreview,
  } = useHandoverPreview(machineCode);
  const {
    data: draft,
    error: draftErrorSwr,
    isLoading: draftLoading,
    mutate: mutateDraft,
  } = useHandoverDraft(machineCode);

  const hydratedKey = useRef(null);
  const [crewNotes, setCrewNotes] = useState('');
  const [crewRoster, setCrewRoster] = useState([]);
  const [selectedRosterIds, setSelectedRosterIds] = useState(() => new Set());
  const [outgoingNotes, setOutgoingNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [machineStatus, setMachineStatus] = useState('IDLE');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const autoSaveRef = useRef();

  const loading = (previewLoading || draftLoading) && !preview && !previewError && !draftErrorSwr;
  const loadError =
    previewError || draftErrorSwr
      ? (previewError instanceof Error ? previewError.message : null) ??
        (draftErrorSwr instanceof Error ? draftErrorSwr.message : null) ??
        'Failed to load'
      : null;

  useEffect(() => {
    if (!preview && !draft) return;
    const key = `${machineCode}:${draft?.handover_id ?? 'nodraft'}`;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    if (draft) {
      const ps = draft.production_snapshot || {};
      if (ps.crewNotes) setCrewNotes(String(ps.crewNotes));
      setOutgoingNotes(draft.remarks ?? '');
      if (draft.handover_priority) setPriority(draft.handover_priority);
      if (draft.machine_status) setMachineStatus(draft.machine_status);
    }
    hydrateExtra?.(draft, preview);

    const roster = preview?.machineCrewRoster ?? [];
    setCrewRoster(roster);
    const crewSnap = preview?.crewSnapshot ?? [];
    if (crewSnap.length && roster.length) {
      const ids = new Set();
      for (const crew of crewSnap) {
        const crewId = String(crew.crewId ?? crew.id ?? '').trim();
        if (crewId && roster.some((r) => r.id === crewId || r.crewId === crewId)) {
          ids.add(crewId);
        }
      }
      if (ids.size) {
        setSelectedRosterIds(ids);
        setCrewNotes(
          roster
            .filter((r) => ids.has(r.id) || ids.has(r.crewId))
            .map((r) => `${r.memberName || r.personName} (${r.roleLabel})`)
            .join(', ')
        );
      }
    }
  }, [preview, draft, machineCode, hydrateExtra]);

  function toggleCrew(member) {
    setSelectedRosterIds((prev) => {
      const next = new Set(prev);
      const id = member.id || member.crewId;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setCrewNotes(
        crewRoster
          .filter((c) => next.has(c.id) || next.has(c.crewId))
          .map((c) => `${c.memberName || c.personName} (${c.roleLabel})`)
          .join(', ')
      );
      return next;
    });
  }

  const buildPayload = useCallback(
    () => ({
      machineStatus,
      machineCondition: 'NORMAL',
      remarks: outgoingNotes,
      handoverPriority: priority,
      crewNotes: crewNotes || undefined,
      selectedCrewIds: selectedRosterIds.size ? [...selectedRosterIds] : undefined,
      ...(extraPayload || {}),
    }),
    [machineStatus, outgoingNotes, priority, crewNotes, selectedRosterIds, extraPayload]
  );

  const saveDraft = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    setDraftError(null);
    try {
      await machineHandoverService.saveDraft(machineCode, buildPayload());
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
      void mutateDraft();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Draft failed to save');
    } finally {
      setSaving(false);
    }
  }, [preview, buildPayload, machineCode, mutateDraft]);

  useEffect(() => {
    if (!preview) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => void saveDraft(), HANDOVER_AUTO_SAVE_MS);
    return () => clearTimeout(autoSaveRef.current);
  }, [saveDraft, preview]);

  async function submit() {
    if (outgoingNotes.trim().length < HANDOVER_MIN_NOTES) {
      setNotesError(`Please enter at least ${HANDOVER_MIN_NOTES} characters`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await machineHandoverService.submitOutgoing(machineCode, {
        ...buildPayload(),
        remarks: outgoingNotes.trim(),
      });
      clearAuth();
      try {
        await signOutSession();
      } catch {
        /* ignore */
      }
      navigate('/login', { replace: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Handover submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="handover-page handover-page--loading">
        <p className="muted">{loadingLabel ?? `Loading ${title} handover…`}</p>
      </div>
    );
  }

  const p = preview ?? {
    machineCode,
    shift: { shiftCode: '—', prodDate: '—' },
    nextShift: { shiftCode: '—', prodDate: '—' },
  };

  return (
    <div className="handover-page">
      {loadError ? (
        <div className="handover-page__error">
          <span>{loadError}</span>
          <ZButton
            variant="secondary"
            size="sm"
            onClick={() => {
              hydratedKey.current = null;
              void mutatePreview();
              void mutateDraft();
            }}
          >
            Retry
          </ZButton>
        </div>
      ) : null}

      <header className="handover-page__header">
        <p className="muted handover-page__eyebrow">Outgoing Handover</p>
        <h1>
          {title} · Shift {p.shift?.shiftCode}
        </h1>
        <p className="muted handover-page__meta">
          {p.shift?.prodDate} → next {p.nextShift?.shiftCode} ({p.nextShift?.prodDate})
          {draftSaved ? ' · Draft saved' : ''}
          {draftError ? ` · ${draftError}` : ''}
        </p>
      </header>

      <div className="handover-page__body">
        {children}

        <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
          <HandoverSectionHeader title="Crew Details" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {crewRoster.map((m) => {
              const id = m.id || m.crewId;
              const on = selectedRosterIds.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCrew(m)}
                  style={{
                    minHeight: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: on ? '2px solid var(--z-accent, #2563eb)' : '1px solid #ccc',
                    background: on ? 'var(--z-accent, #2563eb)' : 'transparent',
                    color: on ? '#fff' : 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {m.memberName || m.personName} · {m.roleLabel}
                </button>
              );
            })}
            {!crewRoster.length ? <p className="muted">No roster configured</p> : null}
          </div>
          <ZTextarea
            value={crewNotes}
            onChange={(e) => setCrewNotes(e.target.value)}
            placeholder="Crew notes"
            rows={2}
          />
        </section>

        <section style={{ border: '1px solid var(--z-border, #e4e4e7)', borderRadius: 12, padding: 16 }}>
          <HandoverSectionHeader title="Outgoing Notes" />
          {notesExtra}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {HANDOVER_PRIORITIES.map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => setPriority(pr)}
                style={{
                  minHeight: 40,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: priority === pr ? '2px solid var(--z-accent, #2563eb)' : '1px solid #ccc',
                  background: priority === pr ? 'var(--z-accent, #2563eb)' : 'transparent',
                  color: priority === pr ? '#fff' : 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {pr}
              </button>
            ))}
          </div>
          <ZTextarea
            value={outgoingNotes}
            onChange={(e) => {
              setOutgoingNotes(e.target.value);
              setNotesError('');
            }}
            placeholder={`Outgoing operator notes (min ${HANDOVER_MIN_NOTES} chars) *`}
            rows={5}
          />
          {notesError ? <p style={{ color: '#b91c1c', fontSize: 13 }}>{notesError}</p> : null}
        </section>

        {submitError ? <p style={{ color: '#b91c1c' }}>{submitError}</p> : null}
      </div>

      <footer className="handover-page__footer">
        {cancelPath ? (
          <ZButton variant="ghost" onClick={() => navigate(cancelPath)}>
            Cancel
          </ZButton>
        ) : null}
        <ZButton variant="secondary" onClick={() => void saveDraft()} disabled={saving || submitting}>
          {saving ? 'Saving…' : footerLabels?.save ?? 'Save Draft'}
        </ZButton>
        <ZButton variant="primary" onClick={() => void submit()} disabled={submitting}>
          {submitting ? 'Submitting…' : footerLabels?.submit ?? 'Submit & End Shift'}
        </ZButton>
      </footer>
    </div>
  );
}
