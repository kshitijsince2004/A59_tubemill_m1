import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { stpApi } from '../api/processApi';
import { downloadXlsx, stoppageApi } from '../api/plantApi';
import { ZButton, ZInput, ZSelect, ZBadge, ZOperatorCard, ZPageHeader, statusTone } from '../ui';
import { getStoredUser, primaryRole } from '../lib/authStore';
import ProcessStationShell from '../components/process/ProcessStationShell';
import StoppageDialog from '../components/StoppageDialog';
import StpBathAnalysisModal from '../components/stp/StpBathAnalysisModal';
import StpChemicalAdditionModal from '../components/stp/StpChemicalAdditionModal';
import StpProcessMonitor from '../components/stp/StpProcessMonitor';
import StpMachineOverview from '../components/stp/StpMachineOverview';
import StpBathChemPanel from '../components/stp/StpBathChemPanel';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';

const STP_NAV_ITEMS = [
  { id: 'order', icon: '▣', label: 'Order' },
  { id: 'capture', icon: '◎', label: 'Capture' },
  { id: 'monitoring', icon: '◈', label: 'Monitoring' },
  { id: 'history', icon: '▤', label: 'History' },
];

const ORDER_SUB = [
  { id: 'work-orders', label: 'Work Orders' },
  { id: 'console', label: 'Production Console' },
];

const CAPTURE_SUB = [
  { id: 'production', label: 'Production' },
  { id: 'bath', label: 'Bath Analysis' },
  { id: 'chem', label: 'Chemical Addition' },
  { id: 'remarks', label: 'Remarks / Stoppage' },
];

const HIST_SEGS = [
  { id: 'production', label: 'Production' },
  { id: 'process', label: 'Process' },
  { id: 'bath', label: 'Bath' },
  { id: 'chemical', label: 'Chemical' },
  { id: 'stoppage', label: 'Stoppage' },
];

function isStoppageOpen(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(value).toLowerCase();
  return s === 't' || s === 'true' || s === '1' || s === 'yes';
}

function sizeParts(size) {
  const s = size && typeof size === 'object' ? size : {};
  return {
    od: s.od ?? s.OD ?? s.odMm ?? s.outerDia ?? '',
    thk: s.thk ?? s.TH ?? s.thkMm ?? s.thickness ?? '',
    len: s.len ?? s.length ?? s.lengthMm ?? s.LEN ?? '',
    slit: s.slit ?? s.slitWidth ?? s.slitWidthMm ?? s.slit_width ?? '',
    profile: s.profile ?? s.shape ?? '',
  };
}

function fmtSize(size) {
  const p = sizeParts(size);
  const bits = [];
  if (p.od !== '' && p.od != null) bits.push(`OD ${p.od}`);
  if (p.slit !== '' && p.slit != null) bits.push(`Slit ${p.slit}`);
  if (p.thk !== '' && p.thk != null) bits.push(`TH ${p.thk}`);
  if (p.len !== '' && p.len != null) bits.push(`L ${p.len}`);
  return bits.join(' · ') || '—';
}

function clockStatus(lot, openStoppage) {
  if (!lot) return 'IDLE';
  if (openStoppage) return 'STOPPAGE';
  if (lot.productionEndedAt) return 'COMPLETE';
  if (lot.productionStartedAt) return 'RUNNING';
  return 'IDLE';
}

function numOrUndef(v) {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SubNav({ items, active, onChange }) {
  return /*#__PURE__*/ _jsx('div', {
    className: 'stp-subnav',
    role: 'tablist',
    children: items.map((item) =>
      /*#__PURE__*/ _jsx(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': active === item.id,
          className: `stp-subnav__btn${active === item.id ? ' is-active' : ''}`,
          onClick: () => onChange(item.id),
          children: item.label,
        },
        item.id
      )
    ),
  });
}

function RoField({ label, value }) {
  return /*#__PURE__*/ _jsxs('div', {
    className: 'stp-ro-field',
    children: [
      /*#__PURE__*/ _jsx('span', { children: label }),
      /*#__PURE__*/ _jsx('strong', { children: value == null || value === '' ? '—' : String(value) }),
    ],
  });
}

