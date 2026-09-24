import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setDevRoleOverride, tubemillApi } from '../api/tubemillClient';
import { erpApi } from '../api/erpApi';
import LiveStatusPage from '../components/LiveStatusPage';
import HoldDefectDialog from '../components/HoldDefectDialog';
import EndRunDialog from '../components/EndRunDialog';
import StoppageDialog from '../components/StoppageDialog';
import ProductionConsolePanel from '../components/ProductionConsolePanel';
import ParametersModule from '../components/ParametersModule';
import SetupModule from '../components/SetupModule';
import HistoryModule from '../components/HistoryModule';
import ParamChartAdmin from '../components/ParamChartAdmin';
import { OperatorShell, ProductionActionRail } from '../components/layout/operator';
import TubeMillHub from '../components/process/TubeMillHub';
import CaptureWorkspace from '../components/process/CaptureWorkspace';
import FirstOffGate from '../components/FirstOffGate';
import { ZButton } from '../ui';
import { getStoredUser, primaryRole, clearAuth } from '../lib/authStore';
import {
  listAllowedTmModules,
  defaultTmModule,
  normalizeTmModule,
  readTmModuleFromHash,
  writeTmModuleHash,
  TM_MODULES
} from '../lib/moduleAccess';
import { signOutSession } from '../lib/supertokens';
import { useIstClock, formatElapsed } from '../lib/operatorClock';
import CrewCaptureModal, { useCrewSession } from '../components/CrewCaptureModal';
import { HandoverAcceptGate } from '../components/HandoverAcceptGate';
import { useNavigate } from 'react-router-dom';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';

function ErpAdminStatus() {
  const { data: health } = useQuery({
    queryKey: ['erp-health'],
    queryFn: () => erpApi.health(),
    refetchInterval: 30_000
  });
  if (!health) return _jsx('p', { className: 'empty-hint', children: 'Loading ERP status…' });
  return _jsxs('div', {
    className: 'erp-admin-status',
    children: [
      _jsxs('p', {
        children: [
          'Adapter: ',
          _jsx('strong', { children: health.adapter }),
          ' · Outbox staged ',
          health.outbox.staged,
          ' · logged ',
          health.outbox.logged,
          ' · failed ',
          health.outbox.failed
        ]
      }),
      _jsxs('ul', {
        children: [
          health.watermarks.map((w) =>
            _jsxs(
              'li',
              {
                children: [
                  w.entity,
                  ': ',
                  w.status,
                  w.lastRunAt ? ` · ${new Date(w.lastRunAt).toLocaleString()}` : '',
                  ' · ',
                  w.rowCount,
                  ' rows',
                  w.lastError ? ` · ${w.lastError}` : ''
                ]
              },
              w.entity
            )
          ),
          !health.watermarks.length && _jsx('li', { children: 'No sync yet — run ERP Sync' })
        ]
      })
    ]
  });
}

function uiHeaderState(runState) {
  if (runState === 'STOPPAGE') return 'STOPPED';
  if (runState === 'RUN_COMPLETE') return 'COMPLETED';
  if (runState === 'IDLE') return 'IDLE';
  return runState;
}

function millStatusFromRun(run, openStoppage) {
  if (!run) return 'IDLE';
  if (openStoppage || run.runState === 'STOPPAGE') return 'STOPPED';
  if (run.runState === 'RUNNING') return 'RUNNING';
  if (run.runState === 'RUN_COMPLETE') return 'COMPLETED';
  if (run.runState === 'IDLE') return 'IDLE';
  return uiHeaderState(run.runState);
}

function actionPrimaryFor(run) {
  if (!run) return 'none';
  if (run.holdStatus === 'HELD') return 'none';
  const runState = run.runState;
  if (runState === 'IDLE' || runState === 'SETUP') return 'start';
  if (runState === 'STOPPAGE') return 'resume';
  if (runState === 'RUNNING') return 'end';
  return 'none';
}

