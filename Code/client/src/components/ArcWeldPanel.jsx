import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZInput } from '../ui';
import FormModal from './FormModal';
import { tubemillApi } from '../api/tubemillClient';

export default function ArcWeldPanel({ runId, coils, disabled }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: ['arcweld', runId], queryFn: () => tubemillApi.getArcWelds(runId) });
  const mut = useMutation({
    mutationFn: (body) => tubemillApi.addArcWeld(runId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['arcweld', runId] });
      void qc.invalidateQueries({ queryKey: ['coils', runId] });
      setOpen(false);
    },
  });

  return (
    <section className="panel">
      <header className="panel__header">
        <span className="eyebrow">Arc weld current</span>
        <ZButton
          variant="primary"
          disabled={disabled || coils.length === 0}
          onClick={() => setOpen(true)}
        >
          Save arc weld
        </ZButton>
      </header>
      <ul className="panel__list">
        {(list.data ?? []).map((r) => (
          <li key={String(r.id)} className="mono">
            {String(r.current_amp ?? '—')} A · coil {String(r.coil_input_id).slice(0, 8)}
          </li>
        ))}
        {!list.data?.length ? <li className="empty-hint">No arc weld entries.</li> : null}
      </ul>

      <FormModal
        open={open}
        eyebrow="Arc weld"
        title="Save arc weld"
        onClose={() => setOpen(false)}
        footer={null}
      >
        <form
          className="stack-gap"
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled) return;
            const fd = new FormData(e.currentTarget);
            mut.mutate({
              coilInputId: String(fd.get('coilInputId')),
              currentAmp: fd.get('currentAmp') ? Number(fd.get('currentAmp')) : undefined,
              thkMm: fd.get('thkMm') ? Number(fd.get('thkMm')) : undefined,
              gradeCode: String(fd.get('gradeCode') || '') || undefined,
              remark: String(fd.get('remark') || '') || undefined,
            });
          }}
        >
          <select name="coilInputId" required disabled={disabled} className="z-input" defaultValue="">
            <option value="">Coil…</option>
            {coils.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.coil_tag)}
              </option>
            ))}
          </select>
          <ZInput name="currentAmp" type="number" placeholder="Amp" disabled={disabled} />
          <ZInput name="thkMm" type="number" step="0.01" placeholder="Thk mm" disabled={disabled} />
          <ZInput name="gradeCode" placeholder="Grade" disabled={disabled} />
          <ZInput name="remark" placeholder="Remark" disabled={disabled} />
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <ZButton variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </ZButton>
            <ZButton type="submit" disabled={disabled || mut.isPending || coils.length === 0}>
              {mut.isPending ? 'Saving…' : 'Save'}
            </ZButton>
          </div>
        </form>
      </FormModal>
    </section>
  );
}