export default function StpCapture({
  processes,
  processId,
  onProcessChange,
  onLogout,
  showAdmin,
  onAdmin,
  roleLabel,
}) {
  const qc = useQueryClient();
  const role = primaryRole(getStoredUser());
  const canMachineHead = role === 'MACHINE_HEAD' || role === 'ADMIN';
  const isWritable = role !== 'PLANT_HEAD';

  const [nav, setNav] = useState('order');
  const [orderSub, setOrderSub] = useState('work-orders');
  const [captureSub, setCaptureSub] = useState('production');
  const [histSeg, setHistSeg] = useState('production');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedWo, setSelectedWo] = useState(null);
  const [selectedLineNo, setSelectedLineNo] = useState(null);
  const [woFilter, setWoFilter] = useState('');
  const [histWo, setHistWo] = useState('');
  const [histStatus, setHistStatus] = useState('');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stoppageDialogOpen, setStoppageDialogOpen] = useState(false);
  const [stoppageBusy, setStoppageBusy] = useState(false);
  const [bathOpen, setBathOpen] = useState(false);
  const [chemOpen, setChemOpen] = useState(false);
  const [bathBusy, setBathBusy] = useState(false);
  const [chemBusy, setChemBusy] = useState(false);

  const [prodForm, setProdForm] = useState({
    qtyNo: '',
    qtyMt: '',
    surfaceFinish: '',
    disposition: 'ACCEPT',
    remarks: '',
    shiftRef: 'A',
  });
  const prodFormRef = useRef(prodForm);
  const prodSaveTimer = useRef(null);

  useEffect(() => {
    prodFormRef.current = prodForm;
  }, [prodForm]);

  useEffect(
    () => () => {
      if (prodSaveTimer.current) window.clearTimeout(prodSaveTimer.current);
    },
    []
  );

  const ordersQ = useQuery({
    queryKey: ['stp-orders'],
    queryFn: () => stpApi.listOrders('Released'),
  });

  const lotsQ = useQuery({
    queryKey: ['stp-lots', histWo, histStatus, histFrom, histTo],
    queryFn: () =>
      stpApi.listLots({
        ...(histWo ? { workOrderNo: histWo } : {}),
        ...(histStatus ? { status: histStatus } : {}),
        ...(histFrom ? { fromDate: histFrom } : {}),
        ...(histTo ? { toDate: histTo } : {}),
      }),
  });

  const detailQ = useQuery({
    queryKey: ['stp-lot', selectedId],
    queryFn: () => stpApi.getLot(selectedId),
    enabled: !!selectedId,
  });

  const stopCodesQ = useQuery({
    queryKey: ['stp-stop-codes'],
    queryFn: () => stoppageApi.codes('STP'),
  });

  const stoppagesQ = useQuery({
    queryKey: ['stp-stoppages', selectedId],
    queryFn: () => stoppageApi.list('STP', selectedId),
    enabled: !!selectedId,
  });

  const stagesQ = useQuery({
    queryKey: ['stp-stages', selectedId, isWritable],
    queryFn: async () => {
      if (isWritable) {
        try {
          return await stpApi.ensureStages(selectedId);
        } catch {
          /* fall through */
        }
      }
      return stpApi.listStages(selectedId);
    },
    enabled: !!selectedId,
    refetchInterval: nav === 'monitoring' ? 5000 : false,
  });

  const histBathQ = useQuery({
    queryKey: ['stp-hist-bath', histFrom, histTo],
    queryFn: () =>
      stpApi.historyBathAnalysis({
        ...(histFrom ? { fromDate: histFrom } : {}),
        ...(histTo ? { toDate: histTo } : {}),
      }),
    enabled: histSeg === 'bath',
  });

  const histChemQ = useQuery({
    queryKey: ['stp-hist-chem', histFrom, histTo],
    queryFn: () =>
      stpApi.historyChemical({
        ...(histFrom ? { fromDate: histFrom } : {}),
        ...(histTo ? { toDate: histTo } : {}),
      }),
    enabled: histSeg === 'chemical',
  });

  const histStopQ = useQuery({
    queryKey: ['stp-hist-stop', histFrom, histTo],
    queryFn: () =>
      stpApi.historyStoppages({
        ...(histFrom ? { fromDate: histFrom } : {}),
        ...(histTo ? { toDate: histTo } : {}),
      }),
    enabled: histSeg === 'stoppage',
  });

  const lot = detailQ.data ?? null;
  const stoppages = Array.isArray(stoppagesQ.data) ? stoppagesQ.data : stoppagesQ.data?.items ?? [];
  const openStoppage = useMemo(
    () => stoppages.find((s) => isStoppageOpen(s.is_open ?? s.isOpen)) ?? null,
    [stoppages]
  );
  const displayStatus = clockStatus(lot, openStoppage);
  const stoppageCodes = Array.isArray(stopCodesQ.data)
    ? stopCodesQ.data
    : stopCodesQ.data?.items ?? [];

  const orders = useMemo(() => {
    const list = Array.isArray(ordersQ.data) ? ordersQ.data : ordersQ.data?.items ?? [];
    const q = woFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const hay = [o.workOrderNo, o.customerCode, o.gradeCode, o.lotNo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ordersQ.data, woFilter]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.workOrderNo === selectedWo) ?? null,
    [orders, selectedWo]
  );
  const selectedLine = useMemo(() => {
    if (!selectedOrder) return null;
    return (selectedOrder.lines ?? []).find((l) => l.lineNo === selectedLineNo) ?? null;
  }, [selectedOrder, selectedLineNo]);

  const lineSnapshot = useMemo(() => {
    if (selectedLine) return selectedLine;
    if (!lot) return null;
    return {
      workOrderNo: lot.workOrderNo,
      lineNo: lot.workOrderLineNo ?? 1,
      customerCode: lot.customerCode,
      gradeCode: lot.gradeCode,
      size: lot.size,
      qtyPieces: lot.qtyNo,
      plannedQty: lot.qtyMt,
      coilNo: null,
      tdc: null,
      passNo: null,
      finalSize: null,
      tubeShape: sizeParts(lot.size).profile,
      nextProcess: null,
    };
  }, [selectedLine, lot]);

  useEffect(() => {
    if (!lot) return;
    setProdForm({
      qtyNo: lot.qtyNo ?? '',
      qtyMt: lot.qtyMt ?? '',
      surfaceFinish: lot.surfaceFinish ?? '',
      disposition: lot.disposition || 'ACCEPT',
      remarks: lot.remarks ?? '',
      shiftRef: lot.shiftRef || 'A',
    });
  }, [lot?.id, lot?.updatedAt, lot?.qtyNo, lot?.qtyMt, lot?.surfaceFinish, lot?.disposition, lot?.remarks, lot?.shiftRef]);

  useEffect(() => {
    if (captureSub === 'bath') setBathOpen(true);
    if (captureSub === 'chem') setChemOpen(true);
  }, [captureSub]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['stp-lots'] });
    qc.invalidateQueries({ queryKey: ['stp-lot', selectedId] });
    qc.invalidateQueries({ queryKey: ['stp-stages', selectedId] });
    qc.invalidateQueries({ queryKey: ['stp-stoppages', selectedId] });
    qc.invalidateQueries({ queryKey: ['stp-hist-bath'] });
    qc.invalidateQueries({ queryKey: ['stp-hist-chem'] });
    qc.invalidateQueries({ queryKey: ['stp-hist-stop'] });
    qc.invalidateQueries({ queryKey: ['stp-orders'] });
    qc.invalidateQueries({ queryKey: ['stp-live-status'] });
  }

  function openConsole(lotId) {
    setSelectedId(lotId);
    setOrderSub('console');
    setCaptureSub('production');
    setNav((n) => (n === 'history' || n === 'monitoring' ? n : 'order'));
  }

  async function handleAssign() {
    if (!selectedWo || !selectedLineNo) {
      setErr('Select a work order line first');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const created = await stpApi.assign({
        workOrderNo: selectedWo,
        lineNo: selectedLineNo,
        machineCode: 'STP-01',
        shiftRef: prodForm.shiftRef || 'A',
      });
      setMsg(`Assigned ${created.lotNo}`);
      openConsole(created.id);
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  async function flushProdAutosave() {
    if (prodSaveTimer.current) {
      window.clearTimeout(prodSaveTimer.current);
      prodSaveTimer.current = null;
    }
    if (!selectedId || !isWritable || lot?.status === 'APPROVED') return;
    const f = prodFormRef.current;
    await stpApi.updateLot(selectedId, {
      qtyNo: numOrUndef(f.qtyNo),
      qtyMt: numOrUndef(f.qtyMt),
      surfaceFinish: f.surfaceFinish || undefined,
      disposition: f.disposition || undefined,
      remarks: f.remarks || undefined,
      shiftRef: f.shiftRef || undefined,
    });
  }

  async function handleSave() {
    if (!selectedId || !isWritable) return;
    setBusy(true);
    setErr('');
    try {
      await flushProdAutosave();
      setMsg('Saved');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await flushProdAutosave();
      await stpApi.start(selectedId);
      setMsg('Production started');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Start failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await flushProdAutosave();
      await stpApi.end(selectedId);
      setMsg('Production ended');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'End failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await stpApi.submit(selectedId);
      setMsg('Submitted');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!selectedId || !canMachineHead) return;
    setBusy(true);
    try {
      await stpApi.approve(selectedId);
      setMsg('Approved');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleBathSignOff() {
    if (!selectedId || !canMachineHead) return;
    setBusy(true);
    try {
      await stpApi.bathSignOff(selectedId, { note: 'Bath analysis signed by Machine Head' });
      setMsg('Bath signed off');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bath sign-off failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleHold() {
    if (!selectedId || !canMachineHead) return;
    setBusy(true);
    try {
      await stpApi.hold(selectedId);
      setMsg('Held');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hold failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleStoppageConfirm(body) {
    if (!selectedId) return;
    setStoppageBusy(true);
    try {
      await stoppageApi.open({
        processCode: 'STP',
        sourceId: selectedId,
        millCode: lot?.machineCode || 'STP-01',
        stoppageCode: body.stoppageCode,
        reason: body.reason || body.remark || undefined,
      });
      setMsg('Stoppage opened');
      setStoppageDialogOpen(false);
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Stoppage failed');
    } finally {
      setStoppageBusy(false);
    }
  }

  async function handleEndStoppage() {
    if (!selectedId) return;
    setStoppageBusy(true);
    try {
      await stoppageApi.close('STP', selectedId);
      setMsg('Stoppage ended');
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'End stoppage failed');
    } finally {
      setStoppageBusy(false);
    }
  }

  async function handleBathSave(body) {
    setBathBusy(true);
    try {
      await stpApi.addBathAnalysis(null, body);
      setMsg('Bath analysis saved');
      setBathOpen(false);
      setCaptureSub('production');
      invalidate();
    } finally {
      setBathBusy(false);
    }
  }

  async function handleChemSave(body) {
    setChemBusy(true);
    try {
      await stpApi.addChemicalAddition(null, body);
      setMsg('Chemical addition saved');
      setChemOpen(false);
      setCaptureSub('production');
      invalidate();
    } finally {
      setChemBusy(false);
    }
  }

  async function handleAdvanceStage() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await flushProdAutosave();
      await stpApi.advanceStage(selectedId);
      setErr('');
      invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Advance failed');
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleMonitorSave(patch) {
    if (!selectedId) throw new Error('No run selected');
    await stpApi.updateLot(selectedId, patch);
    qc.invalidateQueries({ queryKey: ['stp-lot', selectedId] });
    qc.invalidateQueries({ queryKey: ['stp-stages', selectedId] });
  }

  const canStart =
    isWritable && !!selectedId && displayStatus === 'IDLE' && !lot?.productionEndedAt && lot?.status !== 'APPROVED';
  const canEnd =
    isWritable &&
    !!selectedId &&
    !!lot?.productionStartedAt &&
    !lot?.productionEndedAt &&
    (displayStatus === 'RUNNING' || displayStatus === 'STOPPAGE');
  const canOpenStoppage = isWritable && !!selectedId && displayStatus === 'RUNNING' && !openStoppage;
  const canEndStoppage = isWritable && !!selectedId && displayStatus === 'STOPPAGE';
  const canSave =
    isWritable &&
    !!selectedId &&
    lot?.status !== 'APPROVED' &&
    (displayStatus === 'RUNNING' || displayStatus === 'STOPPAGE' || displayStatus === 'IDLE');

  const activeOrderLabel = lot?.workOrderNo
    ? `${lot.workOrderNo} · LINE ${lot.workOrderLineNo ?? '—'}`
    : null;

  function renderMergedRun() {
    const stages = Array.isArray(stagesQ.data) ? stagesQ.data : stagesQ.data?.stages ?? [];
    const snap = lineSnapshot;
    const size = snap?.size ?? lot?.size;
    const parts = sizeParts(size);

    function scheduleProdAutosave(nextForm) {
      if (!selectedId || !isWritable || lot?.status === 'APPROVED') return;
      if (prodSaveTimer.current) window.clearTimeout(prodSaveTimer.current);
      prodSaveTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            await stpApi.updateLot(selectedId, {
              qtyNo: numOrUndef(nextForm.qtyNo),
              qtyMt: numOrUndef(nextForm.qtyMt),
              surfaceFinish: nextForm.surfaceFinish || undefined,
              disposition: nextForm.disposition || undefined,
              remarks: nextForm.remarks || undefined,
              shiftRef: nextForm.shiftRef || undefined,
            });
            setMsg('Saved');
            setErr('');
            qc.invalidateQueries({ queryKey: ['stp-lot', selectedId] });
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Auto-save failed');
          }
        })();
      }, 600);
    }

    function patchProdForm(patch) {
      setProdForm((f) => {
        const next = { ...f, ...patch };
        scheduleProdAutosave(next);
        return next;
      });
    }

    const productionBlock = lot
      ? /*#__PURE__*/ _jsxs('div', {
          className: 'stp-run-console__production',
          children: [
            /*#__PURE__*/ _jsxs('section', {
              className: 'stp-console__summary',
              children: [
                /*#__PURE__*/ _jsx('h3', { children: 'Running order (read-only)' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'stp-console__grid',
                  children: [
                    /*#__PURE__*/ _jsx(RoField, { label: 'Work order', value: snap?.workOrderNo }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Line', value: snap?.lineNo }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Customer', value: snap?.customerCode }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Grade', value: snap?.gradeCode }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'OD', value: parts.od }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Slit', value: parts.slit }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'TH', value: parts.thk }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Length', value: parts.len }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Qty (NOS)',
                      value: snap?.qtyPieces ?? lot.qtyNo,
                    }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Qty (MT)',
                      value: snap?.plannedQty ?? lot.qtyMt,
                    }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'TDC', value: snap?.tdc }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Coil', value: snap?.coilNo }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Pass', value: snap?.passNo }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Final size',
                      value:
                        typeof snap?.finalSize === 'object'
                          ? fmtSize(snap.finalSize)
                          : snap?.finalSize,
                    }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Shape',
                      value: snap?.tubeShape || parts.profile,
                    }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Next process', value: snap?.nextProcess }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Started',
                      value: lot.productionStartedAt
                        ? new Date(lot.productionStartedAt).toLocaleString()
                        : null,
                    }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Ended',
                      value: lot.productionEndedAt
                        ? new Date(lot.productionEndedAt).toLocaleString()
                        : null,
                    }),
                  ],
                }),
              ],
            }),
            /*#__PURE__*/ _jsxs('section', {
              className: 'stp-console__edit',
              children: [
                /*#__PURE__*/ _jsx('h3', { children: 'Production inputs' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'form-grid',
                  children: [
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Produced qty (NOS)',
                        /*#__PURE__*/ _jsx(ZInput, {
                          type: 'number',
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.qtyNo,
                          onChange: (e) => patchProdForm({ qtyNo: e.target.value }),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Produced qty (MT)',
                        /*#__PURE__*/ _jsx(ZInput, {
                          type: 'number',
                          step: 'any',
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.qtyMt,
                          onChange: (e) => patchProdForm({ qtyMt: e.target.value }),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Surface finish',
                        /*#__PURE__*/ _jsx(ZInput, {
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.surfaceFinish,
                          onChange: (e) => patchProdForm({ surfaceFinish: e.target.value }),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Disposition',
                        /*#__PURE__*/ _jsxs(ZSelect, {
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.disposition,
                          onChange: (e) => patchProdForm({ disposition: e.target.value }),
                          children: [
                            /*#__PURE__*/ _jsx('option', { value: 'ACCEPT', children: 'ACCEPT' }),
                            /*#__PURE__*/ _jsx('option', {
                              value: 'QUARANTINE',
                              children: 'QUARANTINE',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            msg ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--ok', children: msg }) : null,
            err ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: err }) : null,
          ],
        })
      : null;

    return /*#__PURE__*/ _jsx(StpProcessMonitor, {
      lot,
      stages,
      displayStatus,
      isWritable,
      busy,
      openStoppage,
      canStart,
      canEnd,
      productionBlock,
      emptyTitle: 'Production console',
      emptyHint: 'Select a work order line, then swipe to Start production.',
      onGoOrders: () => {
        setNav('order');
        setOrderSub('work-orders');
      },
      onOpenStoppage: () => setStoppageDialogOpen(true),
      onEndStoppage: () => void handleEndStoppage(),
      onOpenBath: () => setBathOpen(true),
      onStart: handleStart,
      onEnd: handleEnd,
      onAdvance: handleAdvanceStage,
      onSaveReading: handleMonitorSave,
    });
  }

  function renderWorkOrders() {
    return /*#__PURE__*/ _jsxs('div', {
      className: 'stp-orders',
      children: [
        /*#__PURE__*/ _jsx(ZPageHeader, {
          title: 'STP · Work Orders',
          subtitle: 'Select a work order, then a line, then open Production Console',
        }),
        /*#__PURE__*/ _jsxs('div', {
          className: 'stp-orders__toolbar',
          children: [
            /*#__PURE__*/ _jsx(ZInput, {
              placeholder: 'Search WO / customer / grade',
              value: woFilter,
              onChange: (e) => setWoFilter(e.target.value),
            }),
            /*#__PURE__*/ _jsx(ZButton, {
              variant: 'ghost',
              onClick: () => ordersQ.refetch(),
              children: 'Refresh',
            }),
          ],
        }),
        /*#__PURE__*/ _jsx('div', {
          className: 'furnace-history__table-wrap',
          children: /*#__PURE__*/ _jsxs('table', {
            className: 'furnace-hist-table',
            children: [
              /*#__PURE__*/ _jsx('thead', {
                children: /*#__PURE__*/ _jsxs('tr', {
                  children: [
                    /*#__PURE__*/ _jsx('th', { children: 'Work order' }),
                    /*#__PURE__*/ _jsx('th', { children: 'Customer' }),
                    /*#__PURE__*/ _jsx('th', { children: 'Grade' }),
                    /*#__PURE__*/ _jsx('th', { children: 'Lines' }),
                    /*#__PURE__*/ _jsx('th', { children: 'Qty' }),
                    /*#__PURE__*/ _jsx('th', { children: 'Status' }),
                  ],
                }),
              }),
              /*#__PURE__*/ _jsx('tbody', {
                children: orders.map((o) =>
                  /*#__PURE__*/ _jsxs(
                    'tr',
                    {
                      className:
                        selectedWo === o.workOrderNo
                          ? 'furnace-hist-table__row is-selected'
                          : 'furnace-hist-table__row',
                      onClick: () => {
                        setSelectedWo(o.workOrderNo);
                        setSelectedLineNo(o.lines?.[0]?.lineNo ?? 1);
                      },
                      children: [
                        /*#__PURE__*/ _jsx('td', { children: o.workOrderNo }),
                        /*#__PURE__*/ _jsx('td', { children: o.customerCode || '—' }),
                        /*#__PURE__*/ _jsx('td', { children: o.gradeCode || '—' }),
                        /*#__PURE__*/ _jsx('td', { children: o.lines?.length ?? 0 }),
                        /*#__PURE__*/ _jsx('td', {
                          children: o.qtyPieces != null ? o.qtyPieces : o.plannedQty ?? '—',
                        }),
                        /*#__PURE__*/ _jsx('td', { children: o.status }),
                      ],
                    },
                    o.workOrderNo
                  )
                ),
              }),
            ],
          }),
        }),
        selectedOrder
          ? /*#__PURE__*/ _jsxs(ZOperatorCard, {
              title: `WO ${selectedOrder.workOrderNo} · Lines`,
              children: [
                /*#__PURE__*/ _jsx('div', {
                  className: 'furnace-history__table-wrap',
                  children: /*#__PURE__*/ _jsxs('table', {
                    className: 'furnace-hist-table',
                    children: [
                      /*#__PURE__*/ _jsx('thead', {
                        children: /*#__PURE__*/ _jsxs('tr', {
                          children: [
                            /*#__PURE__*/ _jsx('th', { children: 'Line' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Customer' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Grade' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Size' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Coil' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Pass' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Next' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Qty' }),
                          ],
                        }),
                      }),
                      /*#__PURE__*/ _jsx('tbody', {
                        children: (selectedOrder.lines ?? []).map((l) =>
                          /*#__PURE__*/ _jsxs(
                            'tr',
                            {
                              className:
                                selectedLineNo === l.lineNo
                                  ? 'furnace-hist-table__row is-selected'
                                  : 'furnace-hist-table__row',
                              onClick: () => setSelectedLineNo(l.lineNo),
                              children: [
                                /*#__PURE__*/ _jsx('td', { children: l.lineNo }),
                                /*#__PURE__*/ _jsx('td', { children: l.customerCode || '—' }),
                                /*#__PURE__*/ _jsx('td', { children: l.gradeCode || '—' }),
                                /*#__PURE__*/ _jsx('td', { children: fmtSize(l.size) }),
                                /*#__PURE__*/ _jsx('td', { children: l.coilNo || '—' }),
                                /*#__PURE__*/ _jsx('td', { children: l.passNo ?? '—' }),
                                /*#__PURE__*/ _jsx('td', { children: l.nextProcess || '—' }),
                                /*#__PURE__*/ _jsx('td', {
                                  children: l.qtyPieces ?? l.plannedQty ?? '—',
                                }),
                              ],
                            },
                            l.lineNo
                          )
                        ),
                      }),
                    ],
                  }),
                }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'stp-orders__line-actions',
                  children: [
                    /*#__PURE__*/ _jsx(ZButton, {
                      variant: 'primary',
                      disabled: !isWritable || busy || !selectedLineNo,
                      onClick: () => void handleAssign(),
                      children: busy ? 'Assigning…' : 'Open Production Console',
                    }),
                    err
                      ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: err })
                      : null,
                  ],
                }),
              ],
            })
          : null,
      ],
    });
  }

  function renderRemarks() {
    return /*#__PURE__*/ _jsxs(ZOperatorCard, {
      title: 'Remarks / Stoppage',
      children: [
        !selectedId
          ? /*#__PURE__*/ _jsx('p', {
              className: 'empty-hint',
              children: 'Open a production run first.',
            })
          : /*#__PURE__*/ _jsxs(_Fragment, {
              children: [
                /*#__PURE__*/ _jsxs('label', {
                  className: 'stp-remarks-field',
                  children: [
                    'Lot remarks',
                    /*#__PURE__*/ _jsx(ZInput, {
                      disabled: !isWritable || lot?.status === 'APPROVED',
                      value: prodForm.remarks,
                      onChange: (e) => setProdForm((f) => ({ ...f, remarks: e.target.value })),
                    }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'stp-console__actions',
                  children: [
                    /*#__PURE__*/ _jsx(ZButton, {
                      disabled: !canSave || busy,
                      onClick: () => void handleSave(),
                      children: 'Save remarks',
                    }),
                    canOpenStoppage
                      ? /*#__PURE__*/ _jsx(ZButton, {
                          onClick: () => setStoppageDialogOpen(true),
                          children: 'Open stoppage',
                        })
                      : null,
                    canEndStoppage
                      ? /*#__PURE__*/ _jsx(ZButton, {
                          onClick: () => void handleEndStoppage(),
                          children: 'End stoppage',
                        })
                      : null,
                  ],
                }),
              ],
            }),
      ],
    });
  }

  function renderMonitoring() {
    return /*#__PURE__*/ _jsx(StpBathChemPanel, {
      isWritable,
      onOpenBath: () => setBathOpen(true),
      onOpenChem: () => setChemOpen(true),
    });
  }

  function renderHistory() {
    const lots = Array.isArray(lotsQ.data) ? lotsQ.data : lotsQ.data?.items ?? [];
    const bathRows = Array.isArray(histBathQ.data) ? histBathQ.data : histBathQ.data?.items ?? [];
    const chemRows = Array.isArray(histChemQ.data) ? histChemQ.data : histChemQ.data?.items ?? [];
    const stopRows = Array.isArray(histStopQ.data) ? histStopQ.data : histStopQ.data?.items ?? [];

    return /*#__PURE__*/ _jsxs('div', {
      className: 'furnace-history stp-history',
      children: [
        /*#__PURE__*/ _jsxs('div', {
          className: 'furnace-history__header',
          children: [
            /*#__PURE__*/ _jsx('h2', { children: 'STP History' }),
            /*#__PURE__*/ _jsx('div', {
              className: 'furnace-history__seg',
              children: HIST_SEGS.map((s) =>
                /*#__PURE__*/ _jsx(
                  'button',
                  {
                    type: 'button',
                    className: `furnace-history__seg-btn${histSeg === s.id ? ' is-active' : ''}`,
                    onClick: () => setHistSeg(s.id),
                    children: s.label,
                  },
                  s.id
                )
              ),
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('div', {
          className: 'furnace-history__toolbar',
          children: [
            /*#__PURE__*/ _jsxs('label', {
              className: 'furnace-history__field',
              children: [
                /*#__PURE__*/ _jsx('span', { children: 'WO' }),
                /*#__PURE__*/ _jsx(ZInput, {
                  value: histWo,
                  onChange: (e) => setHistWo(e.target.value),
                }),
              ],
            }),
            /*#__PURE__*/ _jsxs('label', {
              className: 'furnace-history__field',
              children: [
                /*#__PURE__*/ _jsx('span', { children: 'Status' }),
                /*#__PURE__*/ _jsxs(ZSelect, {
                  value: histStatus,
                  onChange: (e) => setHistStatus(e.target.value),
                  children: [
                    /*#__PURE__*/ _jsx('option', { value: '', children: 'All' }),
                    /*#__PURE__*/ _jsx('option', { value: 'DRAFT', children: 'DRAFT' }),
                    /*#__PURE__*/ _jsx('option', { value: 'SUBMITTED', children: 'SUBMITTED' }),
                    /*#__PURE__*/ _jsx('option', { value: 'APPROVED', children: 'APPROVED' }),
                    /*#__PURE__*/ _jsx('option', { value: 'HOLD', children: 'HOLD' }),
                  ],
                }),
              ],
            }),
            /*#__PURE__*/ _jsxs('label', {
              className: 'furnace-history__field',
              children: [
                /*#__PURE__*/ _jsx('span', { children: 'From' }),
                /*#__PURE__*/ _jsx(ZInput, {
                  type: 'date',
                  value: histFrom,
                  onChange: (e) => setHistFrom(e.target.value),
                }),
              ],
            }),
            /*#__PURE__*/ _jsxs('label', {
              className: 'furnace-history__field',
              children: [
                /*#__PURE__*/ _jsx('span', { children: 'To' }),
                /*#__PURE__*/ _jsx(ZInput, {
                  type: 'date',
                  value: histTo,
                  onChange: (e) => setHistTo(e.target.value),
                }),
              ],
            }),
          ],
        }),
        /*#__PURE__*/ _jsx('div', {
          className: 'furnace-history__table-wrap',
          children:
            histSeg === 'production' || histSeg === 'process'
              ? /*#__PURE__*/ _jsxs('table', {
                  className: 'furnace-hist-table',
                  children: [
                    /*#__PURE__*/ _jsx('thead', {
                      children: /*#__PURE__*/ _jsxs('tr', {
                        children:
                          histSeg === 'production'
                            ? [
                                /*#__PURE__*/ _jsx('th', { children: 'Date' }, 'd'),
                                /*#__PURE__*/ _jsx('th', { children: 'Shift' }, 's'),
                                /*#__PURE__*/ _jsx('th', { children: 'STP' }, 'm'),
                                /*#__PURE__*/ _jsx('th', { children: 'WO' }, 'w'),
                                /*#__PURE__*/ _jsx('th', { children: 'Line' }, 'l'),
                                /*#__PURE__*/ _jsx('th', { children: 'Customer' }, 'c'),
                                /*#__PURE__*/ _jsx('th', { children: 'Grade' }, 'g'),
                                /*#__PURE__*/ _jsx('th', { children: 'Qty' }, 'q'),
                                /*#__PURE__*/ _jsx('th', { children: 'Status' }, 'st'),
                                /*#__PURE__*/ _jsx('th', { children: 'Start' }, 'a'),
                                /*#__PURE__*/ _jsx('th', { children: 'End' }, 'e'),
                              ]
                            : [
                                /*#__PURE__*/ _jsx('th', { children: 'Lot' }, 'lot'),
                                /*#__PURE__*/ _jsx('th', { children: 'WO' }, 'wo'),
                                /*#__PURE__*/ _jsx('th', { children: 'Degrease' }, 'deg'),
                                /*#__PURE__*/ _jsx('th', { children: 'Phos' }, 'ph'),
                                /*#__PURE__*/ _jsx('th', { children: 'Lube' }, 'lu'),
                                /*#__PURE__*/ _jsx('th', { children: 'Dryer' }, 'dr'),
                                /*#__PURE__*/ _jsx('th', { children: 'Oil' }, 'oil'),
                                /*#__PURE__*/ _jsx('th', { children: 'Status' }, 'st'),
                              ],
                      }),
                    }),
                    /*#__PURE__*/ _jsx('tbody', {
                      children: lots.map((row) =>
                        /*#__PURE__*/ _jsxs(
                          'tr',
                          {
                            className:
                              selectedId === row.id
                                ? 'furnace-hist-table__row is-selected'
                                : 'furnace-hist-table__row',
                            onClick: () => {
                              setSelectedId(row.id);
                              if (row.workOrderNo) setSelectedWo(row.workOrderNo);
                              if (row.workOrderLineNo) setSelectedLineNo(row.workOrderLineNo);
                            },
                            onDoubleClick: () => {
                              openConsole(row.id);
                              setNav('order');
                              setOrderSub('console');
                            },
                            children:
                              histSeg === 'production'
                                ? [
                                    /*#__PURE__*/ _jsx('td', { children: row.prodDate || '—' }, 'd'),
                                    /*#__PURE__*/ _jsx('td', { children: row.shiftRef || '—' }, 's'),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      { children: row.machineCode || 'STP-01' },
                                      'm'
                                    ),
                                    /*#__PURE__*/ _jsx('td', { children: row.workOrderNo || '—' }, 'w'),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      { children: row.workOrderLineNo ?? '—' },
                                      'l'
                                    ),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      { children: row.customerCode || '—' },
                                      'c'
                                    ),
                                    /*#__PURE__*/ _jsx('td', { children: row.gradeCode || '—' }, 'g'),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      { children: row.qtyNo ?? row.qtyMt ?? '—' },
                                      'q'
                                    ),
                                    /*#__PURE__*/ _jsx('td', { children: row.status }, 'st'),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      {
                                        children: row.productionStartedAt
                                          ? new Date(row.productionStartedAt).toLocaleString()
                                          : '—',
                                      },
                                      'a'
                                    ),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      {
                                        children: row.productionEndedAt
                                          ? new Date(row.productionEndedAt).toLocaleString()
                                          : '—',
                                      },
                                      'e'
                                    ),
                                  ]
                                : [
                                    /*#__PURE__*/ _jsx('td', { children: row.lotNo }, 'lot'),
                                    /*#__PURE__*/ _jsx('td', { children: row.workOrderNo || '—' }, 'wo'),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      {
                                        children:
                                          row.degreaseTempC != null
                                            ? `${row.degreaseTempC}° / ${row.degreaseTimeMin ?? '—'}m`
                                            : '—',
                                      },
                                      'deg'
                                    ),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      {
                                        children:
                                          row.phosphateTempC != null
                                            ? `${row.phosphateTempC}° / ${row.phosphateTimeMin ?? '—'}m`
                                            : '—',
                                      },
                                      'ph'
                                    ),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      {
                                        children:
                                          row.lubeTempC != null
                                            ? `${row.lubeTempC}° / ${row.lubeTimeMin ?? '—'}m`
                                            : '—',
                                      },
                                      'lu'
                                    ),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      {
                                        children:
                                          row.dryerTempC != null
                                            ? `${row.dryerTempC}° / ${row.dryerTimeMin ?? '—'}m`
                                            : '—',
                                      },
                                      'dr'
                                    ),
                                    /*#__PURE__*/ _jsx(
                                      'td',
                                      { children: row.reactiveOilTimeMin ?? '—' },
                                      'oil'
                                    ),
                                    /*#__PURE__*/ _jsx('td', { children: row.status }, 'st'),
                                  ],
                          },
                          row.id
                        )
                      ),
                    }),
                  ],
                })
              : histSeg === 'bath'
                ? /*#__PURE__*/ _jsxs('table', {
                    className: 'furnace-hist-table',
                    children: [
                      /*#__PURE__*/ _jsx('thead', {
                        children: /*#__PURE__*/ _jsxs('tr', {
                          children: [
                            /*#__PURE__*/ _jsx('th', { children: 'When' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Lot' }),
                            /*#__PURE__*/ _jsx('th', { children: 'WO' }),
                            /*#__PURE__*/ _jsx('th', { children: 'HCl %' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Phos TA' }),
                            /*#__PURE__*/ _jsx('th', { children: 'Lube pH' }),
                          ],
                        }),
                      }),
                      /*#__PURE__*/ _jsx('tbody', {
                        children: bathRows.map((r) =>
                          /*#__PURE__*/ _jsxs(
                            'tr',
                            {
                              className: 'furnace-hist-table__row',
                              onClick: () => r.lotId && setSelectedId(r.lotId),
                              children: [
                                /*#__PURE__*/ _jsx('td', {
                                  children: r.sampledAt
                                    ? new Date(r.sampledAt).toLocaleString()
                                    : '—',
                                }),
                                /*#__PURE__*/ _jsx('td', { children: r.lotNo || r.lotId }),
                                /*#__PURE__*/ _jsx('td', { children: r.workOrderNo || '—' }),
                                /*#__PURE__*/ _jsx('td', { children: r.hclPct ?? r.hcl_pct ?? '—' }),
                                /*#__PURE__*/ _jsx('td', { children: r.phosTa ?? r.phos_ta ?? '—' }),
                                /*#__PURE__*/ _jsx('td', { children: r.lubePh ?? r.lube_ph ?? '—' }),
                              ],
                            },
                            r.id
                          )
                        ),
                      }),
                    ],
                  })
                : histSeg === 'chemical'
                  ? /*#__PURE__*/ _jsxs('table', {
                      className: 'furnace-hist-table',
                      children: [
                        /*#__PURE__*/ _jsx('thead', {
                          children: /*#__PURE__*/ _jsxs('tr', {
                            children: [
                              /*#__PURE__*/ _jsx('th', { children: 'When' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Lot' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Bath' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Chemical' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Qty' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Batch' }),
                            ],
                          }),
                        }),
                        /*#__PURE__*/ _jsx('tbody', {
                          children: chemRows.map((r) =>
                            /*#__PURE__*/ _jsxs(
                              'tr',
                              {
                                className: 'furnace-hist-table__row',
                                onClick: () => r.lotId && setSelectedId(r.lotId),
                                children: [
                                  /*#__PURE__*/ _jsx('td', {
                                    children: r.createdAt
                                      ? new Date(r.createdAt).toLocaleString()
                                      : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', { children: r.lotNo || r.lotId }),
                                  /*#__PURE__*/ _jsx('td', { children: r.bathCode }),
                                  /*#__PURE__*/ _jsx('td', { children: r.chemical }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children:
                                      r.quantity != null ? `${r.quantity} ${r.unit || ''}`.trim() : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', { children: r.batchRef || '—' }),
                                ],
                              },
                              r.id
                            )
                          ),
                        }),
                      ],
                    })
                  : /*#__PURE__*/ _jsxs('table', {
                      className: 'furnace-hist-table',
                      children: [
                        /*#__PURE__*/ _jsx('thead', {
                          children: /*#__PURE__*/ _jsxs('tr', {
                            children: [
                              /*#__PURE__*/ _jsx('th', { children: 'From' }),
                              /*#__PURE__*/ _jsx('th', { children: 'To' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Lot' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Code' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Reason' }),
                              /*#__PURE__*/ _jsx('th', { children: 'Open' }),
                            ],
                          }),
                        }),
                        /*#__PURE__*/ _jsx('tbody', {
                          children: stopRows.map((r) =>
                            /*#__PURE__*/ _jsxs(
                              'tr',
                              {
                                className: 'furnace-hist-table__row',
                                onClick: () => (r.sourceId || r.lotId) && setSelectedId(r.sourceId || r.lotId),
                                children: [
                                  /*#__PURE__*/ _jsx('td', {
                                    children: r.fromTime || r.from_time
                                      ? new Date(r.fromTime || r.from_time).toLocaleString()
                                      : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children: r.toTime || r.to_time
                                      ? new Date(r.toTime || r.to_time).toLocaleString()
                                      : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', { children: r.lotNo || r.sourceId || '—' }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children: r.stoppageCode || r.stoppage_code || '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', { children: r.reason || '—' }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children: isStoppageOpen(r.isOpen ?? r.is_open) ? 'Yes' : 'No',
                                  }),
                                ],
                              },
                              r.id
                            )
                          ),
                        }),
                      ],
                    }),
        }),
        selectedId
          ? /*#__PURE__*/ _jsx('div', {
              className: 'stp-history__footer',
              children: /*#__PURE__*/ _jsx(ZButton, {
                variant: 'primary',
                onClick: () => {
                  openConsole(selectedId);
                  setNav('order');
                  setOrderSub('console');
                },
                children: 'Open Production Console',
              }),
            })
          : null,
      ],
    });
  }

  const showOverviewInCapture = nav === 'capture' && captureSub === 'production';

  const orderContent = /*#__PURE__*/ _jsxs('div', {
    className: 'stp-order-pane',
    children: [
      /*#__PURE__*/ _jsx(SubNav, {
        items: ORDER_SUB,
        active: orderSub,
        onChange: setOrderSub,
      }),
      orderSub === 'work-orders' ? renderWorkOrders() : renderMergedRun(),
    ],
  });

  const captureBody = /*#__PURE__*/ _jsxs('div', {
    className: 'stp-capture-pane',
    children: [
      /*#__PURE__*/ _jsx(SubNav, {
        items: CAPTURE_SUB,
        active: captureSub,
        onChange: (id) => {
          setCaptureSub(id);
          if (id === 'bath') setBathOpen(true);
          if (id === 'chem') setChemOpen(true);
        },
      }),
      captureSub === 'production'
        ? /*#__PURE__*/ _jsx(StpMachineOverview, {
            selectedLot: lot,
            onGoOrders: () => {
              setNav('order');
              setOrderSub('work-orders');
            },
            onOpenMonitoring: () => {
              setNav('monitoring');
            },
            onSelectUpcoming: (item) => {
              if (item?.workOrderNo) setSelectedWo(item.workOrderNo);
              if (item?.lineNo != null) setSelectedLineNo(item.lineNo);
              setNav('order');
              setOrderSub('work-orders');
            },
          })
        : captureSub === 'remarks'
          ? renderRemarks()
          : /*#__PURE__*/ _jsxs(ZOperatorCard, {
              title: captureSub === 'bath' ? 'Bath Analysis' : 'Chemical Addition',
              children: [
                /*#__PURE__*/ _jsx('p', {
                  className: 'empty-hint',
                  children: 'Bath and chemical capture is independent of the running work order.',
                }),
                /*#__PURE__*/ _jsx(ZButton, {
                  variant: 'primary',
                  onClick: () => (captureSub === 'bath' ? setBathOpen(true) : setChemOpen(true)),
                  children: captureSub === 'bath' ? 'Open Bath Analysis' : 'Open Chemical Addition',
                }),
              ],
            }),
      msg && !showOverviewInCapture
        ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--ok', children: msg })
        : null,
      err && !showOverviewInCapture
        ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: err })
        : null,
    ],
  });

  return /*#__PURE__*/ _jsxs(_Fragment, {
    children: [
      /*#__PURE__*/ _jsx(ProcessStationShell, {
        processId,
        processLabel: 'STP',
        machineCode: 'STP-01',
        processes,
        onProcessChange,
        onLogout,
        showAdmin,
        onAdmin,
        roleLabel: roleLabel ?? role,
        millStatus: displayStatus,
        shiftLabel: `Shift ${prodForm.shiftRef || lot?.shiftRef || 'A'}`,
        activeOrderId: activeOrderLabel,
        activeOrderStatus: displayStatus,
        hold: lot?.status === 'HOLD',
        jobActive: !!selectedId && isWritable && displayStatus === 'RUNNING',
        navItems: STP_NAV_ITEMS,
        initialNav: 'order',
        nav,
        onNavChange: (id) => {
          setNav(id);
          setMsg('');
          setErr('');
        },
        onManualStop: canOpenStoppage ? () => setStoppageDialogOpen(true) : undefined,
        manualStopDisabled: !canOpenStoppage,
        ordersContent: orderContent,
        historyContent: renderHistory(),
        monitoringContent: renderMonitoring(),
        captureTitle: lot ? `${lot.lotNo} · ${displayStatus}` : 'STP Capture',
        extraRight: /*#__PURE__*/ _jsxs(_Fragment, {
          children: [
            /*#__PURE__*/ _jsx(ZBadge, { tone: 'success', pulse: true, children: 'LIVE' }),
            /*#__PURE__*/ _jsx(ZBadge, { tone: 'idle', children: 'Source: MANUAL' }),
            canMachineHead && selectedId
              ? /*#__PURE__*/ _jsx(ZButton, {
                  disabled: busy,
                  onClick: () => void handleBathSignOff(),
                  children: 'Bath sign-off',
                })
              : null,
            canMachineHead && selectedId
              ? /*#__PURE__*/ _jsx(ZButton, {
                  variant: 'primary',
                  disabled: busy,
                  onClick: () => void handleApprove(),
                  children: 'Approve',
                })
              : null,
          ],
        }),
        children: captureBody,
      }),
      /*#__PURE__*/ _jsx(StoppageDialog, {
        open: stoppageDialogOpen,
        busy: stoppageBusy,
        mode: openStoppage ? 'manage' : 'open',
        stoppageCodes,
        stoppages,
        openStoppage,
        onCancel: () => setStoppageDialogOpen(false),
        onConfirm: (body) => void handleStoppageConfirm(body),
      }),
      /*#__PURE__*/ _jsx(StpBathAnalysisModal, {
        open: bathOpen,
        busy: bathBusy,
        onClose: () => {
          setBathOpen(false);
          if (captureSub === 'bath') setCaptureSub('production');
        },
        onSave: handleBathSave,
      }),
      /*#__PURE__*/ _jsx(StpChemicalAdditionModal, {
        open: chemOpen,
        busy: chemBusy,
        onClose: () => {
          setChemOpen(false);
          if (captureSub === 'chem') setCaptureSub('production');
        },
        onSave: handleChemSave,
      }),
    ],
  });
}