export default function TubeMillRunConsole({
  processes,
  processId,
  onProcessChange,
  onLogout,
  showAdmin,
  onAdmin
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clock = useIstClock();
  const storedUser = getStoredUser();
  const navItems = useMemo(() => {
    const allowed = listAllowedTmModules(storedUser);
    const mods = allowed.length ? allowed : TM_MODULES;
    return mods.map((m) => ({ id: m.id, icon: m.icon, label: m.label }));
  }, [storedUser]);
  const [nav, setNavState] = useState(
    () => readTmModuleFromHash() ?? defaultTmModule(storedUser) ?? 'orders'
  );

  function setNav(id) {
    const next = normalizeTmModule(id) ?? id;
    setNavState(next);
    if (next === 'orders' || next === 'capture' || next === 'parameters' || next === 'history') {
      writeTmModuleHash(next);
    }
  }

  const [queueFilter, setQueueFilter] = useState('ALL');
  const [queueSearch, setQueueSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [run, setRun] = useState(null);
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [stoppageDialogOpen, setStoppageDialogOpen] = useState(false);
  const [machineHeadRef, setMachineHeadRef] = useState('MH-Ravi');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [, setTick] = useState(0);

  const millCode = 'A-59';
  const crew = useCrewSession(millCode, { shiftCode: 'A', enabled: true });

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => tubemillApi.getSession(),
    staleTime: 60_000
  });

  const role =
    session?.role ?? primaryRole(getStoredUser()) ?? localStorage.getItem('a59-role') ?? 'OPERATOR';

  const { data: queue = [], refetch: refetchQueue } = useQuery({
    queryKey: ['queue'],
    queryFn: () => tubemillApi.getQueue('A-59'),
    refetchInterval: 10_000
  });

  const hold = run?.holdStatus === 'HELD';
  const readOnlyStatus =
    ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run?.status ?? '') || hold;
  const canMachineHead = role === 'MACHINE_HEAD' || role === 'ADMIN';
  const canAdmin = role === 'ADMIN';
  const isWritable = role !== 'PLANT_HEAD';
  const setupAvailable = true;

  function isStoppageOpen(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    const s = String(value).toLowerCase();
    return s === 't' || s === 'true' || s === '1' || s === 'yes';
  }

  const { data: stoppages = [] } = useQuery({
    queryKey: ['stoppages', run?.id],
    queryFn: () => tubemillApi.getStoppages(run.id),
    enabled: !!run?.id,
    refetchInterval: 3000
  });

  const { data: stoppageCodes = [] } = useQuery({
    queryKey: ['stoppageCodes'],
    queryFn: () => tubemillApi.getStoppageCodes()
  });

  const filteredQueue = useMemo(() => {
    let list = queue;
    if (queueFilter === 'Pending') list = list.filter((c) => c.status === 'Pending');
    else if (queueFilter === 'In Progress')
      list = list.filter(
        (c) =>
          c.status === 'In Progress' ||
          (c.status !== 'Pending' && c.status !== 'Hold' && c.status !== 'Completed')
      );
    else if (queueFilter === 'Hold') list = list.filter((c) => c.status === 'Hold');
    else if (queueFilter === 'Completed') list = list.filter((c) => c.status === 'Completed');
    const q = queueSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.workOrderNo.toLowerCase().includes(q) ||
          c.bcBatchNumber.toLowerCase().includes(q) ||
          c.customerCode.toLowerCase().includes(q) ||
          c.sizeKey.toLowerCase().includes(q)
      );
    }
    return list;
  }, [queue, queueFilter, queueSearch]);

  const pending = filteredQueue.filter((c) => c.status === 'Pending');
  const inProgress = filteredQueue.filter((c) => c.status !== 'Pending');
  const openStoppage = stoppages.find((s) => isStoppageOpen(s.is_open));
  const millStatus = millStatusFromRun(run, openStoppage);
  const jobActive =
    !!run && nav === 'capture' && run.status === 'DRAFT' && run.runState !== 'RUN_COMPLETE';
  const actionPrimary = actionPrimaryFor(run);
  const actionTimer =
    run?.runState === 'RUNNING' && run.timeFrom
      ? formatElapsed(run.timeFrom)
      : run?.runState === 'STOPPAGE' && openStoppage?.from_time
        ? formatElapsed(openStoppage.from_time)
        : '00:00:00';
  const actionStatusLabel = millStatusFromRun(run, openStoppage);

  function routeAfterLoad(loaded) {
    if (!loaded) return;
    setNav('capture');
  }

  async function handleOpenRun() {
    if (!selectedCard) return;
    setError('');
    setBusy(true);
    try {
      const opened = await tubemillApi.openRun(selectedCard.id);
      setRun(opened);
      routeAfterLoad(opened);
      void qc.invalidateQueries({ queryKey: ['queue'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open run');
    } finally {
      setBusy(false);
    }
  }

  async function handleStartProduction() {
    if (!run) return;
    setError('');
    setBusy(true);
    try {
      const updated = await tubemillApi.startRun(run.id);
      setRun(updated);
      await qc.invalidateQueries({ queryKey: ['stoppages', run.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed');
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleManualStop(body) {
    if (!run) return;
    setError('');
    setBusy(true);
    try {
      const updated = await tubemillApi.manualStop(run.id, body);
      setRun(updated);
      await qc.invalidateQueries({ queryKey: ['stoppages', run.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stop failed');
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProduction(partial) {
    if (!run) return;
    setError('');
    setBusy(true);
    try {
      const updated = await tubemillApi.updateProduction(run.id, partial);
      setRun(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Production save failed');
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleActionStoppage() {
    if (!run || !isWritable || readOnlyStatus) return;
    if (run.runState !== 'RUNNING' && run.runState !== 'STOPPAGE') {
      setError('Stoppage is only available while RUNNING or STOPPED');
      return;
    }
    setError('');
    setStoppageDialogOpen(true);
  }

  async function handleStoppageConfirm(body) {
    if (!run) return;
    try {
      await handleManualStop(body);
      setStoppageDialogOpen(false);
      setMsg(run.runState === 'STOPPAGE' ? 'Stoppage details saved' : 'Stoppage logged');
    } catch {
      /* error already set in handleManualStop */
    }
  }

  function handleActionRemark() {
    if (!run || !isWritable || readOnlyStatus) return;
    const text = window.prompt('Remark');
    if (text == null) return;
    const remark = text.trim();
    if (!remark) return;
    setBusy(true);
    void tubemillApi
      .addRemark(run.id, remark)
      .then((r) => {
        setRun(r);
        setMsg('Remark saved');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Remark failed'))
      .finally(() => setBusy(false));
  }

  async function handleResumeRun(card) {
    setSelectedCard(card);
    if (!card.runId) return;
    setError('');
    setBusy(true);
    try {
      const loaded = await tubemillApi.getRun(card.runId);
      setRun(loaded);
      routeAfterLoad(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    } finally {
      setBusy(false);
    }
  }

  function closeCapture() {
    setRun(null);
    setNav('orders');
  }

  function handleLogout() {
    if (onLogout) {
      onLogout();
      return;
    }
    void signOutSession();
    clearAuth();
    localStorage.removeItem('a59-unlocked');
    localStorage.removeItem('a59-role');
    localStorage.removeItem('a59-badge');
    setDevRoleOverride(null);
    setRun(null);
    setNav('orders');
    window.location.reload();
  }

  function handleNavChange(id) {
    if (id === 'admin' && onAdmin && !showAdmin) {
      onAdmin();
      return;
    }
    setNav(id);
  }

  const canEnd =
    !!run &&
    run.status === 'DRAFT' &&
    ['RUNNING', 'STOPPAGE', 'ROLL_CHANGE', 'SETUP', 'FIRST_OFF_PENDING', 'IDLE'].includes(
      run.runState
    );

  return _jsxs(_Fragment, {
    children: [
      _jsx(HandoverAcceptGate, {
        machineCode: millCode,
        onHandoverAccepted: () => void crew.refresh(),
        children: _jsxs(OperatorShell, {
        nav,
        onNavChange: handleNavChange,
        showAdmin: showAdmin || canAdmin,
        onLogout: handleLogout,
        navItems,
        machineCode: 'A-59',
        shiftLabel: 'Shift A',
        millStatus,
        activeOrderId: run?.workOrderNo ?? run?.runNo ?? null,
        activeOrderStatus: run ? (hold ? 'HOLD' : uiHeaderState(run.runState)) : null,
        hold,
        clock,
        roleLabel: role,
        processes,
        processId,
        onProcessChange,
        onSetup: () => setNav('setup'),
        setupDisabled: !setupAvailable,
        onReadings: () => setNav('parameters'),
        onManualStop:
          run && isWritable && nav === 'capture'
            ? () => {
                if (run.runState === 'RUNNING' || run.runState === 'STOPPAGE') {
                  setStoppageDialogOpen(true);
                }
              }
            : undefined,
        manualStopDisabled:
          !run ||
          readOnlyStatus ||
          !['RUNNING', 'STOPPAGE'].includes(run.runState) ||
          nav !== 'capture',
        onEndShift: () =>
          navigate(`/handover?machine=${encodeURIComponent(millCode)}&process=TM`),
        endShiftDisabled: false,
        stoppageBanner: openStoppage
          ? _jsxs('div', {
              className: 'status-rail__stoppage',
              children: [
                '■ Stoppage ',
                String(openStoppage.stoppage_code ?? 'UNCODED'),
                openStoppage.reason ? ` / ${openStoppage.reason}` : '',
                ' — since ',
                new Date(String(openStoppage.from_time)).toLocaleTimeString()
              ]
            })
          : undefined,
        jobActive,
        actionRail:
          jobActive && run
            ? _jsx(ProductionActionRail, {
                jobId: run.workOrderNo
                  ? `WO ${run.workOrderNo}`
                  : `Run ${run.runNo}`,
                timer: actionTimer,
                statusLabel: actionStatusLabel,
                primary: actionPrimary,
                busy,
                disabled: !isWritable || readOnlyStatus,
                hold,
                onStart: () => void handleStartProduction(),
                onResume: () => void handleStartProduction(),
                onEnd: () => {
                  if (canEnd) setEndDialogOpen(true);
                },
                onStoppage: () => void handleActionStoppage(),
                onRemark: () => handleActionRemark(),
                onHold: () => {
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
                }
              })
            : undefined,
        children: [
          msg && _jsx('p', { className: 'ok-text', children: msg }),
          error && _jsx('p', { className: 'error-text', children: error }),

          nav === 'setup' &&
            _jsx(SetupModule, {
              millCode: 'A-59',
              disabled: !isWritable
            }),

          nav === 'parameters' &&
            _jsx(ParametersModule, {
              millCode: 'A-59',
              disabled: !isWritable
            }),

          nav === 'capture' &&
            !run &&
            _jsx(LiveStatusPage, {
              millCode: 'A-59',
              onGoOrders: () => setNav('orders'),
              onOpenRun: (id) =>
                void tubemillApi.getRun(id).then((r) => {
                  setRun(r);
                  routeAfterLoad(r);
                })
            }),

          nav === 'history' &&
            _jsx(HistoryModule, {
              millCode: 'A-59',
              onOpenRun: (h) => {
                const id = h?.id;
                if (!id) return;
                setError('');
                setBusy(true);
                void tubemillApi
                  .getRun(id)
                  .then((r) => {
                    setRun(r);
                    routeAfterLoad(r);
                  })
                  .catch((e) => {
                    setError(e instanceof Error ? e.message : 'Failed to load run');
                  })
                  .finally(() => setBusy(false));
              }
            }),

          nav === 'orders' &&
            _jsx(TubeMillHub, {
              machineCode: 'A-59',
              processLabel: 'Tube Mill',
              shiftLabel: 'Shift A',
              queue,
              filteredQueue,
              pending,
              inProgress,
              queueFilter,
              onFilterChange: setQueueFilter,
              queueSearch,
              onSearchChange: setQueueSearch,
              selectedCard,
              onSelectCard: setSelectedCard,
              busy,
              isWritable,
              onRefresh: () => void refetchQueue(),
              onOpenRun: () => void handleOpenRun(),
              onResumeRun: (card) => void handleResumeRun(card)
            }),

          nav === 'admin' &&
            _jsxs('div', {
              className: 'stack-gap',
              children: [
                _jsxs('div', {
                  className: 'panel',
                  children: [
                    _jsx('h2', { children: 'Admin' }),
                    _jsxs('div', {
                      className: 'btn-row',
                      children: [
                        _jsx(ZButton, {
                          variant: 'primary',
                          disabled: !canAdmin,
                          onClick: () =>
                            void erpApi
                              .sync()
                              .then((r) => {
                                const n = r.results.reduce((s, x) => s + x.upserted, 0);
                                setMsg(
                                  `ERP sync OK (${n} upserts across ${r.results.length} entities)`
                                );
                                void qc.invalidateQueries({ queryKey: ['queue'] });
                                void qc.invalidateQueries({ queryKey: ['erp-health'] });
                                void qc.invalidateQueries({ queryKey: ['erp-orders'] });
                              })
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : 'Sync failed')
                              ),
                          children: 'ERP Sync'
                        }),
                        _jsx(ZButton, {
                          variant: 'ghost',
                          disabled: !canAdmin,
                          onClick: () =>
                            void tubemillApi
                              .syncPlan()
                              .then((r) => {
                                setMsg(`ERP plan synced (${r.upserted} cards)`);
                                void qc.invalidateQueries({ queryKey: ['queue'] });
                                void qc.invalidateQueries({ queryKey: ['erp-orders'] });
                              })
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : 'Sync failed')
                              ),
                          children: 'Sync plan (orders)'
                        }),
                        _jsx(ZButton, {
                          variant: 'ghost',
                          disabled: !canAdmin,
                          onClick: () =>
                            void erpApi
                              .flushWriteback()
                              .then((r) => {
                                setMsg(
                                  `Write-back flush: ${r.flushed} logged, ${r.failed} failed`
                                );
                                void qc.invalidateQueries({ queryKey: ['erp-health'] });
                              })
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : 'Flush failed')
                              ),
                          children: 'Flush write-back'
                        }),
                        _jsx(ZButton, {
                          variant: 'ghost',
                          disabled: !isWritable,
                          onClick: () =>
                            void tubemillApi
                              .openShift('A')
                              .then(() => setMsg('Shift A opened'))
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : 'Open shift failed')
                              ),
                          children: 'Open Shift A'
                        }),
                        onAdmin
                          ? _jsx(ZButton, {
                              variant: 'ghost',
                              onClick: onAdmin,
                              children: 'Open Admin Console'
                            })
                          : null
                      ]
                    }),
                    canAdmin && _jsx(ErpAdminStatus, {})
                  ]
                }),
                canAdmin && _jsx(ParamChartAdmin, {})
              ]
            }),

          nav === 'capture' &&
            run &&
            _jsx(CaptureWorkspace, {
              title: 'Capture',
              workOrderNo: run.workOrderNo,
              runNo: run.runNo,
              machineCode: 'A-59',
              runState: uiHeaderState(run.runState),
              hold,
              onClose: closeCapture,
              children: _jsxs(_Fragment, {
                children: [
                  canMachineHead
                    ? _jsx(FirstOffGate, {
                        firstOffStatus: run.firstOffStatus,
                        machineHead: machineHeadRef,
                        onMachineHeadChange: setMachineHeadRef,
                        runState: run.runState,
                        disabled: !canMachineHead || busy,
                        onPass: () =>
                          void tubemillApi
                            .firstOff(run.id, 'PASS', machineHeadRef)
                            .then((r) => {
                              setRun(r);
                              setMsg('First-off PASS');
                            })
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : 'First-off failed')
                            ),
                        onFail: () =>
                          void tubemillApi
                            .firstOff(run.id, 'FAIL', machineHeadRef)
                            .then((r) => {
                              setRun(r);
                              setMsg('First-off FAIL');
                            })
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : 'First-off failed')
                            )
                      })
                    : null,
                  canMachineHead && run.status === 'SUBMITTED'
                    ? _jsxs('div', {
                        className: 'panel btn-row',
                        children: [
                          _jsx(ZButton, {
                            variant: 'primary',
                            disabled: busy,
                            onClick: () =>
                              void tubemillApi
                                .approveRun(run.id)
                                .then((r) => {
                                  setRun(r);
                                  setMsg('Run approved');
                                  void qc.invalidateQueries({ queryKey: ['queue'] });
                                })
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : 'Approve failed')
                                ),
                            children: 'Approve run'
                          })
                        ]
                      })
                    : null,
                  _jsx(ProductionConsolePanel, {
                    run,
                    busy,
                    disabled: !isWritable || readOnlyStatus,
                    onSaveProduction: (partial) => handleSaveProduction(partial)
                  })
                ]
              })
            })
        ]
      })
      }),

      _jsx(StoppageDialog, {
        open: stoppageDialogOpen,
        busy,
        mode: run?.runState === 'STOPPAGE' || openStoppage ? 'manage' : 'open',
        stoppageCodes,
        stoppages,
        openStoppage: openStoppage ?? null,
        onCancel: () => setStoppageDialogOpen(false),
        onConfirm: (body) => void handleStoppageConfirm(body)
      }),

      _jsx(HoldDefectDialog, {
        open: holdDialogOpen,
        busy,
        onCancel: () => setHoldDialogOpen(false),
        onConfirm: (payload) => {
          if (!run) return;
          setBusy(true);
          void (async () => {
            try {
              await tubemillApi.addDefect(run.id, payload);
              const held = await tubemillApi.holdRun(run.id, payload.remark);
              setRun(held);
              setHoldDialogOpen(false);
              void qc.invalidateQueries({ queryKey: ['queue'] });
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Hold failed');
            } finally {
              setBusy(false);
            }
          })();
        }
      }),

      _jsx(EndRunDialog, {
        open: endDialogOpen,
        busy,
        run,
        onCancel: () => setEndDialogOpen(false),
        onConfirm: (remark) => {
          if (!run) return;
          setBusy(true);
          void tubemillApi
            .endRun(run.id, remark)
            .then((r) => {
              setRun(r);
              setEndDialogOpen(false);
              setMsg('Production run completed');
              void qc.invalidateQueries({ queryKey: ['queue'] });
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'End failed'))
            .finally(() => setBusy(false));
        }
      }),

      _jsx(CrewCaptureModal, {
        open: crew.showModal,
        machineCode: millCode,
        sessionId: crew.sessionId,
        onClose: () => crew.setShowModal(false),
        onAttached: () => void crew.refresh()
      }),

      crew.conflictCode === 'ACTIVE_SESSION_CONFLICT'
        ? _jsxs('div', {
            style: {
              position: 'fixed',
              inset: 0,
              zIndex: 190,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: 'rgba(248,250,252,0.92)',
              padding: 24,
            },
            children: [
              _jsx('p', {
                style: { textAlign: 'center', maxWidth: 420, margin: 0 },
                children:
                  'Another operator already holds the active session on A-59. Ask them to end shift / hand over, or sign in as that operator.',
              }),
              _jsx(ZButton, {
                variant: 'secondary',
                onClick: () => void crew.refresh(),
                children: 'Check again',
              }),
            ],
          })
        : null
    ]
  });
}
