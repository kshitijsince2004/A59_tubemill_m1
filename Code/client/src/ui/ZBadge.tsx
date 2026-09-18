import type { ReactNode } from 'react';

type Tone = 'running' | 'success' | 'pending' | 'stopped' | 'warn' | 'setup' | 'info' | 'reject' | 'danger' | 'idle';

interface Props {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}

export default function ZBadge({ tone = 'idle', children, className = '', pulse }: Props) {
  return (
    <span className={`z-badge z-badge--${tone} ${pulse ? 'z-badge--pulse' : ''} ${className}`.trim()}>
      {pulse && <span className="z-badge__dot" aria-hidden />}
      {children}
    </span>
  );
}

/** Map mill / queue status strings to badge tones per brand accent rules. */
export function statusTone(status: string): Tone {
  const s = status.toUpperCase().replace(/\s+/g, '_');
  if (s === 'PENDING' || s === 'HOLD' || s === 'HELD') return 'pending';
  if (s === 'RUNNING' || s === 'IN_BAND' || s === 'PASS' || s === 'SYNCED' || s === 'LOCKED' || s === 'APPROVED')
    return 'success';
  if (s === 'STOPPAGE' || s === 'STOPPED' || s === 'FIRST_OFF_PENDING' || s === 'SUBMITTED') return 'warn';
  if (s === 'SETUP' || s === 'PREPARING' || s === 'IN_PROGRESS') return 'info';
  if (s === 'FAIL' || s === 'SCRAP' || s === 'OUT' || s === 'OUT_OF_BAND') return 'danger';
  return 'idle';
}
