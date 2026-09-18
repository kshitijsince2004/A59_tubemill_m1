import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tubemillApi } from '../api/tubemillClient';
import { ZButton, ZBadge, ZInput } from '../ui';

interface Props {
  workCoilId: string | null | undefined;
  runId: string;
  disabled: boolean;
}

export default function ConsumablesPanel({ workCoilId, runId, disabled }: Props) {
  const qc = useQueryClient();
  const { data: consumables = [] } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => tubemillApi.getConsumables(),
    refetchInterval: 10000,
  });
  const [note, setNote] = useState('');
  const current = consumables.find((c) => String(c.code) === String(workCoilId));

  return (
    <div className="panel">
      <h2>Consumables / Tooling Life</h2>
      {current ? (
        <>
          <p>
            Work coil <strong className="font-mono">{String(current.code)}</strong> ·{' '}
            <span className="font-mono">{Number(current.cumulative_tonnage_mt ?? 0).toFixed(3)} MT</span> · uses{' '}
            <span className="font-mono">{String(current.cumulative_uses ?? 0)}</span>
          </p>
          {Boolean(current.changeDue) && (
            <div className="exception-banner" style={{ marginBottom: '0.75rem' }}>
              CHANGE DUE — replace threshold reached
            </div>
          )}
          <div className="form-row">
            <div>
              <label>Visual inspection</label>
              <ZInput value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} />
            </div>
          </div>
          <ZButton
            variant="ghost"
            disabled={disabled || !note}
            onClick={() =>
              void tubemillApi
                .inspectConsumable(String(current.code), note, 'INSPECT', runId)
                .then(() => {
                  setNote('');
                  void qc.invalidateQueries({ queryKey: ['consumables'] });
                })
            }
          >
            Record Inspection
          </ZButton>
        </>
      ) : (
        <p style={{ color: 'var(--color-muted-foreground)' }}>No work coil linked yet (confirm tooling first).</p>
      )}
      <table className="table" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Kind</th>
            <th>MT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {consumables.map((c) => (
            <tr key={String(c.code)}>
              <td>{String(c.code)}</td>
              <td>{String(c.kind)}</td>
              <td>{Number(c.cumulative_tonnage_mt ?? 0).toFixed(2)}</td>
              <td>
                <ZBadge tone={c.changeDue ? 'warn' : 'idle'}>
                  {c.changeDue ? 'CHANGE_DUE' : String(c.status)}
                </ZBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
