import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZInput, ZSelect } from '../ui';
import { tubemillApi } from '../api/tubemillClient';

export default function DefectPanel({ runId, disabled }: { runId: string; disabled?: boolean }) {
  const qc = useQueryClient();
  const codes = useQuery({ queryKey: ['defect-codes'], queryFn: () => tubemillApi.getDefectCodes() });
  const list = useQuery({ queryKey: ['defects', runId], queryFn: () => tubemillApi.getDefects(runId) });
  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => tubemillApi.addDefect(runId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['defects', runId] }),
  });

  return (
    <section className="panel">
      <header className="panel__header">
        <span className="eyebrow">Defects</span>
      </header>
      <form
        className="panel__form"
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
          e.currentTarget.reset();
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
        <ZButton type="submit" disabled={disabled || mut.isPending}>
          Log defect
        </ZButton>
      </form>
      <ul className="panel__list">
        {(list.data ?? []).map((d) => (
          <li key={String(d.id)} className="mono">
            {String(d.defect_code)} · {String(d.pieces ?? '—')} pcs · {String(d.remark ?? '')}
          </li>
        ))}
      </ul>
    </section>
  );
}
