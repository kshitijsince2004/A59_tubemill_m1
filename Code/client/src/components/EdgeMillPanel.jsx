import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZInput } from '../ui';
import FormModal from './FormModal';
import { tubemillApi } from '../api/tubemillClient';

export default function EdgeMillPanel({ runId, coils, disabled }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ['edgemill', runId],
    queryFn: () => tubemillApi.getEdgeMills(runId),
  });
  const mut = useMutation({
    mutationFn: (body) => tubemillApi.addEdgeMill(runId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['edgemill', runId] });
      void qc.invalidateQueries({ queryKey: ['coils', runId] });
      setOpen(false);
    },
  });

  return (
    <section className="panel">
      <header className="panel__header">
        <span className="eyebrow">Edge milling</span>
        <ZButton variant="primary" disabled={disabled} onClick={() => setOpen(true)}>
          Save edge mill
        </ZButton>
      </header>
      <ul className="panel__list">
        {(list.data ?? []).map((r) => (
          <li key={String(r.id)} className="mono">
            {String(r.width_before_mm ?? '—')} → {String(r.width_after_mm ?? '—')} ·{' '}
            {String(r.edge_condition ?? '')}
          </li>
        ))}
        {!list.data?.length ? <li className="empty-hint">No edge mill entries.</li> : null}
      </ul>

      <FormModal
        open={open}
        eyebrow="Edge milling"
        title="Save edge mill"
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
              coilInputId: String(fd.get('coilInputId') || '') || undefined,
              widthBeforeMm: fd.get('widthBeforeMm') ? Number(fd.get('widthBeforeMm')) : undefined,
              widthAfterMm: fd.get('widthAfterMm') ? Number(fd.get('widthAfterMm')) : undefined,
              edgeCondition: String(fd.get('edgeCondition') || '') || undefined,
              thkMm: fd.get('thkMm') ? Number(fd.get('thkMm')) : undefined,
              remark: String(fd.get('remark') || '') || undefined,
            });
          }}
        >
          <select name="coilInputId" disabled={disabled} className="z-input" defaultValue="">
            <option value="">Coil (optional)…</option>
            {coils.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.coil_tag)}
              </option>
            ))}
          </select>
          <ZInput
            name="widthBeforeMm"
            type="number"
            step="0.01"
            placeholder="Width before"
            disabled={disabled}
          />
          <ZInput
            name="widthAfterMm"
            type="number"
            step="0.01"
            placeholder="Width after"
            disabled={disabled}
          />
          <ZInput name="edgeCondition" placeholder="Edge condition" disabled={disabled} />
          <ZInput name="thkMm" type="number" step="0.01" placeholder="Thk mm" disabled={disabled} />
          <ZInput name="remark" placeholder="Remark" disabled={disabled} />
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <ZButton variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </ZButton>
            <ZButton type="submit" disabled={disabled || mut.isPending}>
              {mut.isPending ? 'Saving…' : 'Save'}
            </ZButton>
          </div>
        </form>
      </FormModal>
    </section>
  );
}
