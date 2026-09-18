import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setDevRoleOverride, tubemillApi, type QueueCard, type Run } from '../api/tubemillClient';
import LiveMachineStrip from '../components/LiveMachineStrip';
import ToolingPanel from '../components/ToolingPanel';
import FirstOffGate from '../components/FirstOffGate';
import CoilInputFan from '../components/CoilInputFan';
import BundleFan from '../components/BundleFan';
import StoppagePanel from '../components/StoppagePanel';
import ParamManualPanel from '../components/ParamManualPanel';
import ConsumablesPanel from '../components/ConsumablesPanel';
import LoginScreen from '../components/LoginScreen';
import LiveStatusPage from '../components/LiveStatusPage';
import DefectPanel from '../components/DefectPanel';
import ArcWeldPanel from '../components/ArcWeldPanel';
import EdgeMillPanel from '../components/EdgeMillPanel';
import ParamChartAdmin from '../components/ParamChartAdmin';
import HoldDefectDialog from '../components/HoldDefectDialog';
import EndRunDialog from '../components/EndRunDialog';
import { ZButton, ZBadge, ZInput, SyncStatusBadge, statusTone } from '../ui';

type NavTab = 'queue' | 'capture' | 'history' | 'admin';
type QueueFilter = 'ALL' | 'Pending' | 'In Progress' | 'Hold' | 'Completed';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function useIstClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now) + ' IST'
  );
}

