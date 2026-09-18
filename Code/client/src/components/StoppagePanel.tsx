import { useState } from 'react';
import type { StoppageCode } from '../api/tubemillClient';
import { ZButton, ZBadge, ZInput, ZSelect } from '../ui';

function isOpenFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(value).toLowerCase();
  return s === 't' || s === 'true' || s === '1' || s === 'yes';
}

interface Props {
  stoppages: Record<string, unknown>[];
  codes: StoppageCode[];
  onCode: (id: string, code: string, reason: string) => Promise<void>;
}

export default function StoppagePanel({ stoppages, codes, onCode }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const open = stoppages.filter((s) => isOpenFlag(s.is_open));

  return (
    <div className="panel" id="stoppage-panel">
      <h2>Stoppages</h2>
      <p className="eyebrow" style={{ margin: '0 0 8px' }}>
        {stoppages.length} recorded · {open.length} open
      </p>
      {stoppages.length === 0 && (
        <p style={{ color: 'var(--color-muted-foreground)' }}>No stoppages recorded yet.</p>
      )}
      {stoppages.length > 0 && (
        <div className="table-scroll">
          <table className="table data-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Code</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stoppages.map((s) => {
                const id = String(s.id);
                const openRow = isOpenFlag(s.is_open);
                return (
                  <tr key={id}>
                    <td className="mono">
                      {s.from_time ? new Date(String(s.from_time)).toLocaleTimeString() : '—'}
                    </td>
                    <td className="mono">
                      {s.to_time ? new Date(String(s.to_time)).toLocaleTimeString() : '—'}
                    </td>
                    <td className="mono">{String(s.stoppage_code ?? '—')}</td>
                    <td>{String(s.reason ?? s.remark ?? '—')}</td>
                    <td>
                      <ZBadge tone={openRow ? 'warn' : 'idle'}>{openRow ? 'OPEN' : 'CLOSED'}</ZBadge>
                    </td>
                    <td>
                      {openRow && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <ZSelect
                            value={selected[id] ?? ''}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [id]: e.target.value }))}
                            style={{ minHeight: 40, width: 'auto' }}
                          >
                            <option value="">Select code</option>
                            {codes.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} — {c.label}
                              </option>
                            ))}
                          </ZSelect>
                          <ZInput
                            placeholder="Reason"
                            value={reasons[id] ?? ''}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [id]: e.target.value }))}
                            style={{ minHeight: 40, width: 120 }}
                          />
                          <ZButton
                            variant="ghost"
                            size="sm"
                            disabled={!selected[id]}
                            onClick={() => void onCode(id, selected[id], reasons[id] ?? '')}
                          >
                            Code
                          </ZButton>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open.length > 0 && (
        <p style={{ color: 'var(--color-warning)', marginTop: '0.5rem', fontWeight: 600 }}>
          {open.length} open stoppage(s) — code before shift close.
        </p>
      )}
    </div>
  );
}
