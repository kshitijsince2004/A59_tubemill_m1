import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStoredUser, primaryRole } from '../lib/authStore';
import { drawBenchApi } from '../api/processApi';
import { stoppageApi } from '../api/plantApi';
import ProcessStationShell from '../components/process/ProcessStationShell';
import DrawBenchWorkOrderHub from '../components/drawbench/DrawBenchWorkOrderHub';
import DrawBenchBoard from '../components/drawbench/DrawBenchBoard';
import DrawBenchConsole from '../components/drawbench/DrawBenchConsole';
import DrawBenchHistory from '../components/drawbench/DrawBenchHistory';
import DrawBenchShiftCheckDialog from '../components/drawbench/DrawBenchShiftCheckDialog';
import StoppageDialog from '../components/StoppageDialog';
import { ProductionActionRail } from '../components/layout/operator';

const DRW_NAV = [
  { id: 'orders', icon: '▣', label: 'Work Order' },
  { id: 'capture', icon: '◎', label: 'Capture' },
  { id: 'history', icon: '▤', label: 'History' },
];

function formatElapsed(fromIso) {
  if (!fromIso) return '00:00:00';
  const ms = Date.now() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** Derive StatusRail / action-rail display status for a focused lot + stoppage. */
export function deriveDrwUiStatus(lot, openStoppage) {
  if (!lot) return 'IDLE';
  if (openStoppage) return 'STOPPAGE';
  if (lot.status === 'HOLD') return 'HOLD';
  if (lot.status === 'SUBMITTED' || lot.status === 'APPROVED') return 'COMPLETE';
  if (lot.productionEndedAt) return 'COMPLETE';
  if (lot.productionStartedAt && !lot.productionEndedAt) return 'RUNNING';
  if (lot.status === 'DRAFT' && lot.workOrderNo) return 'PREPARING';
  return 'IDLE';
}

export default function DrawBenchCapture({
  processes,
  processId,
  onProcessChange,
  onLogout,
  showAdmin,
  onAdmin,
  roleLabel,
}) {
  const role = primaryRole(getStoredUser());
  const isWritable = role !== 'PLANT_HEAD';
  const qc = useQueryClient();

  const [nav, setNav] = useState('orders');
  const [selectedId, setSelectedId] = useState(null);
  const [consoleMode, setConsoleMode] = useState(false);
  const [focusBench, setFocusBench] = useState('');
  const [activeWorkOrderNo, setActiveWorkOrderNo] = useState('');
  const [activeLotStatus, setActiveLotStatus] = useState('');
  const [railBusy, setRailBusy] = useState(false);
  const [stoppageDialogOpen, setStoppageDialogOpen] = useState(false);
  const [stoppageBusy, setStoppageBusy] = useState(false);
  const [shiftCheckOpen, setShiftCheckOpen] = useState(false);
  const [shiftCheckBusy, setShiftCheckBusy] = useState(false);
  const [shiftCheckErr, setShiftCheckErr] = useState('');
  const [railMsg, setRailMsg] = useState('');
  const [tick, setTick] = useState(0);

  const { data: boardRows = [] } = useQuery({
    queryKey: ['drw-board'],
    queryFn: () => drawBenchApi.board(),
    refetchInterval: 30_000,
  });

  const { data: lot } = useQuery({
    queryKey: ['drw-lot', selectedId],
    queryFn: () => drawBenchApi.getLot(selectedId),
    enabled: !!selectedId && consoleMode,
    refetchInterval: consoleMode ? 10_000 : false,
  });

  const { data: stoppages = [] } = useQuery({
    queryKey: ['drw-stoppages', selectedId],
    queryFn: () => stoppageApi.list('DRW', selectedId),
    enabled: !!selectedId && consoleMode,
    refetchInterval: consoleMode ? 5_000 : false,
  });

  const { data: stoppageCodes = [] } = useQuery({
    queryKey: ['stoppage-codes', 'DRW'],
    queryFn: () => stoppageApi.codes('DRW'),
    enabled: consoleMode,
  });

  const openStoppage = useMemo(
    () => (Array.isArray(stoppages) ? stoppages.find((s) => s.is_open || s.isOpen) : null) ?? null,
    [stoppages]
  );

  useEffect(() => {
    if (!consoleMode || !selectedId) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [consoleMode, selectedId]);

  useEffect(() => {
    if (!lot) return;
    if (lot.workOrderNo != null) setActiveWorkOrderNo(String(lot.workOrderNo || ''));
    if (lot.status != null) setActiveLotStatus(String(lot.status));
    if (lot.benchCode) setFocusBench(lot.benchCode);
  }, [lot]);

  const millStatus = useMemo(() => {
    if (consoleMode && selectedId) {
      return deriveDrwUiStatus(lot, openStoppage);
    }
    if (focusBench) {
      const row = boardRows.find((r) => r.benchCode === focusBench);
      if (row?.status) return String(row.status);
    }
    return 'IDLE';
  }, [consoleMode, selectedId, lot, openStoppage, focusBench, boardRows]);

  const displayStatus = millStatus;
  const started = Boolean(lot?.productionStartedAt);
  const ended = Boolean(lot?.productionEndedAt);
  const lotLocked = lot?.status === 'SUBMITTED' || lot?.status === 'APPROVED';
  const isHeld = lot?.status === 'HOLD';
  const canToggleHold =
    isWritable &&
    consoleMode &&
    !!selectedId &&
    (lot?.status === 'DRAFT' || lot?.status === 'HOLD');
  const jobActive =
    consoleMode &&
    !!selectedId &&
    isWritable &&
    !!lot &&
    (lot.status === 'DRAFT' || lot.status === 'HOLD');

  const actionPrimary =
    openStoppage || isHeld ? 'resume' : started ? 'end' : 'start';

  const actionTimer = useMemo(() => {
    void tick;
    if (openStoppage?.from_time || openStoppage?.fromTime) {
      return formatElapsed(openStoppage.from_time || openStoppage.fromTime);
    }
    if (started && !ended) return formatElapsed(lot.productionStartedAt);
    return '00:00:00';
  }, [tick, openStoppage, started, ended, lot]);

  const canOpenStoppage =
    isWritable &&
    !!selectedId &&
    displayStatus === 'RUNNING' &&
    !openStoppage &&
    !lotLocked;

  function clearConsole() {
    setConsoleMode(false);
    setSelectedId(null);
    setActiveWorkOrderNo('');
    setActiveLotStatus('');
    setRailMsg('');
  }

  function openLot(nextLot, benchCode) {
    if (nextLot?.id) setSelectedId(nextLot.id);
    if (nextLot?.workOrderNo) setActiveWorkOrderNo(String(nextLot.workOrderNo));
    if (nextLot?.status) setActiveLotStatus(String(nextLot.status));
    if (benchCode) setFocusBench(benchCode);
    else if (nextLot?.benchCode) setFocusBench(nextLot.benchCode);
    setConsoleMode(true);
    setNav('capture');
  }

  function openBench(row) {
    if (!row?.lotId) return;
    setFocusBench(row.benchCode);
    setSelectedId(row.lotId);
    setActiveWorkOrderNo(String(row.runningOrder?.workOrderNo ?? ''));
    setActiveLotStatus(String(row.lotStatus ?? row.status ?? ''));
    setConsoleMode(true);
  }

  async function invalidateLot() {
    await qc.invalidateQueries({ queryKey: ['drw-lot', selectedId] });
    await qc.invalidateQueries({ queryKey: ['drw-board'] });
    await qc.invalidateQueries({ queryKey: ['drw-lots'] });
    await qc.invalidateQueries({ queryKey: ['drw-stoppages', selectedId] });
  }

  async function handleStart() {
    if (!selectedId) return;
    setRailBusy(true);
    try {
      await drawBenchApi.start(selectedId);
      setRailMsg('Production started');
      await invalidateLot();
    } catch (e) {
      setRailMsg(e instanceof Error ? e.message : 'Start failed');
    } finally {
      setRailBusy(false);
    }
  }

  async function handleEnd() {
    if (!selectedId) return;
    setRailBusy(true);
    try {
      if (!lot?.productionEndedAt) {
        await drawBenchApi.end(selectedId);
      }
      await drawBenchApi.submit(selectedId);
      setRailMsg('Production ended and submitted');
      await invalidateLot();
    } catch (e) {
      const issues = Array.isArray(e?.issues)
        ? e.issues.map((i) => i.message).filter(Boolean).join('; ')
        : '';
      setRailMsg(
        issues || (e instanceof Error ? e.message : 'End / submit failed')
      );
    } finally {
      setRailBusy(false);
    }
  }

  async function handleShiftCheckConfirm(body) {
    if (!selectedId) return;
    setShiftCheckBusy(true);
    setShiftCheckErr('');
    try {
      await drawBenchApi.addShiftCheck(selectedId, body);
      setShiftCheckOpen(false);
      setRailMsg('Shift check saved');
      await invalidateLot();
    } catch (e) {
      setShiftCheckErr(e instanceof Error ? e.message : 'Shift check failed');
    } finally {
      setShiftCheckBusy(false);
    }
  }

  async function handleHoldToggle() {
    if (!selectedId) return;
    setRailBusy(true);
    try {
      if (lot?.status === 'HOLD') {
        await drawBenchApi.resume(selectedId);
        setRailMsg('Lot resumed from hold');
      } else {
        await drawBenchApi.hold(selectedId);
        setRailMsg('Lot held');
      }
      await invalidateLot();
    } catch (e) {
      setRailMsg(e instanceof Error ? e.message : 'Hold failed');
    } finally {
      setRailBusy(false);
    }
  }

  async function handleResumeFromStoppage() {
    if (!selectedId) return;
    setRailBusy(true);
    try {
      await stoppageApi.close('DRW', selectedId);
      setRailMsg('Stoppage ended');
      await invalidateLot();
    } catch (e) {
      setRailMsg(e instanceof Error ? e.message : 'Resume failed');
    } finally {
      setRailBusy(false);
    }
  }

  async function handleStoppageConfirm(body) {
    if (!selectedId) return;
    setStoppageBusy(true);
    try {
      if (openStoppage) {
        await stoppageApi.close('DRW', selectedId);
        setRailMsg('Stoppage ended');
      } else {
        await stoppageApi.open({
          processCode: 'DRW',
          sourceId: selectedId,
          millCode: focusBench || lot?.benchCode || 'DRW',
          stoppageCode: body.stoppageCode,
          reason: body.reason || body.remark || undefined,
        });
        setRailMsg('Stoppage opened');
      }
      setStoppageDialogOpen(false);
      await invalidateLot();
    } catch (e) {
      setRailMsg(e instanceof Error ? e.message : 'Stoppage failed');
    } finally {
      setStoppageBusy(false);
    }
  }

  const stoppageBanner =
    openStoppage && consoleMode ? (
      <div className="status-rail__stoppage">
        ■ Stoppage {String(openStoppage.stoppage_code ?? openStoppage.stoppageCode ?? 'UNCODED')}
        {openStoppage.reason ? ` / ${openStoppage.reason}` : ''}
        {' — since '}
        {new Date(String(openStoppage.from_time || openStoppage.fromTime)).toLocaleTimeString()}
      </div>
    ) : null;

  return (
    <>
      <ProcessStationShell
        processId={processId ?? 'DRW'}
        processLabel="Draw Bench"
        machineCode={focusBench || ''}
        crewSessionEnabled={Boolean(focusBench)}
        processes={processes}
        onProcessChange={onProcessChange}
        onLogout={onLogout}
        showAdmin={showAdmin}
        onAdmin={onAdmin}
        roleLabel={roleLabel}
        nav={nav}
        onNavChange={(id) => {
          setNav(id);
          if (id === 'orders' || id === 'history') {
            clearConsole();
          }
        }}
        navItems={DRW_NAV}
        millStatus={displayStatus}
        activeOrderId={activeWorkOrderNo || undefined}
        activeOrderStatus={
          consoleMode && selectedId
            ? displayStatus
            : activeLotStatus || undefined
        }
        hold={isHeld}
        hideCaptureHeader
        jobActive={jobActive}
        setupLabel="SHIFT CHECK"
        onSetup={
          consoleMode && selectedId && isWritable && !lotLocked && !isHeld
            ? () => {
                setShiftCheckErr('');
                setShiftCheckOpen(true);
              }
            : undefined
        }
        setupDisabled={!consoleMode || !selectedId || !isWritable || lotLocked || isHeld}
        onHold={canToggleHold ? () => void handleHoldToggle() : undefined}
        holdDisabled={!canToggleHold || railBusy}
        onManualStop={
          canOpenStoppage || openStoppage
            ? () => setStoppageDialogOpen(true)
            : undefined
        }
        manualStopDisabled={!canOpenStoppage && !openStoppage}
        stoppageBanner={stoppageBanner}
        actionRail={
          jobActive ? (
            <ProductionActionRail
              jobId={
                activeWorkOrderNo
                  ? `WO ${activeWorkOrderNo}`
                  : lot?.lotNo
                    ? `Lot ${lot.lotNo}`
                    : focusBench || 'DRW'
              }
              timer={actionTimer}
              statusLabel={displayStatus}
              primary={actionPrimary}
              busy={railBusy}
              disabled={!isWritable || lotLocked}
              hold={isHeld}
              onStart={() => void handleStart()}
              onResume={() =>
                void (isHeld ? handleHoldToggle() : handleResumeFromStoppage())
              }
              onEnd={() => void handleEnd()}
              onStoppage={() => setStoppageDialogOpen(true)}
              onHold={canToggleHold ? () => void handleHoldToggle() : undefined}
            />
          ) : null
        }
        ordersContent={
          <DrawBenchWorkOrderHub
            isWritable={isWritable}
            onMoveToProduction={(nextLot, bench) => openLot(nextLot, bench)}
          />
        }
        historyContent={
          <DrawBenchHistory
            onOpenLot={(nextLot) => {
              openLot(nextLot, nextLot.benchCode);
            }}
          />
        }
      >
        {consoleMode ? (
          <>
            {railMsg ? (
              <p
                className={`banner ${
                  /fail|error|cannot|required/i.test(railMsg)
                    ? 'banner--error'
                    : 'banner--ok'
                }`}
                style={{ margin: '8px 12px 0' }}
              >
                {railMsg}
              </p>
            ) : null}
            <DrawBenchConsole
              selectedId={selectedId}
              onSelectedId={setSelectedId}
              isWritable={isWritable}
              initialBenchCode={focusBench}
              runStatus={displayStatus}
              onBackToBoard={() => {
                clearConsole();
                setFocusBench('');
              }}
              onGoToOrders={() => {
                clearConsole();
                setFocusBench('');
                setNav('orders');
              }}
              onLotMeta={(meta) => {
                if (meta?.workOrderNo != null) setActiveWorkOrderNo(String(meta.workOrderNo || ''));
                if (meta?.status != null) setActiveLotStatus(String(meta.status));
                if (meta?.benchCode) setFocusBench(meta.benchCode);
              }}
            />
          </>
        ) : (
          <DrawBenchBoard
            onOpenBench={openBench}
            onAssigned={(nextLot, bench) => openLot(nextLot, bench)}
            onFocusBench={(code) => setFocusBench(code || '')}
          />
        )}
      </ProcessStationShell>

      <StoppageDialog
        open={stoppageDialogOpen}
        busy={stoppageBusy}
        mode={openStoppage ? 'manage' : 'open'}
        stoppageCodes={stoppageCodes}
        stoppages={stoppages}
        openStoppage={openStoppage}
        onCancel={() => setStoppageDialogOpen(false)}
        onConfirm={(body) => void handleStoppageConfirm(body)}
      />

      <DrawBenchShiftCheckDialog
        open={shiftCheckOpen}
        busy={shiftCheckBusy}
        benchCode={focusBench || lot?.benchCode || ''}
        shiftRef={lot?.shiftRef || 'A'}
        error={shiftCheckErr}
        onClose={() => {
          if (!shiftCheckBusy) {
            setShiftCheckOpen(false);
            setShiftCheckErr('');
          }
        }}
        onConfirm={(body) => void handleShiftCheckConfirm(body)}
      />
    </>
  );
}