function formatElapsed(fromIso: string | null | undefined): string {
  if (!fromIso) return '00:00:00';
  const ms = Date.now() - new Date(fromIso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function TubeMillRunConsole() {
  const qc = useQueryClient();
  const clock = useIstClock();
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('a59-unlocked') === '1' || !!localStorage.getItem('a59-role'));
  const [nav, setNav] = useState<NavTab>('queue');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const [queueSearch, setQueueSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<QueueCard | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [supervisor, setSupervisor] = useState('SIC-Ravi');
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const role = localStorage.getItem('a59-role');
    if (role) setDevRoleOverride(role);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => tubemillApi.getSession(),
    staleTime: 60_000,
    enabled: unlocked,
  });

  const role = session?.role ?? localStorage.getItem('a59-role') ?? 'OPERATOR';

  const { data: queue = [], refetch: refetchQueue } = useQuery({
    queryKey: ['queue'],
    queryFn: () => tubemillApi.getQueue('A-59'),
    refetchInterval: 10000,
    enabled: unlocked,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['runs-history'],
    queryFn: () => tubemillApi.listRuns('A-59'),
    enabled: unlocked && nav === 'history',
  });

  const { data: consumables = [] } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => tubemillApi.getConsumables(),
    enabled: unlocked && !!run,
    refetchInterval: 15000,
  });

  const hold = run?.holdStatus === 'HELD';
  const lockedOrBeyond = run?.status === 'LOCKED';
  const readOnlyStatus = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run?.status ?? '') || hold;
  const jobActive =
    !!run && nav === 'capture' && run.status === 'DRAFT' && run.runState !== 'RUN_COMPLETE';
  const canSupervise = role === 'SUPERVISOR' || role === 'ADMIN';
  const canAdmin = role === 'ADMIN';
  const isWritable = role !== 'PLANT_HEAD';

  function isStoppageOpen(value: unknown): boolean {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    const s = String(value).toLowerCase();
    return s === 't' || s === 'true' || s === '1' || s === 'yes';
  }

  const { data: live } = useQuery({
    queryKey: ['live', run?.id],
    queryFn: () => tubemillApi.getLive(run!.id),
    enabled: !!run?.id && !lockedOrBeyond && unlocked,
    refetchInterval: 2000,
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['exceptions', run?.id],
    queryFn: () => tubemillApi.getExceptions(run!.id),
    enabled: !!run?.id && unlocked,
    refetchInterval: 3000,
  });

  const { data: coils = [] } = useQuery({
    queryKey: ['coils', run?.id],
    queryFn: () => tubemillApi.getCoils(run!.id),
    enabled: !!run?.id,
    refetchInterval: 5000,
  });

  const { data: bundles = [] } = useQuery({
    queryKey: ['bundles', run?.id],
    queryFn: () => tubemillApi.getBundles(run!.id),
    enabled: !!run?.id,
    refetchInterval: 5000,
  });

  const { data: stoppages = [] } = useQuery({
    queryKey: ['stoppages', run?.id],
    queryFn: () => tubemillApi.getStoppages(run!.id),
    enabled: !!run?.id,
    refetchInterval: 3000,
  });

  const { data: stoppageCodes = [] } = useQuery({
    queryKey: ['stoppageCodes'],
    queryFn: () => tubemillApi.getStoppageCodes(),
    enabled: unlocked,
  });

  const { data: yieldResult } = useQuery({
    queryKey: ['yield', run?.id],
    queryFn: () => tubemillApi.getYield(run!.id),
    enabled: !!run?.id,
    refetchInterval: 5000,
  });

  const filteredQueue = useMemo(() => {
    let list = queue;
    if (queueFilter === 'Pending') list = list.filter((c) => c.status === 'Pending');
    else if (queueFilter === 'In Progress') list = list.filter((c) => c.status === 'In Progress' || (c.status !== 'Pending' && c.status !== 'Hold' && c.status !== 'Completed'));
    else if (queueFilter === 'Hold') list = list.filter((c) => c.status === 'Hold');
    else if (queueFilter === 'Completed') list = list.filter((c) => c.status === 'Completed');
    const q = queueSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.workOrderNo.toLowerCase().includes(q) ||
          c.bcBatchNumber.toLowerCase().includes(q) ||
          c.customerCode.toLowerCase().includes(q) ||
          c.sizeKey.toLowerCase().includes(q),
      );
    }
    return list;
  }, [queue, queueFilter, queueSearch]);

  const pending = filteredQueue.filter((c) => c.status === 'Pending');
  const inProgress = filteredQueue.filter((c) => c.status !== 'Pending');
  const openStoppage = stoppages.find((s) => isStoppageOpen(s.is_open));
  const openExceptions = exceptions.filter((e) => e.is_open);
  const millStatus = live?.runState ?? run?.runState ?? 'IDLE';
  const changeDue = consumables.filter((c) => Boolean(c.changeDue));

  async function refreshRun(id: string) {
    const updated = await tubemillApi.getRun(id);
    setRun(updated);
    void qc.invalidateQueries({ queryKey: ['queue'] });
    void qc.invalidateQueries({ queryKey: ['coils', id] });
    void qc.invalidateQueries({ queryKey: ['bundles', id] });
    void qc.invalidateQueries({ queryKey: ['stoppages', id] });
    void qc.invalidateQueries({ queryKey: ['exceptions', id] });
    void qc.invalidateQueries({ queryKey: ['yield', id] });
    void qc.invalidateQueries({ queryKey: ['consumables'] });
    void qc.invalidateQueries({ queryKey: ['defects', id] });
    void qc.invalidateQueries({ queryKey: ['live-status'] });
  }

  async function handleOpenRun() {
    if (!selectedCard) return;
    setError('');
    setBusy(true);
    try {
      const opened = await tubemillApi.openRun(selectedCard.id);
      setRun(opened);
      setNav('capture');
      void qc.invalidateQueries({ queryKey: ['queue'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open run');
    } finally {
      setBusy(false);
    }
  }

  function scrollToStoppages() {
    document.getElementById('stoppage-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleStoppageClick() {
    if (!run || !isWritable || readOnlyStatus) {
      scrollToStoppages();
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (run.runState === 'RUNNING') {
        const updated = await tubemillApi.manualStop(run.id, { stoppageCode: 'TM-06', reason: 'Operator stoppage' });
        setRun(updated);
      }
      await qc.invalidateQueries({ queryKey: ['stoppages', run.id] });
      scrollToStoppages();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stoppage failed');
      scrollToStoppages();
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeRun(card: QueueCard) {
    setSelectedCard(card);
    if (!card.runId) return;
    setError('');
    setBusy(true);
    try {
      const loaded = await tubemillApi.getRun(card.runId);
      setRun(loaded);
      setNav('capture');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    } finally {
      setBusy(false);
    }
  }

  function closeCapture() {
    setRun(null);
    setNav('capture');
  }

  function logout() {
    localStorage.removeItem('a59-unlocked');
    localStorage.removeItem('a59-role');
    localStorage.removeItem('a59-badge');
    setDevRoleOverride(null);
    setUnlocked(false);
    setRun(null);
    setNav('queue');
  }

  const canEnd =
    !!run &&
    run.status === 'DRAFT' &&
    ['RUNNING', 'STOPPAGE', 'ROLL_CHANGE', 'SETUP', 'FIRST_OFF_PENDING'].includes(run.runState);

  if (!unlocked) {
    return (
      <LoginScreen
        onUnlocked={(r) => {
          localStorage.setItem('a59-unlocked', '1');
          localStorage.setItem('a59-role', r);
          setUnlocked(true);
        }}
      />
    );
  }

  return (
    <div className="operator-root">
      <nav className="nav-rail" aria-label="Primary">
        <img className="nav-rail__logo" src="/logo-nav.png" width={36} height={36} alt="Zedral" />
        <div className="nav-rail__divider" />
        <div className="nav-rail__stack">
          {(
            [
              ['queue', '▣', 'Orders'],
              ['capture', '◎', 'Capture'],
              ['history', '▤', 'History'],
              ['admin', '⚙', 'Admin'],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={`nav-rail__btn ${nav === id ? 'active' : ''}`}
              onClick={() => setNav(id)}
            >
              <span className="nav-rail__icon">{icon}</span>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="nav-rail__btn nav-rail__btn--logout" onClick={logout}>
          <span className="nav-rail__icon">↪</span>
          Logout
        </button>
      </nav>

      <div className={`content-column ${jobActive ? 'content-column--with-rail' : ''}`}>
        <header className="status-rail">
          <div className="status-rail__left">
            <span className="status-rail__line">A-59</span>
            <span className="status-rail__shift">Shift A</span>
          </div>
          <div className="status-rail__right">
            <ZBadge tone={statusTone(millStatus)} pulse={millStatus === 'RUNNING'}>
              {String(millStatus).replace(/_/g, ' ')}
            </ZBadge>
            {hold && <ZBadge tone="pending">HOLD</ZBadge>}
            <SyncStatusBadge />
            <span className="status-rail__clock">{clock}</span>
            <ZBadge tone="idle">{role}</ZBadge>
            {run && isWritable && (
              <ZButton
                variant="danger"
                size="sm"
                disabled={readOnlyStatus || run.runState === 'STOPPAGE'}
                onClick={() =>
                  void tubemillApi
                    .manualStop(run.id, { stoppageCode: 'TM-06', reason: 'Manual stop' })
                    .then(async (r) => {
                      setRun(r);
                      await qc.invalidateQueries({ queryKey: ['stoppages', run.id] });
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Stop failed'))
                }
              >
                MANUAL STOP
              </ZButton>
            )}
            <ZButton
              variant="accent"
              size="sm"
              disabled={!canSupervise}
              onClick={() =>
                void tubemillApi
                  .shiftBoundary('B')
                  .then(() => setMsg('Shift ended — open runs carried forward'))
                  .catch((e) => setError(e instanceof Error ? e.message : 'Shift failed'))
              }
            >
              END SHIFT
            </ZButton>
          </div>
        </header>

        {openStoppage && (
          <div className="status-rail__stoppage">
            ■ Stoppage {String(openStoppage.stoppage_code ?? 'UNCODED')} — since{' '}
            {new Date(String(openStoppage.from_time)).toLocaleTimeString()}
          </div>
        )}

        <main className="main-canvas">
          <div className="main-canvas__scroll">
            {msg && <p className="ok-text">{msg}</p>}
            {error && <p className="error-text">{error}</p>}

            {nav === 'capture' && !run && (
              <LiveStatusPage
                onOpenRun={(id) =>
                  void tubemillApi.getRun(id).then((r) => {
                    setRun(r);
                    setNav('capture');
                  })
                }
              />
            )}

            {nav === 'history' && (
              <section className="panel">
                <header className="panel__header">
                  <span className="eyebrow">History</span>
                </header>
                <ul className="panel__list">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className="linkish mono"
                        onClick={() => {
                          setRun(h);
                          setNav('capture');
                        }}
                      >
                        {h.runNo} · {h.workOrderNo} · {h.status} · {h.runState}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {nav === 'queue' && (
              <>
                <div className="page-header">
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="page-header__accent" />
                    <div>
                      <h1 className="page-header__title">Queue · A-59</h1>
                      <p className="page-header__sub">Shift A · {queue.length} orders</p>
                    </div>
                  </div>
                  <ZButton variant="ghost" size="sm" onClick={() => void refetchQueue()}>
                    ↻
                  </ZButton>
                </div>

                <div className="hub-toolbar">
                  <ZInput
                    placeholder="Search WO / batch / customer…"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    style={{ flex: 1, minWidth: '14rem', minHeight: 56 }}
                  />
                  <div className="filter-pills">
                    {(['ALL', 'Pending', 'In Progress', 'Hold', 'Completed'] as QueueFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`filter-pill ${queueFilter === f ? 'active' : ''}`}
                        onClick={() => setQueueFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hub-split">
                  <div className="panel">
                    <h2>Queue · {filteredQueue.length} orders</h2>
                    <div className="hub-list-scroll">
                      {(queueFilter === 'ALL' || queueFilter === 'Pending') && pending.length > 0 && (
                        <>
                          <div className="queue-group-header pending">Pending</div>
                          {pending.map((card) => (
                            <button
                              key={card.id}
                              type="button"
                              className={`queue-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                              onClick={() => setSelectedCard(card)}
                            >
                              <div className="eyebrow">
                                {card.customerCode} · A-59
                              </div>
                              <strong className="font-mono" style={{ fontSize: 16 }} title={card.workOrderNo}>
                                {card.workOrderNo}
                              </strong>
                              <div className="font-mono" style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
                                {card.sizeKey} · {card.gradeCode} · {card.bcBatchNumber}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <ZBadge tone="pending">PENDING</ZBadge>
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {(queueFilter === 'ALL' || queueFilter === 'In Progress' || queueFilter === 'Hold' || queueFilter === 'Completed') &&
                        inProgress.length > 0 && (
                          <>
                            <div className="queue-group-header">In Progress / other</div>
                            {inProgress.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                className={`queue-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                                disabled={busy}
                                onClick={() => void handleResumeRun(card)}
                              >
                                <strong className="font-mono" style={{ fontSize: 16 }}>
                                  {card.workOrderNo}
                                </strong>
                                <div className="font-mono" style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
                                  {card.sizeKey} · {card.customerCode}
                                </div>
                                <div style={{ marginTop: 6 }}>
                                  <ZBadge tone="info">{card.status.toUpperCase()}</ZBadge>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                    </div>
                  </div>

                  <div className="panel detail-pane">
                    <h2>Order Details</h2>
                    {selectedCard ? (
                      <>
                        <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
                          {selectedCard.workOrderNo}
                        </div>
                        <div className="meta-grid">
                          <div className="meta-grid__item">
                            <label>BC Batch</label>
                            <div className="value font-mono">{selectedCard.bcBatchNumber}</div>
                          </div>
                          <div className="meta-grid__item">
                            <label>Size</label>
                            <div className="value font-mono">{selectedCard.sizeKey}</div>
                          </div>
                          <div className="meta-grid__item">
                            <label>Grade</label>
                            <div className="value font-mono">{selectedCard.gradeCode}</div>
                          </div>
                          <div className="meta-grid__item">
                            <label>Customer</label>
                            <div className="value">{selectedCard.customerCode}</div>
                          </div>
                          <div className="meta-grid__item">
                            <label>Qty</label>
                            <div className="value font-mono">{selectedCard.qtyPieces ?? '—'} pcs</div>
                          </div>
                          <div className="meta-grid__item">
                            <label>Status</label>
                            <div className="value">
                              <ZBadge tone={statusTone(selectedCard.status)}>{selectedCard.status}</ZBadge>
                            </div>
                          </div>
                        </div>
                        <div className="detail-pane__footer btn-row">
                          <ZButton
                            variant="primary"
                            block
                            disabled={
                              selectedCard.status !== 'Pending' || busy || !!selectedCard.runId || !isWritable
                            }
                            onClick={() => void handleOpenRun()}
                          >
                            Move to Production…
                          </ZButton>
                          {selectedCard.runId && (
                            <ZButton variant="ghost" block disabled={busy} onClick={() => void handleResumeRun(selectedCard)}>
                              Open Run
                            </ZButton>
                          )}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--color-muted-foreground)' }}>Select a queue card.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {nav === 'admin' && (
              <div className="stack-gap">
                <div className="panel">
                  <h2>Admin</h2>
                  <div className="btn-row">
                    <ZButton
                      variant="primary"
                      disabled={!canAdmin}
                      onClick={() =>
                        void tubemillApi
                          .syncPlan()
                          .then((r) => {
                            setMsg(`ERP plan synced (${r.upserted} cards)`);
                            void qc.invalidateQueries({ queryKey: ['queue'] });
                          })
                          .catch((e) => setError(e instanceof Error ? e.message : 'Sync failed'))
                      }
                    >
                      ERP Sync Plan
                    </ZButton>
                    <ZButton
                      variant="ghost"
                      disabled={!isWritable}
                      onClick={() =>
                        void tubemillApi
                          .openShift('A')
                          .then(() => setMsg('Shift A opened'))
                          .catch((e) => setError(e instanceof Error ? e.message : 'Open shift failed'))
                      }
                    >
                      Open Shift A
                    </ZButton>
                  </div>
                </div>
                {canAdmin && <ParamChartAdmin />}
              </div>
            )}

            {nav === 'capture' && run && (
              <>
                <div className="process-header">
                  <div className="process-header__meta">
                    <h2 className="process-header__title">Production Console</h2>
                    <span className="font-mono" style={{ fontSize: 18, fontWeight: 700 }}>
                      {run.runNo}
                    </span>
                    <ZBadge tone="idle">A-59</ZBadge>
                    <ZBadge tone={statusTone(run.runState)}>{run.runState.replace(/_/g, ' ')}</ZBadge>
                    {hold && <ZBadge tone="pending">HOLD</ZBadge>}
                    {changeDue.length > 0 && <ZBadge tone="warn">TOOL CHANGE DUE</ZBadge>}
                  </div>
                  <button type="button" className="process-header__close" onClick={closeCapture} aria-label="Close capture">
                    ✕
                  </button>
                </div>

                {openExceptions.length > 0 && (
                  <div className="exception-banner">
                    <strong>OUT OF BAND</strong>
                    <span>
                      {openExceptions.map((e) => e.detail && typeof e.detail === 'object' && 'reason' in (e.detail as object)
                        ? String((e.detail as { reason: string }).reason)
                        : `${e.power_kw ?? ''} kW / ${e.speed_mpm ?? ''} mpm`).join(' · ')}
                    </span>
                    <span className="mono">since {new Date(openExceptions[0].opened_at).toLocaleTimeString()}</span>
                  </div>
                )}

                {yieldResult?.status === 'warn' && (
                  <div className="exception-banner exception-banner--warn">
                    <strong>YIELD</strong>
                    <span>{yieldResult.message}</span>
                  </div>
                )}

                {run.runState === 'RUNNING' && (
                  <div className="status-banner status-banner--running">
                    <span>Production Active</span>
                    <span className="status-banner__timer">{live?.pieceCount ?? 0} pcs</span>
                  </div>
                )}
                {run.runState === 'STOPPAGE' && (
                  <div className="status-banner status-banner--stoppage">
                    <span>
                      Stoppage Active{openStoppage?.stoppage_code ? ` · ${String(openStoppage.stoppage_code)}` : ''}
                    </span>
                  </div>
                )}

                <div className="panel">
                  <h2>Current Order</h2>
                  <div className="meta-grid">
                    <div className="meta-grid__item">
                      <label>Work Order</label>
                      <div className="value font-mono">{run.workOrderNo}</div>
                    </div>
                    <div className="meta-grid__item">
                      <label>Batch</label>
                      <div className="value font-mono">{run.bcBatchNumber}</div>
                    </div>
                    <div className="meta-grid__item">
                      <label>Size</label>
                      <div className="value font-mono">{run.sizeKey}</div>
                    </div>
                    <div className="meta-grid__item">
                      <label>Grade</label>
                      <div className="value font-mono">{run.gradeCode}</div>
                    </div>
                    <div className="meta-grid__item">
                      <label>Customer</label>
                      <div className="value">{run.customerCode}</div>
                    </div>
                  </div>
                  <div className="rollups">
                    <span>RM: {run.rawMaterialMt.toFixed(3)} MT</span>
                    <span>Prime: {run.totalPrimeMt.toFixed(3)} MT</span>
                    <span>Scrap: {run.totalScrapMt.toFixed(3)} MT</span>
                    <span>Yield: {run.yieldPct != null ? `${run.yieldPct}%` : '—'}</span>
                    {yieldResult && (
                      <ZBadge tone={yieldResult.status === 'warn' ? 'warn' : 'success'}>
                        Mass {yieldResult.status.toUpperCase()}
                        {yieldResult.deltaPct != null ? ` ${yieldResult.deltaPct}%` : ''}
                      </ZBadge>
                    )}
                  </div>
                </div>

                <LiveMachineStrip live={live} />

                <div className="grid-2">
                  {run.runState === 'SETUP' && (
                    <ToolingPanel
                      run={run}
                      disabled={readOnlyStatus}
                      onConfirm={async (data) => {
                        await tubemillApi.saveSetup(run.id, data);
                        await refreshRun(run.id);
                      }}
                    />
                  )}
                  <FirstOffGate
                    firstOffStatus={run.firstOffStatus}
                    runState={run.runState}
                    supervisor={supervisor}
                    onSupervisorChange={setSupervisor}
                    disabled={readOnlyStatus || run.runState !== 'FIRST_OFF_PENDING' || !canSupervise}
                    onPass={() => void tubemillApi.firstOff(run.id, 'PASS', supervisor).then(() => refreshRun(run.id))}
                    onFail={() => void tubemillApi.firstOff(run.id, 'FAIL', supervisor).then(() => refreshRun(run.id))}
                  />
                </div>

                <div className="grid-2">
                  <CoilInputFan
                    coils={coils}
                    disabled={readOnlyStatus}
                    onAdd={async (data) => {
                      await tubemillApi.addCoil(run.id, data);
                      await refreshRun(run.id);
                    }}
                  />
                  <BundleFan
                    bundles={bundles}
                    suggestedPieces={live?.pieceCount ?? 50}
                    disabled={readOnlyStatus}
                    onAdd={async (data) => {
                      await tubemillApi.addBundle(run.id, data);
                      await refreshRun(run.id);
                    }}
                  />
                </div>

                <div className="grid-2">
                  <ArcWeldPanel runId={run.id} coils={coils} disabled={readOnlyStatus} />
                  <EdgeMillPanel runId={run.id} coils={coils} disabled={readOnlyStatus} />
                </div>

                <div className="grid-2">
                  <StoppagePanel
                    stoppages={stoppages}
                    codes={stoppageCodes}
                    onCode={async (id, code, reason) => {
                      await tubemillApi.codeStoppage(id, code, reason);
                      await refreshRun(run.id);
                    }}
                  />
                  <DefectPanel runId={run.id} disabled={readOnlyStatus} />
                </div>

                <div className="grid-2">
                  <ParamManualPanel
                    disabled={readOnlyStatus}
                    onSave={async (data) => {
                      await tubemillApi.saveParamManual(run.id, data);
                    }}
                  />
                  <ConsumablesPanel
                    workCoilId={run.tooling?.workCoilId as string | undefined}
                    runId={run.id}
                    disabled={readOnlyStatus}
                  />
                </div>

                <div className="panel">
                  <h2>Lifecycle</h2>
                  <div className="btn-row">
                    <ZButton
                      variant="primary"
                      disabled={readOnlyStatus || run.status !== 'DRAFT' || !isWritable}
                      onClick={() =>
                        void tubemillApi
                          .submitRun(run.id)
                          .then((r) => setRun(r))
                          .catch((e) => setError(e instanceof Error ? e.message : 'Submit failed'))
                      }
                    >
                      SUBMIT
                    </ZButton>
                    <ZButton
                      variant="ghost"
                      disabled={!canSupervise || run.status !== 'SUBMITTED'}
                      onClick={() =>
                        void tubemillApi
                          .approveRun(run.id)
                          .then((r) => setRun(r))
                          .catch((e) => setError(e instanceof Error ? e.message : 'Approve failed'))
                      }
                    >
                      APPROVE
                    </ZButton>
                    <ZButton
                      variant="ghost"
                      disabled={!canSupervise || (run.status !== 'APPROVED' && run.status !== 'SUBMITTED')}
                      onClick={() =>
                        void tubemillApi
                          .lockRun(run.id)
                          .then((r) => setRun(r))
                          .catch((e) => setError(e instanceof Error ? e.message : 'Lock failed'))
                      }
                    >
                      LOCK
                    </ZButton>
                  </div>
                </div>

                <div className="panel">
                  <h2>Export</h2>
                  <div className="btn-row">
                    <ZButton
                      variant="ghost"
                      onClick={() =>
                        void tubemillApi.exportRun(run.id, 'dpr').then((d) => downloadJson(`${run.runNo}-dpr.json`, d))
                      }
                    >
                      Export DPR
                    </ZButton>
                    <ZButton
                      variant="ghost"
                      onClick={() =>
                        void tubemillApi.exportCsv(run.id).then((t) => downloadText(`${run.runNo}-dpr.csv`, t))
                      }
                    >
                      Export CSV
                    </ZButton>
                    <ZButton
                      variant="ghost"
                      onClick={() =>
                        void tubemillApi
                          .exportRun(run.id, 'shift-summary')
                          .then((d) => downloadJson(`${run.runNo}-shift.json`, d))
                      }
                    >
                      Shift Summary
                    </ZButton>
                    <ZButton
                      variant="ghost"
                      disabled={!canAdmin || !['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run.status)}
                      onClick={() =>
                        void tubemillApi
                          .writeback(run.id)
                          .then(() => setMsg('BC writeback logged'))
                          .catch((e) => setError(e instanceof Error ? e.message : 'Writeback failed'))
                      }
                    >
                      BC Writeback
                    </ZButton>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {jobActive && run && (
        <aside className="action-rail" aria-label="Production actions">
          <div className="action-rail__header">{run.runNo}</div>
          <div className="action-rail__stack">
            <ZButton
              variant="danger"
              disabled={!isWritable || !canEnd || busy}
              onClick={() => setEndDialogOpen(true)}
            >
              END
            </ZButton>
            <ZButton variant="ghost" disabled={busy} onClick={() => void handleStoppageClick()}>
              STOPPAGE
            </ZButton>
            <ZButton
              variant="accent"
              disabled={!isWritable || (readOnlyStatus && !hold) || busy}
              onClick={() => {
                if (hold) {
                  void tubemillApi
                    .resumeRun(run.id)
                    .then((r) => {
                      setRun(r);
                      void qc.invalidateQueries({ queryKey: ['queue'] });
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Resume failed'));
                } else {
                  setHoldDialogOpen(true);
                }
              }}
            >
              {hold ? 'RESUME' : 'HOLD'}
            </ZButton>
          </div>
          <div className="action-rail__footer">
            <span className="mono action-rail__timer">{formatElapsed(run.timeFrom)}</span>
            <ZBadge tone={statusTone(run.runState)}>{run.runState.replace(/_/g, ' ')}</ZBadge>
          </div>
        </aside>
      )}

      <HoldDefectDialog
        open={holdDialogOpen}
        busy={busy}
        onCancel={() => setHoldDialogOpen(false)}
        onConfirm={(payload) => {
          if (!run) return;
          setBusy(true);
          void (async () => {
            try {
              await tubemillApi.addDefect(run.id, payload);
              const held = await tubemillApi.holdRun(run.id, payload.remark);
              setRun(held);
              setHoldDialogOpen(false);
              void qc.invalidateQueries({ queryKey: ['queue'] });
              void qc.invalidateQueries({ queryKey: ['defects', run.id] });
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Hold failed');
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      <EndRunDialog
        open={endDialogOpen}
        busy={busy}
        onCancel={() => setEndDialogOpen(false)}
        onConfirm={(remark) => {
          if (!run) return;
          setBusy(true);
          void tubemillApi
            .endRun(run.id, remark)
            .then((r) => {
              setRun(r);
              setEndDialogOpen(false);
              void qc.invalidateQueries({ queryKey: ['queue'] });
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'End failed'))
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
