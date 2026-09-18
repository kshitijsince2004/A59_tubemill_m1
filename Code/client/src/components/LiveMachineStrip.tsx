import type { LiveData } from '../api/tubemillClient';
import { ZBadge } from '../ui';

interface Props {
  live: LiveData | undefined;
}

export default function LiveMachineStrip({ live }: Props) {
  if (!live) return <div className="panel">Waiting for live data…</div>;

  return (
    <div className="panel">
      <h2>Live Machine</h2>
      {live.outOfBand && (
        <div className="exception-banner" style={{ marginBottom: '0.75rem' }}>
          OUT OF BAND — weld power <span className="font-mono">{live.powerKw}</span> kW outside TM-02 window
          {live.outOfBandSince ? ` since ${new Date(live.outOfBandSince).toLocaleTimeString()}` : ''}
        </div>
      )}
      <div className="live-strip">
        <div className="metric">
          <div className="value">{live.speedMpm}</div>
          <div className="label">Speed (mpm)</div>
        </div>
        <div className="metric">
          <div className="value">{live.powerKw}</div>
          <div className="label">Weld Power (kW)</div>
        </div>
        <div className="metric">
          <div className="value">{live.currentAmp}</div>
          <div className="label">Current (A)</div>
        </div>
        <div className="metric">
          <div className="value">{live.pieceCount}</div>
          <div className="label">Piece Count</div>
        </div>
        <div className="metric">
          <div className="value">
            <ZBadge tone={live.inBand ? 'success' : 'danger'}>{live.inBand ? 'IN BAND' : 'OUT'}</ZBadge>
          </div>
          <div className="label">Band Status</div>
        </div>
        <div className="metric">
          <div className="value" style={{ fontSize: '1rem' }}>
            {live.runState.replace(/_/g, ' ')}
          </div>
          <div className="label">Mill State</div>
        </div>
      </div>
      {live.band && (
        <p className="font-mono" style={{ marginTop: '0.75rem', color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>
          TM-02 band: {live.band.powerKwMin}–{live.band.powerKwMax} kW · {live.band.speedMinMpm}–
          {live.band.speedMaxMpm} mpm
        </p>
      )}
      <div className="btn-row" style={{ marginTop: '0.75rem' }}>
        <ZBadge tone={live.lineRunning ? 'success' : 'warn'}>
          {live.lineRunning ? 'LINE RUNNING' : 'LINE STOPPED'}
        </ZBadge>
        <ZBadge tone={live.canCountAsGood ? 'success' : 'warn'}>
          {live.canCountAsGood ? 'COUNTS GOOD' : 'COUNTS SCRAP'}
        </ZBadge>
      </div>
    </div>
  );
}
