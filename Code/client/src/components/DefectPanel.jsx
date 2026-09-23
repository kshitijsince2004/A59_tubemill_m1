import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZInput, ZSelect } from '../ui';
import FormModal from './FormModal';
import { tubemillApi } from '../api/tubemillClient';

export default function DefectPanel({ runId, disabled }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const codes = useQuery({ queryKey: ['defect-codes'], queryFn: () => tubemillApi.getDefectCodes() });
  const list = useQuery({ queryKey: ['defects', runId], queryFn: () => tubemillApi.getDefects(runId) });
  const mut = useMutation({
    mutationFn: (body) => tubemillApi.addDefect(runId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['defects', runId] });
      setOpen(false);
    },
  });

  return (
    <section className="panel">
      <header className="panel__header">
        <span className="eyebrow">Defects</span>
        <ZButton variant="primary" disabled={disabled} onClick={() => setOpen(true)}>
          Log defect
        </ZButton>
      </header>
      <ul className="panel__list">
        {(list.data ?? []).map((d) => (
          <li key={String(d.id)} className="mono">
            {String(d.defect_code)} · {String(d.pieces ?? '—')} pcs · {String(d.remark ?? '')}
          </li>
        ))}
        {!list.data?.length ? <li className="empty-hint">No defects logged.</li> : null}
      </ul>

      <FormModal
        open={open}
        eyebrow="Defects"
        title="Log defect"
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
              defectCode: String(fd.get('defectCode')),
              pieces: fd.get('pieces') ? Number(fd.get('pieces')) : undefined,
              quantityMt: fd.get('quantityMt') ? Number(fd.get('quantityMt')) : undefined,
              remark: String(fd.get('remark') || '') || undefined,
            });
          }}
        >
          <ZSelect name="defectCode" required disabled={disabled} defaultValue="">
            <option value="" disabled>
              Code…
            </option>
            {(codes.data ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </ZSelect>
          <ZInput name="pieces" type="number" placeholder="Pieces" disabled={disabled} />
          <ZInput name="quantityMt" type="number" step="0.001" placeholder="MT" disabled={disabled} />
          <ZInput name="remark" placeholder="Remark" disabled={disabled} />
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <ZButton variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </ZButton>
            <ZButton type="submit" disabled={disabled || mut.isPending}>
              {mut.isPending ? 'Saving…' : 'Save defect'}
            </ZButton>
          </div>
        </form>
      </FormModal>
    </section>
  );
}
