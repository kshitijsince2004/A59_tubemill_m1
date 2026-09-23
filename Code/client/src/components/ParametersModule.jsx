import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZBadge, statusTone } from '../ui';
import FormModal from './FormModal';
import ParamManualPanel from './ParamManualPanel';
import ParamReadingGrid from './ParamReadingGrid';
import { tubemillApi } from '../api/tubemillClient';

const DEFAULT_MILL = 'A-59';

function displayVal(v, unit = '') {
  if (v == null || v === '') return null;
  return unit ? `${v} ${unit}` : String(v);
}

function ContextField({ label, value, unit = '' }) {
  const shown = displayVal(value, unit);
  return (
    <div className="meta-grid__item">
      <label>{label}</label>
      <div className={`value font-mono${shown ? '' : ' muted'}`}>
        {shown ?? 'N/A'}
      </div>
    </div>
  );
}

/**
 * Independent Parameters module (TM-04).
 *
 * Machine-scoped records — no production-run ownership (no run_id).
 * When a RUNNING order exists for the mill, order + setup fields are
 * contextually auto-populated as DISPLAY ONLY.
 */
export default function ParametersModule({
  millCode = DEFAULT_MILL,
  disabled,
}) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-GB');
  const timeLabel = now.toLocaleTimeString('en-GB', { hour12: false });
  const hour = now.getHours();
  const shiftLabel = hour >= 6 && hour < 14 ? 'A' : hour >= 14 && hour < 22 ? 'B' : 'C';

  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ['param-context', millCode],
    queryFn: () => tubemillApi.getParamContext(millCode),
    enabled: Boolean(millCode),
    refetchInterval: 5_000,
  });

  const active = Boolean(ctx?.active);
  const order = ctx?.order;
  const fromOrder = ctx?.fromOrder ?? {};
  const fromSetup = ctx?.fromSetup ?? {};

  return (
    <div className="stack-gap">
      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">GLI-FT-PRD-TM-04 Mill Parameter Record</span>
          <ZBadge tone="idle">{millCode}</ZBadge>
        </header>
        <p className="muted" style={{ marginTop: 0 }}>
          Independent parameter records. Order and setup values are read for context only — they are not
          owned by the production run.
        </p>

        <div className="meta-grid" style={{ marginBottom: '0.75rem' }}>
          <div className="meta-grid__item">
            <label>Date</label>
            <div className="value font-mono">{dateLabel}</div>
          </div>
          <div className="meta-grid__item">
            <label>Shift</label>
            <div className="value font-mono">{shiftLabel}</div>
          </div>
          <div className="meta-grid__item">
            <label>Time</label>
            <div className="value font-mono">{timeLabel}</div>
          </div>
        </div>

        {ctxLoading ? (
          <p className="empty-hint">Checking running order…</p>
        ) : active ? (
          <div
            className="panel"
            style={{
              margin: '0 0 0.75rem',
              padding: '0.75rem 1rem',
              background: 'var(--surface-2, rgba(0,0,0,0.03))',
            }}
          >
            <div className="panel__header" style={{ marginBottom: '0.35rem' }}>
              <span className="eyebrow">Current running order</span>
              <ZBadge tone={statusTone(order?.runState ?? 'RUNNING')}>{order?.runState ?? 'RUNNING'}</ZBadge>
            </div>
            <div className="value font-mono" style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>
              {order?.workOrderNo ?? '—'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {[
                order?.customerCode ? `Customer: ${order.customerCode}` : null,
                order?.gradeCode ? `Grade: ${order.gradeCode}` : null,
                fromOrder.odMm != null ? `OD: ${fromOrder.odMm}` : null,
                fromOrder.thkMm != null ? `THK: ${fromOrder.thkMm}` : null,
                fromOrder.lengthMm != null ? `Length: ${fromOrder.lengthMm}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
        ) : (
          <div
            className="panel"
            style={{
              margin: '0 0 0.75rem',
              padding: '0.75rem 1rem',
              borderStyle: 'dashed',
            }}
          >
            <div className="panel__header" style={{ marginBottom: '0.25rem' }}>
              <span className="eyebrow">Current running order</span>
              <ZBadge tone="idle">NONE</ZBadge>
            </div>
            <div className="value">NO ACTIVE RUNNING ORDER</div>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              Order-derived fields show N/A. Do not enter OD, THK, or Grade manually.
            </p>
          </div>
        )}

        <h3 style={{ margin: '0.5rem 0 0.35rem', fontSize: '0.95rem' }}>
          From running order {active ? '' : '(waiting)'}
        </h3>
        <div className="meta-grid">
          <ContextField label="OD (PRC-04)" value={active ? fromOrder.odMm : null} unit="mm" />
          <ContextField label="THK (PRC-05)" value={active ? fromOrder.thkMm : null} unit="mm" />
          <ContextField label="Mat. grade (PRC-06)" value={active ? fromOrder.gradeCode : null} />
        </div>

        <h3 style={{ margin: '0.85rem 0 0.35rem', fontSize: '0.95rem' }}>From setup</h3>
        <div className="meta-grid">
          <ContextField label="ID tool size (PRC-09)" value={active ? fromSetup.idTool : null} />
          <ContextField label="OD tool size (PRC-10)" value={active ? fromSetup.odTool : null} />
          <ContextField label="Work coil ID (PRC-11)" value={active ? fromSetup.workCoilId : null} />
          <ContextField label="Impeder size (PRC-12)" value={active ? fromSetup.impederSize : null} />
          <ContextField label="Boggie size (PRC-13)" value={active ? fromSetup.boggieSize : null} />
          <ContextField
            label="Weld dia (PRC-14)"
            value={active ? fromSetup.weldDiaMm : null}
            unit="mm"
          />
        </div>

        <div className="btn-row" style={{ marginTop: '0.85rem' }}>
          <ZButton variant="primary" disabled={disabled} onClick={() => setFormOpen(true)}>
            Add reading
          </ZButton>
        </div>
      </section>

      <FormModal
        open={formOpen}
        eyebrow="TM-04 · MANUAL"
        title="Add parameter reading"
        description="Enter machine and coolant parameters for the current hour. Order/setup values stay display-only on the console."
        onClose={() => setFormOpen(false)}
        footer={null}
      >
        <ParamManualPanel
          disabled={disabled}
          initialWcToWrDistanceMm={active ? fromSetup.wcToWrDistanceMm ?? '' : ''}
          setupArgonUsed={active ? fromSetup.argonUsed ?? null : null}
          onCancel={() => setFormOpen(false)}
          onSave={async (data) => {
            await tubemillApi.saveMillParam({ millCode, ...data });
            void qc.invalidateQueries({ queryKey: ['mill-param-readings', millCode] });
            void qc.invalidateQueries({ queryKey: ['param-context', millCode] });
            setFormOpen(false);
          }}
        />
      </FormModal>

      <ParamReadingGrid millCode={millCode} />
    </div>
  );
}
