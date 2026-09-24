import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { furnaceApi } from '../api/processApi';
import { ZButton, ZInput, ZSelect, ZBadge, statusTone } from '../ui';
import { getStoredUser, primaryRole } from '../lib/authStore';
import { ErpWoSelect } from '../components/ErpWoSelect';
import StoppageDialog from '../components/StoppageDialog';
import FurnaceBoard from '../components/furnace/FurnaceBoard';
import FurnaceGasMatrix from '../components/furnace/FurnaceGasMatrix';
import FurnaceConsumptionModal from '../components/furnace/FurnaceConsumptionModal';
import FurnaceWorkOrderHub from '../components/furnace/FurnaceWorkOrderHub';
import { ProductionActionRail } from '../components/layout/operator';
import { downloadXlsx, stoppageApi } from '../api/plantApi';
import { validateProcessForm } from '../lib/validateForm';
import { getFurnaceMeta, machineCodeOf } from '../lib/furnaceMeta';
import { formatElapsed } from '../lib/operatorClock';
import ProcessStationShell from '../components/process/ProcessStationShell';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';

const ZONES = [1, 2, 3, 4, 5, 6];

const FUR_NAV_ITEMS = [
  { id: 'furnaces', icon: '▣', label: 'Furnaces' },
  { id: 'orders', icon: '☰', label: 'Work Order' },
  { id: 'history', icon: '▤', label: 'History' },
  { id: 'gas', icon: '◇', label: 'Gas' },
];

const BATCH_SPACING_MM = 6000;
const LOT_GAP_MM = 300;
const SOAK_TOLERANCE_C = 10;

function currentShiftRef() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

/** Human-facing production run id — FUR-{furnace}-{base36}. */
function nextProductionRunNo(furnaceCode) {
  const code = String(furnaceCode || 'RHF').replace(/[^A-Z0-9]/gi, '');
  return `FUR-${code}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Derive batch-gap status from known dims only (never invents measured lot gap).
 * Persisted batchGapOk is false only when a known rule is violated.
 */
function deriveBatchGapStatus({ lengthMm, lotGapMm } = {}) {
  const len = Number(lengthMm);
  const lotGap =
    lotGapMm === '' || lotGapMm == null || lotGapMm === undefined ? NaN : Number(lotGapMm);

  let batchSpacing = { tone: 'idle', label: 'Batch spacing · Not measured' };
  if (Number.isFinite(len) && len > 0) {
    if (len >= BATCH_SPACING_MM) {
      batchSpacing = { tone: 'ok', label: `Batch gap · ✓ ${BATCH_SPACING_MM} mm batch OK` };
    } else {
      batchSpacing = {
        tone: 'warn',
        label: `Batch gap · ⚠ Below recommended ${BATCH_SPACING_MM} mm (${len} mm)`,
      };
    }
  }

  let lotGapStatus = { tone: 'idle', label: 'Lot gap · Not measured' };
  if (Number.isFinite(lotGap)) {
    if (lotGap >= LOT_GAP_MM) {
      lotGapStatus = { tone: 'ok', label: `Lot gap · ✓ ${LOT_GAP_MM} mm OK` };
    } else {
      lotGapStatus = {
        tone: 'warn',
        label: `Lot gap · ⚠ Below recommended ${LOT_GAP_MM} mm (${lotGap} mm)`,
      };
    }
  }

  const batchGapOk = batchSpacing.tone !== 'warn' && lotGapStatus.tone !== 'warn';
  return {
    batchSpacing,
    lotGapStatus,
    batchGapOk,
    batchGapMm: Number.isFinite(len) && len > 0 ? len : undefined,
    lotGapMm: Number.isFinite(lotGap) ? lotGap : undefined,
  };
}

function zoneOutsideSoakRecipe(minC, maxC, soakingSpecC) {
  const spec = Number(soakingSpecC);
  if (!Number.isFinite(spec)) return false;
  const lo = spec - SOAK_TOLERANCE_C;
  const hi = spec + SOAK_TOLERANCE_C;
  const minRaw = minC === '' || minC == null ? NaN : Number(minC);
  const maxRaw = maxC === '' || maxC == null ? NaN : Number(maxC);
  // Empty = not entered — do not treat as outside tolerance
  if (!Number.isFinite(minRaw) && !Number.isFinite(maxRaw)) return false;
  if (Number.isFinite(minRaw) && (minRaw < lo || minRaw > hi)) return true;
  if (Number.isFinite(maxRaw) && (maxRaw < lo || maxRaw > hi)) return true;
  return false;
}

/** Client-side MT preview — same strict dims rule as server (never invents). */
function deriveTotalMtPreview(odMm, thkMm, lengthMm, pieces) {
  const od = Number(odMm);
  const thk = Number(thkMm);
  const len = Number(lengthMm);
  const n = Number(pieces);
  if (![od, thk, len, n].every((x) => Number.isFinite(x) && x > 0)) return null;
  const odM = od / 1000;
  const thkM = thk / 1000;
  const lenM = len / 1000;
  const id = Math.max(odM - 2 * thkM, 0.001);
  const area = (Math.PI / 4) * (odM * odM - id * id);
  const kg = area * lenM * 7850 * n;
  return Math.round((kg / 1000) * 1000) / 1000;
}

const ZONE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function formatHistSize(size) {
  if (!size || typeof size !== 'object') return '—';
  const od = size.odMm ?? size.od_mm ?? '';
  const thk = size.thkMm ?? size.thk_mm ?? '';
  const len = size.lengthMm ?? size.length_mm ?? '';
  if (od === '' && thk === '' && len === '') return '—';
  return `${od}×${thk}×${len}`;
}

function formatHistZones(lot) {
  const parts = [];
  for (let z = 1; z <= 6; z += 1) {
    const min = lot[`zone${z}MinC`];
    const max = lot[`zone${z}MaxC`];
    if (min == null && max == null) continue;
    parts.push(`${ZONE_ROMAN[z - 1]}:${min ?? '—'}–${max ?? '—'}`);
  }
  return parts.length ? parts.join(' ') : '—';
}

function countHistZonesFilled(lot) {
  let n = 0;
  for (let z = 1; z <= 6; z += 1) {
    if (lot[`zone${z}MinC`] != null || lot[`zone${z}MaxC`] != null) n += 1;
  }
  return n;
}

function operatorDisplayName() {
  const u = getStoredUser();
  return u?.fullName ?? u?.empCode ?? u?.username ?? '';
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

const emptyForm = (furnaceCode = 'RHF-03') => ({
  chargeNo: nextProductionRunNo(furnaceCode),
  furnaceCode,
  workOrderNo: '',
  customerCode: '',
  gradeCode: '',
  sizeOd: '',
  sizeThk: '',
  sizeLen: '',
  tubeCount: '',
  htType: 'ANNEAL',
  lineSpeedMhr: '',
  disposition: 'ACCEPT',
  remarks: '',
  shiftRef: currentShiftRef(),
  prodDate: new Date().toISOString().slice(0, 10),
  lotGapMm: '',
  zone1MinC: '',
  zone1MaxC: '',
  zone2MinC: '',
  zone2MaxC: '',
  zone3MinC: '',
  zone3MaxC: '',
  zone4MinC: '',
  zone4MaxC: '',
  zone5MinC: '',
  zone5MaxC: '',
  zone6MinC: '',
  zone6MaxC: '',
});

export default function FurnaceCapture({
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
  const [nav, setNav] = useState('furnaces');
  const [selectedFurnace, setSelectedFurnace] = useState(null);
  const [boardStatus, setBoardStatus] = useState('IDLE');
  const [orderLocked, setOrderLocked] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [filterWo, setFilterWo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFurnaceHist, setFilterFurnaceHist] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');
  const [gasType, setGasType] = useState('N2-PSA');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [histMode, setHistMode] = useState('lots'); // lots | gas | stop
  const [filterStopStatus, setFilterStopStatus] = useState('');
  const [stoppageDialogOpen, setStoppageDialogOpen] = useState(false);
  const [stoppageBusy, setStoppageBusy] = useState(false);
  const [railBusy, setRailBusy] = useState(false);
  const [railTick, setRailTick] = useState(0);
  const [consOpen, setConsOpen] = useState(false);
  const [consBusy, setConsBusy] = useState(false);
  const [consFurnace, setConsFurnace] = useState('');
  const [consDate, setConsDate] = useState('');
  const [htLocked, setHtLocked] = useState(false);

  const q = useMemo(() => {
    const o = {};
    if (filterWo) o.workOrderNo = filterWo;
    if (filterStatus) o.status = filterStatus;
    if (selectedFurnace) o.furnaceCode = selectedFurnace;
    return o;
  }, [filterWo, filterStatus, selectedFurnace]);

  const histQ = useMemo(() => {
    const o = {};
    if (filterWo) o.workOrderNo = filterWo;
    if (filterStatus) o.status = filterStatus;
    if (filterFurnaceHist) o.furnaceCode = filterFurnaceHist;
    else if (selectedFurnace) o.furnaceCode = selectedFurnace;
    if (histFrom) o.fromDate = histFrom;
    if (histTo) o.toDate = histTo;
    return o;
  }, [filterWo, filterStatus, filterFurnaceHist, selectedFurnace, histFrom, histTo]);

  const gasLogQ = useMemo(() => {
    const o = {};
    if (filterFurnaceHist) o.furnaceCode = filterFurnaceHist;
    else if (selectedFurnace) o.furnaceCode = selectedFurnace;
    if (histFrom) o.fromDate = histFrom;
    if (histTo) o.toDate = `${histTo}T23:59:59`;
    return o;
  }, [filterFurnaceHist, selectedFurnace, histFrom, histTo]);

  const stopHistQ = useMemo(() => {
    const o = {};
    if (filterFurnaceHist) o.furnaceCode = filterFurnaceHist;
    else if (selectedFurnace) o.furnaceCode = selectedFurnace;
    if (histFrom) o.fromDate = histFrom;
    if (histTo) o.toDate = `${histTo}T23:59:59`;
    if (filterStopStatus === 'open') o.openOnly = 'true';
    else if (filterStopStatus === 'closed') o.openOnly = 'false';
    return o;
  }, [filterFurnaceHist, selectedFurnace, histFrom, histTo, filterStopStatus]);

  const { data: lots = [] } = useQuery({
    queryKey: ['furnace-lots', q],
    queryFn: () => furnaceApi.listLots(q),
  });
  const { data: histLots = [] } = useQuery({
    queryKey: ['furnace-lots-hist', histQ],
    queryFn: () => furnaceApi.listLots(histQ),
  });
  const { data: gasHist = [] } = useQuery({
    queryKey: ['furnace-gas-logs', gasLogQ],
    queryFn: () => furnaceApi.gasLogs(gasLogQ),
    enabled: histMode === 'gas' || nav === 'gas',
  });
  const { data: stopHist = [] } = useQuery({
    queryKey: ['furnace-stoppage-hist', stopHistQ],
    queryFn: () => furnaceApi.stoppageHistory(stopHistQ),
    enabled: histMode === 'stop',
  });
  const { data: machines = [] } = useQuery({
    queryKey: ['furnace-machines'],
    queryFn: () => furnaceApi.machines(),
  });
  const { data: boardRows = [] } = useQuery({
    queryKey: ['furnace-board'],
    queryFn: () => furnaceApi.board(),
    refetchInterval: 30_000,
  });

  const consFurnaceEffective =
    consFurnace || selectedFurnace || form.furnaceCode || (machines[0] ? machineCodeOf(machines[0]) : '');
  const consDateEffective =
    consDate || form.prodDate || new Date().toISOString().slice(0, 10);

  const { data: dailyConsumption } = useQuery({
    queryKey: ['furnace-daily-consumption', consFurnaceEffective, consDateEffective],
    queryFn: () =>
      furnaceApi.getConsumption({
        furnaceCode: consFurnaceEffective,
        prodDate: consDateEffective,
      }),
    enabled: consOpen && !!consFurnaceEffective && !!consDateEffective,
  });

  const consBoardRow = useMemo(
    () => boardRows.find((r) => r.furnaceCode === consFurnaceEffective) ?? null,
    [boardRows, consFurnaceEffective]
  );
  const { data: stoppageCodes = [] } = useQuery({
    queryKey: ['stoppage-codes', 'FUR'],
    queryFn: () => stoppageApi.codes('FUR'),
  });
  const { data: lotStoppages = [] } = useQuery({
    queryKey: ['furnace-lot-stoppages', selectedId],
    queryFn: () => stoppageApi.list('FUR', selectedId),
    enabled: !!selectedId,
  });
  const openStoppage = useMemo(
    () =>
      (lotStoppages ?? []).find((s) => {
        const v = s.is_open ?? s.isOpen;
        return v === true || v === 1 || v === 't' || v === 'true';
      }) ?? null,
    [lotStoppages]
  );

  const furnaceMeta = useMemo(
    () => getFurnaceMeta(machines, selectedFurnace || form.furnaceCode),
    [machines, selectedFurnace, form.furnaceCode]
  );

  useEffect(() => {
    if (furnaceMeta?.gasType) setGasType(furnaceMeta.gasType);
  }, [furnaceMeta?.gasType, selectedFurnace]);

  useEffect(() => {
    if (!selectedFurnace) return;
    const row = boardRows.find((r) => r.furnaceCode === selectedFurnace);
    if (row?.status) setBoardStatus(row.status);
  }, [boardRows, selectedFurnace]);

  function invalidateFurnaceQueries() {
    qc.invalidateQueries({ queryKey: ['furnace-lots'] });
    qc.invalidateQueries({ queryKey: ['furnace-lots-hist'] });
    qc.invalidateQueries({ queryKey: ['furnace-lot'] });
    qc.invalidateQueries({ queryKey: ['furnace-board'] });
    qc.invalidateQueries({ queryKey: ['furnace-open-stoppages'] });
    qc.invalidateQueries({ queryKey: ['furnace-lot-stoppages'] });
    qc.invalidateQueries({ queryKey: ['furnace-stoppage-hist'] });
  }

  useEffect(() => {
    if (nav === 'stop') setNav('history');
  }, [nav]);

  function openFurnaceFromBoard(row) {
    setSelectedFurnace(row.furnaceCode);
    setBoardStatus(row.status || 'IDLE');
    setForm((f) => ({
      ...emptyForm(row.furnaceCode),
      furnaceCode: row.furnaceCode,
      workOrderNo: row.runningOrder?.workOrderNo || '',
      customerCode: row.runningOrder?.customerCode || '',
      gradeCode: row.runningOrder?.gradeCode || '',
      sizeOd: row.runningOrder?.sizeJson?.odMm != null ? String(row.runningOrder.sizeJson.odMm) : '',
      sizeThk: row.runningOrder?.sizeJson?.thkMm != null ? String(row.runningOrder.sizeJson.thkMm) : '',
      sizeLen: row.runningOrder?.sizeJson?.lengthMm != null ? String(row.runningOrder.sizeJson.lengthMm) : '',
    }));
    const locked = Boolean(row.runningOrder?.workOrderNo);
    setOrderLocked(locked);
    if (row.lotId && row.status !== 'IDLE') {
      setSelectedId(String(row.lotId));
    } else {
      setSelectedId(null);
    }
    const meta = getFurnaceMeta(machines, row.furnaceCode);
    if (meta?.gasType) setGasType(meta.gasType);
    setNav('capture');
  }

  function onAssignedFromBoard(lot, furnaceCode) {
    setSelectedFurnace(furnaceCode);
    setSelectedId(String(lot.id));
    setOrderLocked(Boolean(lot.workOrderNo));
    setBoardStatus('PREPARING');
    setForm((f) => ({
      ...emptyForm(furnaceCode),
      chargeNo: String(lot.chargeNo ?? f.chargeNo),
      furnaceCode,
      workOrderNo: String(lot.workOrderNo ?? ''),
      customerCode: String(lot.customerCode ?? ''),
      gradeCode: String(lot.gradeCode ?? ''),
      sizeOd: lot.size?.odMm != null ? String(lot.size.odMm) : '',
      sizeThk: lot.size?.thkMm != null ? String(lot.size.thkMm) : '',
      sizeLen: lot.size?.lengthMm != null ? String(lot.size.lengthMm) : '',
    }));
    const meta = getFurnaceMeta(machines, furnaceCode);
    if (meta?.gasType) setGasType(meta.gasType);
    setNav('capture');
  }
  const { data: detail } = useQuery({
    queryKey: ['furnace-lot', selectedId],
    queryFn: () => furnaceApi.getLot(selectedId),
    enabled: !!selectedId,
  });
  const { data: recipe } = useQuery({
    queryKey: ['furnace-recipe', form.gradeCode, form.furnaceCode],
    queryFn: () =>
      furnaceApi.recipe({ gradeCode: form.gradeCode || undefined, furnaceCode: form.furnaceCode || undefined }),
    enabled: !!(form.gradeCode || form.furnaceCode),
  });

  const recipeMaster = useMemo(
    () =>
      recipe
        ? { soakingSpecC: recipe.soakingSpecC, speedSpecMhr: recipe.speedSpecMhr }
        : undefined,
    [recipe]
  );

  useEffect(() => {
    if (recipe?.htType && !selectedId) {
      setForm((f) => (f.htType === recipe.htType ? f : { ...f, htType: recipe.htType }));
      setHtLocked(true);
    }
  }, [recipe?.htType, selectedId]);

  useEffect(() => {
    if (!detail) return;
    const size = detail.size ?? {};
    setForm((f) => ({
      ...f,
      chargeNo: String(detail.chargeNo ?? f.chargeNo),
      furnaceCode: String(detail.furnaceCode ?? f.furnaceCode),
      workOrderNo: String(detail.workOrderNo ?? ''),
      customerCode: String(detail.customerCode ?? ''),
      gradeCode: String(detail.gradeCode ?? ''),
      sizeOd: size.odMm != null ? String(size.odMm) : '',
      sizeThk: size.thkMm != null ? String(size.thkMm) : '',
      sizeLen: size.lengthMm != null ? String(size.lengthMm) : '',
      tubeCount:
        detail.tubeCount != null
          ? String(detail.tubeCount)
          : detail.qtyNos != null
            ? String(detail.qtyNos)
            : '',
      htType: String(detail.htType ?? 'ANNEAL'),
      lineSpeedMhr: detail.lineSpeedMhr != null ? String(detail.lineSpeedMhr) : '',
      disposition: String(detail.disposition ?? 'ACCEPT'),
      remarks: String(detail.remarks ?? ''),
      shiftRef: String(detail.shiftRef ?? currentShiftRef()),
      prodDate: detail.prodDate ? String(detail.prodDate).slice(0, 10) : f.prodDate,
      lotGapMm: detail.lotGapMm != null ? String(detail.lotGapMm) : f.lotGapMm,
      zone1MinC: detail.zone1MinC != null ? String(detail.zone1MinC) : '',
      zone1MaxC: detail.zone1MaxC != null ? String(detail.zone1MaxC) : '',
      zone2MinC: detail.zone2MinC != null ? String(detail.zone2MinC) : '',
      zone2MaxC: detail.zone2MaxC != null ? String(detail.zone2MaxC) : '',
      zone3MinC: detail.zone3MinC != null ? String(detail.zone3MinC) : '',
      zone3MaxC: detail.zone3MaxC != null ? String(detail.zone3MaxC) : '',
      zone4MinC: detail.zone4MinC != null ? String(detail.zone4MinC) : '',
      zone4MaxC: detail.zone4MaxC != null ? String(detail.zone4MaxC) : '',
      zone5MinC: detail.zone5MinC != null ? String(detail.zone5MinC) : '',
      zone5MaxC: detail.zone5MaxC != null ? String(detail.zone5MaxC) : '',
      zone6MinC: detail.zone6MinC != null ? String(detail.zone6MinC) : '',
      zone6MaxC: detail.zone6MaxC != null ? String(detail.zone6MaxC) : '',
    }));
    setOrderLocked(Boolean(detail.workOrderNo));
    setHtLocked(Boolean(detail.htType));
    if (detail.furnaceCode) setSelectedFurnace(String(detail.furnaceCode));
  }, [detail]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function num(v) {
    return v === '' ? undefined : Number(v);
  }

  function payload() {
    const tubeCount = num(form.tubeCount);
    const derivedMt = deriveTotalMtPreview(form.sizeOd, form.sizeThk, form.sizeLen, tubeCount);
    const gap = deriveBatchGapStatus({ lengthMm: form.sizeLen, lotGapMm: form.lotGapMm });
    return {
      chargeNo: form.chargeNo,
      furnaceCode: form.furnaceCode,
      workOrderNo: form.workOrderNo || undefined,
      customerCode: form.customerCode || undefined,
      gradeCode: form.gradeCode || undefined,
      size: {
        odMm: num(form.sizeOd),
        thkMm: num(form.sizeThk),
        lengthMm: num(form.sizeLen),
      },
      tubeCount,
      qtyNos: tubeCount,
      totalNos: tubeCount,
      totalMt: derivedMt ?? undefined,
      qtyMt: derivedMt ?? undefined,
      htType: form.htType,
      lineSpeedMhr: num(form.lineSpeedMhr),
      disposition: form.disposition || undefined,
      remarks: form.remarks || undefined,
      shiftRef: form.shiftRef || currentShiftRef(),
      prodDate: form.prodDate || undefined,
      batchGapOk: gap.batchGapOk,
      lotGapMm: gap.lotGapMm,
      batchGapMm: gap.batchGapMm,
      dataSource: 'MANUAL',
      zone1MinC: num(form.zone1MinC),
      zone1MaxC: num(form.zone1MaxC),
      zone2MinC: num(form.zone2MinC),
      zone2MaxC: num(form.zone2MaxC),
      zone3MinC: num(form.zone3MinC),
      zone3MaxC: num(form.zone3MaxC),
      zone4MinC: num(form.zone4MinC),
      zone4MaxC: num(form.zone4MaxC),
      zone5MinC: num(form.zone5MinC),
      zone5MaxC: num(form.zone5MaxC),
      zone6MinC: num(form.zone6MinC),
      zone6MaxC: num(form.zone6MaxC),
    };
  }

  async function save() {
    setErr('');
    setMsg('');
    setWarn('');
    const p = payload();
    const v = validateProcessForm('FUR', p, recipeMaster);
    if (!v.ok) {
      setErr(v.errors.map((e) => e.message).join('; '));
      return;
    }
    if (v.warnings.length) {
      setWarn(v.warnings.map((w) => w.message).join('; '));
    }
    try {
      if (selectedId) {
        await furnaceApi.updateLot(selectedId, p);
        setMsg('Production record saved');
      } else {
        const created = await furnaceApi.createLot(p);
        setSelectedId(created.id);
        setMsg('Production record saved');
      }
      qc.invalidateQueries({ queryKey: ['furnace-lots'] });
      qc.invalidateQueries({ queryKey: ['furnace-lot'] });
      qc.invalidateQueries({ queryKey: ['furnace-board'] });
      qc.invalidateQueries({ queryKey: ['furnace-lots-hist'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    }
  }

  const historyContent = /*#__PURE__*/ _jsxs('section', {
    className: 'panel furnace-history',
    children: [
      /*#__PURE__*/ _jsxs('header', {
        className: 'panel__header furnace-history__header',
        children: [
          /*#__PURE__*/ _jsx('span', { className: 'eyebrow', children: 'Furnace history' }),
          /*#__PURE__*/ _jsxs('div', {
            className: 'furnace-history__seg',
            role: 'tablist',
            'aria-label': 'History mode',
            children: [
              /*#__PURE__*/ _jsx('button', {
                type: 'button',
                role: 'tab',
                className: histMode === 'lots' ? 'furnace-history__seg-btn is-active' : 'furnace-history__seg-btn',
                'aria-selected': histMode === 'lots',
                onClick: () => setHistMode('lots'),
                children: 'Production runs',
              }),
              /*#__PURE__*/ _jsx('button', {
                type: 'button',
                role: 'tab',
                className: histMode === 'gas' ? 'furnace-history__seg-btn is-active' : 'furnace-history__seg-btn',
                'aria-selected': histMode === 'gas',
                onClick: () => setHistMode('gas'),
                children: 'Gas logs',
              }),
              /*#__PURE__*/ _jsx('button', {
                type: 'button',
                role: 'tab',
                className: histMode === 'stop' ? 'furnace-history__seg-btn is-active' : 'furnace-history__seg-btn',
                'aria-selected': histMode === 'stop',
                onClick: () => setHistMode('stop'),
                children: 'Stoppages',
              }),
            ],
          }),
        ],
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'furnace-history__toolbar',
        children: [
          /*#__PURE__*/ _jsxs('label', {
            className: 'furnace-history__field',
            children: [
              /*#__PURE__*/ _jsx('span', { children: 'Furnace' }),
              /*#__PURE__*/ _jsxs(ZSelect, {
                value: filterFurnaceHist,
                onChange: (e) => setFilterFurnaceHist(e.target.value),
                children: [
                  /*#__PURE__*/ _jsx('option', {
                    value: '',
                    children: selectedFurnace ? `Selected (${selectedFurnace})` : 'All furnaces',
                  }),
                  machines.map((m) =>
                    /*#__PURE__*/ _jsx(
                      'option',
                      { value: machineCodeOf(m), children: machineCodeOf(m) },
                      machineCodeOf(m)
                    )
                  ),
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
          histMode === 'lots'
            ? /*#__PURE__*/ _jsxs('label', {
                className: 'furnace-history__field furnace-history__field--grow',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Work order' }),
                  /*#__PURE__*/ _jsx(ZInput, {
                    placeholder: 'Filter WO…',
                    value: filterWo,
                    onChange: (e) => setFilterWo(e.target.value),
                  }),
                ],
              })
            : null,
          histMode === 'lots'
            ? /*#__PURE__*/ _jsxs('label', {
                className: 'furnace-history__field',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Status' }),
                  /*#__PURE__*/ _jsxs(ZSelect, {
                    value: filterStatus,
                    onChange: (e) => setFilterStatus(e.target.value),
                    children: [
                      /*#__PURE__*/ _jsx('option', { value: '', children: 'All' }),
                      /*#__PURE__*/ _jsx('option', { value: 'DRAFT', children: 'DRAFT' }),
                      /*#__PURE__*/ _jsx('option', { value: 'SUBMITTED', children: 'SUBMITTED' }),
                      /*#__PURE__*/ _jsx('option', { value: 'APPROVED', children: 'APPROVED' }),
                      /*#__PURE__*/ _jsx('option', { value: 'HOLD', children: 'HOLD' }),
                    ],
                  }),
                ],
              })
            : null,
          histMode === 'stop'
            ? /*#__PURE__*/ _jsxs('label', {
                className: 'furnace-history__field',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Status' }),
                  /*#__PURE__*/ _jsxs(ZSelect, {
                    value: filterStopStatus,
                    onChange: (e) => setFilterStopStatus(e.target.value),
                    children: [
                      /*#__PURE__*/ _jsx('option', { value: '', children: 'All' }),
                      /*#__PURE__*/ _jsx('option', { value: 'open', children: 'Open' }),
                      /*#__PURE__*/ _jsx('option', { value: 'closed', children: 'Closed' }),
                    ],
                  }),
                ],
              })
            : null,
        ],
      }),
      /*#__PURE__*/ _jsx('div', {
        className: 'furnace-history__table-wrap',
        children:
          histMode === 'lots'
            ? /*#__PURE__*/ _jsxs('table', {
                className: 'furnace-hist-table',
                children: [
                  /*#__PURE__*/ _jsx('thead', {
                    children: /*#__PURE__*/ _jsxs('tr', {
                      children: [
                        /*#__PURE__*/ _jsx('th', { children: 'Date' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Shift' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Furnace' }),
                        /*#__PURE__*/ _jsx('th', { children: 'WO' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Customer' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Size' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Grade' }),
                        /*#__PURE__*/ _jsx('th', { children: 'HT' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Nos' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Zones' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Speed' }),
                        /*#__PURE__*/ _jsx('th', { children: 'MT' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Disposition' }),
                        /*#__PURE__*/ _jsx('th', { children: 'Status' }),
                      ],
                    }),
                  }),
                  /*#__PURE__*/ _jsx('tbody', {
                    children: histLots.length
                      ? histLots.map((l) => {
                          const nos = l.totalNos ?? l.tubeCount ?? l.qtyNos;
                          const zFilled = countHistZonesFilled(l);
                          const zTitle = formatHistZones(l);
                          return /*#__PURE__*/ _jsxs(
                            'tr',
                            {
                              className:
                                selectedId === String(l.id)
                                  ? 'furnace-hist-table__row is-selected'
                                  : 'furnace-hist-table__row',
                              onClick: () => {
                                setSelectedFurnace(String(l.furnaceCode ?? ''));
                                setSelectedId(String(l.id));
                                setOrderLocked(Boolean(l.workOrderNo));
                                setNav('capture');
                              },
                              children: [
                                /*#__PURE__*/ _jsx('td', {
                                  children: l.prodDate ? String(l.prodDate).slice(0, 10) : '—',
                                }),
                                /*#__PURE__*/ _jsx('td', { children: String(l.shiftRef ?? '—') }),
                                /*#__PURE__*/ _jsx('td', {
                                  className: 'font-mono',
                                  children: String(l.furnaceCode ?? '—'),
                                }),
                                /*#__PURE__*/ _jsx('td', {
                                  className: 'font-mono',
                                  children: String(l.workOrderNo ?? '—'),
                                }),
                                /*#__PURE__*/ _jsx('td', { children: String(l.customerCode ?? '—') }),
                                /*#__PURE__*/ _jsx('td', {
                                  className: 'font-mono',
                                  children: formatHistSize(l.size),
                                }),
                                /*#__PURE__*/ _jsx('td', { children: String(l.gradeCode ?? '—') }),
                                /*#__PURE__*/ _jsx('td', { children: String(l.htType ?? '—') }),
                                /*#__PURE__*/ _jsx('td', {
                                  children: nos != null ? String(nos) : '—',
                                }),
                                /*#__PURE__*/ _jsx('td', {
                                  className: 'furnace-hist-table__zones',
                                  title: zTitle !== '—' ? zTitle : undefined,
                                  children: /*#__PURE__*/ _jsx('span', {
                                    className: 'furnace-hist-table__zones-pill',
                                    children: `${zFilled}/6`,
                                  }),
                                }),
                                /*#__PURE__*/ _jsx('td', {
                                  children: l.lineSpeedMhr != null ? String(l.lineSpeedMhr) : '—',
                                }),
                                /*#__PURE__*/ _jsx('td', {
                                  children:
                                    l.totalMt != null
                                      ? String(l.totalMt)
                                      : l.qtyMt != null
                                        ? String(l.qtyMt)
                                        : '—',
                                }),
                                /*#__PURE__*/ _jsx('td', { children: String(l.disposition ?? '—') }),
                                /*#__PURE__*/ _jsx('td', {
                                  children: /*#__PURE__*/ _jsx(ZBadge, {
                                    tone: statusTone(String(l.status)),
                                    children: String(l.status ?? ''),
                                  }),
                                }),
                              ],
                            },
                            String(l.id)
                          );
                        })
                      : /*#__PURE__*/ _jsx('tr', {
                          children: /*#__PURE__*/ _jsx('td', {
                            colSpan: 14,
                            className: 'empty-hint',
                            children: 'No production runs yet.',
                          }),
                        }),
                  }),
                ],
              })
            : histMode === 'gas'
              ? /*#__PURE__*/ _jsxs('table', {
                  className: 'furnace-hist-table',
                  children: [
                    /*#__PURE__*/ _jsx('thead', {
                      children: /*#__PURE__*/ _jsxs('tr', {
                        children: [
                          /*#__PURE__*/ _jsx('th', { children: 'Time' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Furnace' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Run' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Type' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Dew' }),
                          /*#__PURE__*/ _jsx('th', { children: 'H₂' }),
                          /*#__PURE__*/ _jsx('th', { children: 'O₂' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Params' }),
                        ],
                      }),
                    }),
                    /*#__PURE__*/ _jsx('tbody', {
                      children: gasHist.length
                        ? gasHist.map((g) =>
                            /*#__PURE__*/ _jsxs(
                              'tr',
                              {
                                children: [
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: g.loggedAt
                                      ? String(g.loggedAt).replace('T', ' ').slice(0, 19)
                                      : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: String(g.furnaceCode ?? '—'),
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: String(g.chargeNo ?? '—'),
                                  }),
                                  /*#__PURE__*/ _jsx('td', { children: String(g.gasType ?? '—') }),
                                  /*#__PURE__*/ _jsx('td', { children: String(g.dewPointC ?? '—') }),
                                  /*#__PURE__*/ _jsx('td', { children: String(g.h2Pct ?? '—') }),
                                  /*#__PURE__*/ _jsx('td', { children: String(g.o2Ppm ?? '—') }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children: String(
                                      g.gasParams
                                        ? Object.keys(g.gasParams).filter((k) => k !== 'changeoverNote')
                                            .length
                                        : 0
                                    ),
                                  }),
                                ],
                              },
                              String(g.id)
                            )
                          )
                        : /*#__PURE__*/ _jsx('tr', {
                            children: /*#__PURE__*/ _jsx('td', {
                              colSpan: 8,
                              className: 'empty-hint',
                              children: 'No gas logs yet.',
                            }),
                          }),
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
                          /*#__PURE__*/ _jsx('th', { children: 'Furnace' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Run' }),
                          /*#__PURE__*/ _jsx('th', { children: 'WO' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Code' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Reason' }),
                          /*#__PURE__*/ _jsx('th', { children: 'Status' }),
                          /*#__PURE__*/ _jsx('th', { children: '' }),
                        ],
                      }),
                    }),
                    /*#__PURE__*/ _jsx('tbody', {
                      children: stopHist.length
                        ? stopHist.map((s) => {
                            const open = Boolean(s.isOpen);
                            return /*#__PURE__*/ _jsxs(
                              'tr',
                              {
                                className: 'furnace-hist-table__row',
                                onClick: () => {
                                  if (!s.sourceId) return;
                                  if (s.furnaceCode) setSelectedFurnace(String(s.furnaceCode));
                                  setSelectedId(String(s.sourceId));
                                  setOrderLocked(Boolean(s.workOrderNo));
                                  setNav('capture');
                                },
                                children: [
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: s.fromTime
                                      ? String(s.fromTime).replace('T', ' ').slice(0, 19)
                                      : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: s.toTime
                                      ? String(s.toTime).replace('T', ' ').slice(0, 19)
                                      : '—',
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: String(s.furnaceCode ?? '—'),
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: String(s.chargeNo ?? '—'),
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'font-mono',
                                    children: String(s.workOrderNo ?? '—'),
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children: /*#__PURE__*/ _jsx(ZBadge, {
                                      tone: statusTone(open ? 'STOPPAGE' : 'SUBMITTED'),
                                      children: s.stoppageCode || 'STOP',
                                    }),
                                  }),
                                  /*#__PURE__*/ _jsx('td', { children: String(s.reason ?? '—') }),
                                  /*#__PURE__*/ _jsx('td', {
                                    children: /*#__PURE__*/ _jsx(ZBadge, {
                                      tone: statusTone(open ? 'STOPPAGE' : 'APPROVED'),
                                      children: open ? 'OPEN' : 'CLOSED',
                                    }),
                                  }),
                                  /*#__PURE__*/ _jsx('td', {
                                    className: 'furnace-hist-table__actions',
                                    children: open
                                      ? /*#__PURE__*/ _jsx(ZButton, {
                                          variant: 'primary',
                                          onClick: (e) => {
                                            e.stopPropagation();
                                            void (async () => {
                                              try {
                                                await stoppageApi.close('FUR', s.sourceId);
                                                setMsg('Stoppage ended');
                                                invalidateFurnaceQueries();
                                              } catch (errEnd) {
                                                setErr(
                                                  errEnd instanceof Error
                                                    ? errEnd.message
                                                    : 'End stoppage failed'
                                                );
                                              }
                                            })();
                                          },
                                          children: 'End',
                                        })
                                      : null,
                                  }),
                                ],
                              },
                              String(s.id)
                            );
                          })
                        : /*#__PURE__*/ _jsx('tr', {
                            children: /*#__PURE__*/ _jsx('td', {
                              colSpan: 9,
                              className: 'empty-hint',
                              children: 'No stoppages yet.',
                            }),
                          }),
                    }),
                  ],
                }),
      }),
    ],
  });

  const furnacesContent = /*#__PURE__*/ _jsx(FurnaceBoard, {
    onOpenFurnace: openFurnaceFromBoard,
    onAssigned: onAssignedFromBoard,
  });

  const gasContent = /*#__PURE__*/ _jsxs('div', {
    className: 'stack-gap',
    children: [
      /*#__PURE__*/ _jsxs('section', {
        className: 'panel',
        children: [
          /*#__PURE__*/ _jsx('header', {
            className: 'panel__header',
            children: /*#__PURE__*/ _jsx('span', {
              className: 'eyebrow',
              children: `Gas plant · ${furnaceMeta?.gasType ?? gasType} (MANUAL)`,
            }),
          }),
          selectedId
            ? /*#__PURE__*/ _jsx(FurnaceGasMatrix, {
                defaultGasType: furnaceMeta?.gasType || gasType,
                disabled: !isWritable,
                recentLogs: detail?.gasLogs ?? [],
                onSubmit: async (body) => {
                  await furnaceApi.addGasLog(selectedId, body);
                  qc.invalidateQueries({ queryKey: ['furnace-lot', selectedId] });
                  qc.invalidateQueries({ queryKey: ['furnace-gas-logs'] });
                  setMsg('Gas log added');
                },
              })
            : /*#__PURE__*/ _jsx('p', {
                className: 'empty-hint',
                children: 'Open a production run from the board to log gas plant readings.',
              }),
        ],
      }),
    ],
  });

  const ordersContent = /*#__PURE__*/ _jsx(FurnaceWorkOrderHub, {
    isWritable,
    onMoveToProduction: onAssignedFromBoard,
  });

  const machineStatus = (() => {
    if (openStoppage) return 'STOPPAGE';
    if (detail?.productionEndedAt || boardStatus === 'COMPLETE') return 'COMPLETE';
    if (boardStatus === 'STOPPAGE' || boardStatus === 'HOLD') return 'STOPPAGE';
    if (detail?.productionStartedAt || boardStatus === 'RUNNING') return 'RUNNING';
    if ((selectedId && form.workOrderNo) || boardStatus === 'PREPARING') return 'PREPARING';
    return boardStatus || 'IDLE';
  })();
  const displayStatus = machineStatus;
  const batchGapView = deriveBatchGapStatus({ lengthMm: form.sizeLen, lotGapMm: form.lotGapMm });
  const soakSpec = recipe?.soakingSpecC;
  const canStart =
    isWritable &&
    !!selectedId &&
    !!form.workOrderNo &&
    !detail?.productionStartedAt &&
    !detail?.productionEndedAt &&
    displayStatus !== 'STOPPAGE' &&
    displayStatus !== 'COMPLETE';
  const canEnd =
    isWritable &&
    !!selectedId &&
    !!detail?.productionStartedAt &&
    !detail?.productionEndedAt &&
    displayStatus === 'RUNNING';
  const canOpenStoppage =
    isWritable && !!selectedId && displayStatus === 'RUNNING' && !openStoppage;
  const canEndStoppage = isWritable && !!selectedId && displayStatus === 'STOPPAGE';
  const isHeld = detail?.status === 'HOLD';
  const captureActive = nav === 'capture' && !!selectedId;
  const canHold =
    canMachineHead && isWritable && !!selectedId && !detail?.productionEndedAt && !isHeld;

  const actionPrimary = openStoppage
    ? 'resume'
    : canEnd
      ? 'end'
      : canStart
        ? 'start'
        : undefined;

  useEffect(() => {
    if (!captureActive) return undefined;
    const id = window.setInterval(() => setRailTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [captureActive, openStoppage, detail?.productionStartedAt]);

  const actionTimer = useMemo(() => {
    void railTick;
    if (openStoppage?.from_time || openStoppage?.fromTime) {
      return formatElapsed(openStoppage.from_time || openStoppage.fromTime);
    }
    if (detail?.productionStartedAt && !detail?.productionEndedAt) {
      return formatElapsed(detail.productionStartedAt);
    }
    return '00:00:00';
  }, [railTick, openStoppage, detail?.productionStartedAt, detail?.productionEndedAt]);

  const stoppageBanner = openStoppage
    ? /*#__PURE__*/ _jsxs('div', {
        className: 'status-rail__stoppage',
        children: [
          '■ Stoppage ',
          String(openStoppage.stoppage_code ?? openStoppage.stoppageCode ?? 'UNCODED'),
          openStoppage.reason ? ` / ${openStoppage.reason}` : '',
          ' — since ',
          new Date(
            String(openStoppage.from_time || openStoppage.fromTime || Date.now())
          ).toLocaleTimeString(),
        ],
      })
    : undefined;

  async function handleStart() {
    if (!selectedId || !canStart) return;
    setRailBusy(true);
    try {
      await furnaceApi.start(selectedId);
      invalidateFurnaceQueries();
      setBoardStatus('RUNNING');
      setMsg('Production started');
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Start failed');
    } finally {
      setRailBusy(false);
    }
  }

  async function handleEnd() {
    if (!selectedId || !canEnd) return;
    setRailBusy(true);
    try {
      await furnaceApi.end(selectedId);
      invalidateFurnaceQueries();
      setBoardStatus('COMPLETE');
      setMsg('Production ended');
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'End failed');
    } finally {
      setRailBusy(false);
    }
  }

  async function handleEndStoppage() {
    if (!selectedId) return;
    setStoppageBusy(true);
    try {
      await stoppageApi.close('FUR', selectedId);
      setMsg('Stoppage ended — machine RUNNING');
      setBoardStatus('RUNNING');
      setStoppageDialogOpen(false);
      setErr('');
      invalidateFurnaceQueries();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'End stoppage failed');
    } finally {
      setStoppageBusy(false);
    }
  }

  async function handleHold() {
    if (!selectedId || !canHold) return;
    setRailBusy(true);
    try {
      await furnaceApi.hold(selectedId);
      invalidateFurnaceQueries();
      setMsg('On hold');
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hold failed');
    } finally {
      setRailBusy(false);
    }
  }

  async function handleStoppageConfirm(body) {
    if (!selectedId) return;
    setStoppageBusy(true);
    try {
      if (openStoppage) {
        await stoppageApi.close('FUR', selectedId);
        setMsg('Stoppage ended — machine RUNNING');
        setBoardStatus('RUNNING');
      } else {
        await stoppageApi.open({
          processCode: 'FUR',
          sourceId: selectedId,
          millCode: form.furnaceCode || selectedFurnace,
          stoppageCode: body.stoppageCode,
          reason: body.reason || body.remark || undefined,
        });
        setMsg('Stoppage opened');
        setBoardStatus('STOPPAGE');
      }
      setStoppageDialogOpen(false);
      setErr('');
      invalidateFurnaceQueries();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Stoppage failed');
    } finally {
      setStoppageBusy(false);
    }
  }

  async function handleConsumptionSave(payload) {
    setConsBusy(true);
    try {
      await furnaceApi.saveConsumption(payload);
      setMsg('Consumption saved');
      setErr('');
      setConsOpen(false);
      qc.invalidateQueries({ queryKey: ['furnace-daily-consumption'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Consumption save failed');
      throw e;
    } finally {
      setConsBusy(false);
    }
  }

  return /*#__PURE__*/ _jsxs(_Fragment, {
    children: [
      /*#__PURE__*/ _jsx(ProcessStationShell, {
        processId: processId,
        processLabel: 'Furnace',
        machineCode: selectedFurnace || form.furnaceCode || '',
        crewSessionEnabled: Boolean(selectedFurnace || form.furnaceCode),
        processes: processes,
        onProcessChange: onProcessChange,
        onLogout: onLogout,
        showAdmin: showAdmin,
        onAdmin: onAdmin,
        roleLabel: roleLabel ?? role,
        millStatus: displayStatus,
        shiftLabel: `Shift ${form.shiftRef || currentShiftRef()}`,
        activeOrderId: form.chargeNo || form.workOrderNo || null,
        onConsumption: () => {
          setConsFurnace(selectedFurnace || form.furnaceCode || '');
          setConsDate(form.prodDate || new Date().toISOString().slice(0, 10));
          setConsOpen(true);
        },
        consumptionDisabled: !isWritable,
        jobActive: !!selectedId && isWritable && nav === 'capture',
        hold: isHeld,
        onHold: canHold && nav === 'capture' ? () => void handleHold() : undefined,
        holdDisabled: !canHold || railBusy,
        onManualStop:
          nav === 'capture' && (canOpenStoppage || openStoppage)
            ? () => setStoppageDialogOpen(true)
            : undefined,
        manualStopDisabled:
          (!canOpenStoppage && !openStoppage) || !isWritable || railBusy || stoppageBusy,
        stoppageBanner: nav === 'capture' ? stoppageBanner : undefined,
        actionRail:
          !!selectedId && isWritable && nav === 'capture'
            ? /*#__PURE__*/ _jsx(ProductionActionRail, {
                jobId: form.chargeNo
                  ? `Charge ${form.chargeNo}`
                  : form.workOrderNo
                    ? `WO ${form.workOrderNo}`
                    : selectedFurnace || 'FUR',
                timer: actionTimer,
                statusLabel: displayStatus,
                primary: actionPrimary,
                busy: railBusy || stoppageBusy,
                disabled: !isWritable,
                hold: isHeld,
                onStart: canStart ? () => void handleStart() : undefined,
                onResume: openStoppage ? () => void handleEndStoppage() : undefined,
                onEnd: canEnd ? () => void handleEnd() : undefined,
                onStoppage:
                  canOpenStoppage || openStoppage
                    ? () => setStoppageDialogOpen(true)
                    : undefined,
                onHold: canHold ? () => void handleHold() : undefined,
              })
            : null,
        historyContent: historyContent,
        ordersContent: ordersContent,
        furnacesContent: furnacesContent,
        gasContent: gasContent,
        navItems: FUR_NAV_ITEMS,
        initialNav: 'furnaces',
        nav: nav,
        onNavChange: setNav,
        hideCaptureHeader: true,
        children: [
          /*#__PURE__*/ _jsxs('div', {
          className: 'process-capture process-capture--embedded',
          children: [
            /*#__PURE__*/ _jsx('header', {
              className: 'fur-run-header',
              children: /*#__PURE__*/ _jsxs('dl', {
                className: 'fur-run-header__meta',
                children: [
                /*#__PURE__*/ _jsxs('div', {
                  children: [
                    /*#__PURE__*/ _jsx('dt', { children: 'Production Run' }),
                    /*#__PURE__*/ _jsx('dd', { className: 'font-mono', children: form.chargeNo || '—' }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  children: [
                    /*#__PURE__*/ _jsx('dt', { children: 'WO' }),
                    /*#__PURE__*/ _jsx('dd', { className: 'font-mono', children: form.workOrderNo || '—' }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  children: [
                    /*#__PURE__*/ _jsx('dt', { children: 'Customer' }),
                    /*#__PURE__*/ _jsx('dd', { children: form.customerCode || '—' }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  children: [
                    /*#__PURE__*/ _jsx('dt', { children: 'Grade' }),
                    /*#__PURE__*/ _jsx('dd', { children: form.gradeCode || '—' }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  children: [
                    /*#__PURE__*/ _jsx('dt', { children: 'Speed' }),
                    /*#__PURE__*/ _jsx('dd', {
                      children: form.lineSpeedMhr ? `${form.lineSpeedMhr} m/hr` : '—',
                    }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  children: [
                    /*#__PURE__*/ _jsx('dt', { children: 'Recipe' }),
                    /*#__PURE__*/ _jsx('dd', {
                      children: recipe
                        ? `${recipe.soakingSpecC ?? '—'}°C ±10 · ${recipe.speedSpecMhr ?? '—'} m/hr ±2`
                        : '—',
                    }),
                  ],
                }),
              ],
            }),
            }),
            
            canMachineHead && selectedId
              ? /*#__PURE__*/ _jsxs('div', {
                  className: 'process-capture__actions fur-run-header__actions',
                  children: [
                    /*#__PURE__*/ _jsx('span', {
                      className: 'muted',
                      style: { alignSelf: 'center', marginRight: 8 },
                      children: 'Review / Export',
                    }),
                    canHold
                      ? /*#__PURE__*/ _jsx(ZButton, {
                          disabled: railBusy,
                          onClick: () => void handleHold(),
                          children: 'Hold',
                        })
                      : null,
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        try {
                          await furnaceApi.clearExcursion(selectedId, {
                            disposition: 'ACCEPT_WITH_NOTE',
                            note: 'Cleared by Machine Head',
                          });
                          invalidateFurnaceQueries();
                          setMsg('Zone excursion cleared');
                          setErr('');
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : 'Clear excursion failed');
                        }
                      },
                      children: 'Clear excursion',
                    }),
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        try {
                          await furnaceApi.approve(selectedId);
                          invalidateFurnaceQueries();
                          setBoardStatus('COMPLETE');
                          setMsg('Approved — genealogy published');
                          setErr('');
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : 'Approve failed');
                        }
                      },
                      children: 'Approve',
                    }),
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        downloadJson(`${form.chargeNo || 'fur-run'}.json`, await furnaceApi.exportJson(selectedId));
                      },
                      children: 'Export JSON',
                    }),
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        downloadText(`${form.chargeNo || 'fur-run'}.csv`, await furnaceApi.exportCsv(selectedId));
                      },
                      children: 'Export CSV',
                    }),
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        const name = operatorDisplayName();
                        await downloadXlsx('/furnace/export', {
                          report: 'ANN-FT-01',
                          id: selectedId,
                          supervisor: name,
                          incharge: name,
                        });
                      },
                      children: 'XLSX ANN-FT-01',
                    }),
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        await downloadXlsx('/furnace/export', { report: 'N2-GAS-FT-01', id: selectedId });
                      },
                      children: 'XLSX N2-GAS',
                    }),
                    /*#__PURE__*/ _jsx(ZButton, {
                      onClick: async () => {
                        await downloadXlsx('/furnace/export', { report: 'EXO-GAS-FT-02', id: selectedId });
                      },
                      children: 'XLSX EXO-GAS',
                    }),
                  ],
                })
              : null,
          ],
        }),

        (msg || err || warn) &&
          /*#__PURE__*/ _jsx('div', {
            className: err ? 'banner banner--error' : warn && !msg ? 'banner banner--warn' : 'banner',
            children: err || warn || msg,
          }),

        /*#__PURE__*/ _jsxs('div', {
          className: 'process-capture__grid',
          children: [
            /*#__PURE__*/ _jsxs('aside', {
              className: 'process-capture__list',
              children: [
                /*#__PURE__*/ _jsxs('div', {
                  className: 'filter-row',
                  children: [
                    /*#__PURE__*/ _jsx(ZInput, {
                      placeholder: 'WO filter',
                      value: filterWo,
                      onChange: (e) => setFilterWo(e.target.value),
                    }),
                    /*#__PURE__*/ _jsxs(ZSelect, {
                      value: filterStatus,
                      onChange: (e) => setFilterStatus(e.target.value),
                      children: [
                        /*#__PURE__*/ _jsx('option', { value: '', children: 'All status' }),
                        /*#__PURE__*/ _jsx('option', { value: 'DRAFT', children: 'DRAFT' }),
                        /*#__PURE__*/ _jsx('option', { value: 'SUBMITTED', children: 'SUBMITTED' }),
                        /*#__PURE__*/ _jsx('option', { value: 'APPROVED', children: 'APPROVED' }),
                        /*#__PURE__*/ _jsx('option', { value: 'HOLD', children: 'HOLD' }),
                      ],
                    }),
                  ],
                }),
                /*#__PURE__*/ _jsx('ul', {
                  children: lots.map((l) => {
                    const sizeLabel = formatHistSize(l.size);
                    return /*#__PURE__*/ _jsx(
                      'li',
                      {
                        children: /*#__PURE__*/ _jsxs('button', {
                          type: 'button',
                          className: selectedId === l.id ? 'list-item active' : 'list-item',
                          onClick: () => setSelectedId(l.id),
                          children: [
                            /*#__PURE__*/ _jsx('strong', {
                              children: String(l.workOrderNo || l.chargeNo || '—'),
                            }),
                            /*#__PURE__*/ _jsx('span', {
                              children: [l.customerCode, l.gradeCode, sizeLabel !== '—' ? sizeLabel : null, l.htType]
                                .filter(Boolean)
                                .join(' · '),
                            }),
                            /*#__PURE__*/ _jsx('span', {
                              className: 'muted font-mono',
                              style: { fontSize: '0.75rem' },
                              children: String(l.chargeNo ?? ''),
                            }),
                            /*#__PURE__*/ _jsx(ZBadge, {
                              tone: statusTone(String(l.status)),
                              children: String(l.status),
                            }),
                          ],
                        }),
                      },
                      l.id
                    );
                  }),
                }),
              ],
            }),

            /*#__PURE__*/ _jsxs('section', {
              className: 'process-capture__form',
              children: [
                /*#__PURE__*/ _jsxs('div', {
                  className: 'meta-grid',
                  style: { marginBottom: '0.75rem' },
                  children: [
                    /*#__PURE__*/ _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        /*#__PURE__*/ _jsx('label', { children: 'Date (SYSTEM)' }),
                        /*#__PURE__*/ _jsx('div', { className: 'value font-mono', children: form.prodDate }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        /*#__PURE__*/ _jsx('label', { children: 'Shift (SYSTEM)' }),
                        /*#__PURE__*/ _jsx('div', { className: 'value font-mono', children: form.shiftRef }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        /*#__PURE__*/ _jsx('label', { children: 'Production Run' }),
                        /*#__PURE__*/ _jsx('div', { className: 'value font-mono', children: form.chargeNo }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        /*#__PURE__*/ _jsx('label', { children: 'Furnace' }),
                        /*#__PURE__*/ _jsx('div', { className: 'value font-mono', children: form.furnaceCode }),
                      ],
                    }),
                  ],
                }),

                /*#__PURE__*/ _jsx('h2', { children: 'Running order (DERIVED)' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'form-grid',
                  children: [
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'WO',
                        orderLocked
                          ? /*#__PURE__*/ _jsx('div', {
                              className: 'value font-mono',
                              style: { paddingTop: '0.45rem' },
                              children: form.workOrderNo || '—',
                            })
                          : /*#__PURE__*/ _jsx(ErpWoSelect, {
                              value: form.workOrderNo,
                              onChange: (wo, order) => {
                                setField('workOrderNo', wo);
                                if (order?.customerCode) setField('customerCode', order.customerCode);
                                if (order?.gradeCode) setField('gradeCode', order.gradeCode);
                                const size = order?.size;
                                if (size?.odMm != null) setField('sizeOd', String(size.odMm));
                                if (size?.thkMm != null) setField('sizeThk', String(size.thkMm));
                                if (size?.lengthMm != null) setField('sizeLen', String(size.lengthMm));
                                if (wo) setOrderLocked(true);
                              },
                            }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Customer',
                        /*#__PURE__*/ _jsx('div', {
                          className: 'value',
                          style: { paddingTop: '0.45rem' },
                          children: form.customerCode || '—',
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Grade',
                        /*#__PURE__*/ _jsx('div', {
                          className: 'value',
                          style: { paddingTop: '0.45rem' },
                          children: form.gradeCode || '—',
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'OD × THK × Length',
                        /*#__PURE__*/ _jsx('div', {
                          className: 'value font-mono',
                          style: { paddingTop: '0.45rem' },
                          children:
                            form.sizeOd || form.sizeThk || form.sizeLen
                              ? `${form.sizeOd || '—'} × ${form.sizeThk || '—'} × ${form.sizeLen || '—'}`
                              : '—',
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Heat treatment',
                        htLocked || orderLocked
                          ? /*#__PURE__*/ _jsx('div', {
                              className: 'value',
                              style: { paddingTop: '0.45rem' },
                              children: form.htType || '—',
                            })
                          : /*#__PURE__*/ _jsxs(ZSelect, {
                              value: form.htType || '',
                              onChange: (e) => {
                                setField('htType', e.target.value);
                                if (e.target.value) setHtLocked(true);
                              },
                              children: [
                                /*#__PURE__*/ _jsx('option', { value: '', children: 'Confirm HT…' }),
                                /*#__PURE__*/ _jsx('option', { value: 'ANNEAL', children: 'ANNEAL' }),
                                /*#__PURE__*/ _jsx('option', { value: 'NORMALIZE', children: 'NORMALIZE' }),
                                /*#__PURE__*/ _jsx('option', { value: 'SRA', children: 'SRA' }),
                              ],
                            }),
                      ],
                    }),
                  ],
                }),

                /*#__PURE__*/ _jsx('h2', { children: 'Production' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'form-grid',
                  children: [
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'No. of Tubes (MANUAL)',
                        /*#__PURE__*/ _jsx(ZInput, {
                          value: form.tubeCount,
                          inputMode: 'numeric',
                          onChange: (e) => setField('tubeCount', e.target.value),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Total Nos (DERIVED)',
                        /*#__PURE__*/ _jsx('div', {
                          className: 'value font-mono',
                          style: { paddingTop: '0.45rem' },
                          children: form.tubeCount || '—',
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Total MT (DERIVED)',
                        /*#__PURE__*/ _jsx('div', {
                          className: 'value font-mono',
                          style: { paddingTop: '0.45rem' },
                          children: (() => {
                            const mt = deriveTotalMtPreview(
                              form.sizeOd,
                              form.sizeThk,
                              form.sizeLen,
                              form.tubeCount
                            );
                            return mt != null ? String(mt) : 'Waiting for size + tubes';
                          })(),
                        }),
                      ],
                    }),
                  ],
                }),

                /*#__PURE__*/ _jsxs('div', {
                  className: 'section-head',
                  children: [
                    /*#__PURE__*/ _jsx('h2', { children: 'Temperature °C — Zone MIN / MAX' }),
                    /*#__PURE__*/ _jsx('span', { className: 'muted', children: 'Source: Manual' }),
                  ],
                }),
                /*#__PURE__*/ _jsx('div', {
                  className: 'zone-grid',
                  children: ZONES.map((z) => {
                    const minVal = form[`zone${z}MinC`];
                    const maxVal = form[`zone${z}MaxC`];
                    const out = zoneOutsideSoakRecipe(minVal, maxVal, soakSpec);
                    return /*#__PURE__*/ _jsxs(
                      'div',
                      {
                        className: out ? 'zone-cell zone-cell--warn' : 'zone-cell',
                        children: [
                          /*#__PURE__*/ _jsxs('span', { children: ['Zone ', ZONE_ROMAN[z - 1]] }),
                          /*#__PURE__*/ _jsx(ZInput, {
                            placeholder: 'Min',
                            value: String(minVal ?? ''),
                            onChange: (e) => setField(`zone${z}MinC`, e.target.value),
                          }),
                          /*#__PURE__*/ _jsx(ZInput, {
                            placeholder: 'Max',
                            value: String(maxVal ?? ''),
                            onChange: (e) => setField(`zone${z}MaxC`, e.target.value),
                          }),
                          out
                            ? /*#__PURE__*/ _jsxs('small', {
                                className: 'zone-cell__warn',
                                children: [
                                  'Outside recipe tolerance · Target: ',
                                  String(soakSpec),
                                  ' ±',
                                  String(SOAK_TOLERANCE_C),
                                  ' °C',
                                ],
                              })
                            : null,
                        ],
                      },
                      z
                    );
                  }),
                }),

                /*#__PURE__*/ _jsxs('div', {
                  className: 'section-head',
                  children: [
                    /*#__PURE__*/ _jsx('h2', { children: 'Speed (m/hr)' }),
                    /*#__PURE__*/ _jsx('span', { className: 'muted', children: 'Source: Manual' }),
                  ],
                }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'form-grid',
                  children: [
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Running speed',
                        /*#__PURE__*/ _jsx(ZInput, {
                          value: form.lineSpeedMhr,
                          inputMode: 'decimal',
                          onChange: (e) => setField('lineSpeedMhr', e.target.value),
                        }),
                      ],
                    }),
                    recipe?.speedSpecMhr != null
                      ? /*#__PURE__*/ _jsxs('label', {
                          children: [
                            'Recipe speed',
                            /*#__PURE__*/ _jsx('div', {
                              className: 'value font-mono',
                              style: { paddingTop: '0.45rem' },
                              children: `${recipe.speedSpecMhr} ±2 m/hr`,
                            }),
                          ],
                        })
                      : null,
                  ],
                }),

                /*#__PURE__*/ _jsx('h2', { children: 'Disposition & batch gap' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'form-grid',
                  children: [
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Disposition',
                        /*#__PURE__*/ _jsxs(ZSelect, {
                          value: form.disposition,
                          onChange: (e) => setField('disposition', e.target.value),
                          children: [
                            /*#__PURE__*/ _jsx('option', { value: 'ACCEPT', children: 'ACCEPT' }),
                            /*#__PURE__*/ _jsx('option', { value: 'QUARANTINE', children: 'QUARANTINE' }),
                          ],
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('div', {
                      className: 'meta-grid__item span-2',
                      children: [
                        /*#__PURE__*/ _jsx('label', { children: 'Batch gap (derived)' }),
                        /*#__PURE__*/ _jsxs('div', {
                          className: 'fur-batch-gap',
                          children: [
                            /*#__PURE__*/ _jsx(ZBadge, {
                              tone:
                                batchGapView.batchSpacing.tone === 'ok'
                                  ? 'success'
                                  : batchGapView.batchSpacing.tone === 'warn'
                                    ? 'warn'
                                    : 'idle',
                              children: batchGapView.batchSpacing.label,
                            }),
                            /*#__PURE__*/ _jsx(ZBadge, {
                              tone:
                                batchGapView.lotGapStatus.tone === 'ok'
                                  ? 'success'
                                  : batchGapView.lotGapStatus.tone === 'warn'
                                    ? 'warn'
                                    : 'idle',
                              children: batchGapView.lotGapStatus.label,
                            }),
                          ],
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      className: 'span-2',
                      children: [
                        'Remarks',
                        /*#__PURE__*/ _jsx(ZInput, {
                          value: form.remarks,
                          onChange: (e) => setField('remarks', e.target.value),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('div', {
                      className: 'process-capture__actions span-2',
                      children: [
                        /*#__PURE__*/ _jsx(ZButton, {
                          variant: 'ghost',
                          onClick: () => setNav('furnaces'),
                          children: 'Back',
                        }),
                        selectedId &&
                        (displayStatus === 'RUNNING' ||
                          displayStatus === 'STOPPAGE' ||
                          displayStatus === 'COMPLETE')
                          ? /*#__PURE__*/ _jsx(ZButton, {
                              variant: 'primary',
                              disabled: !isWritable,
                              onClick: async () => {
                                try {
                                  await furnaceApi.submit(selectedId);
                                  invalidateFurnaceQueries();
                                  setMsg('Submitted');
                                  setErr('');
                                } catch (e) {
                                  setErr(e instanceof Error ? e.message : 'Submit failed');
                                }
                              },
                              children: 'Submit',
                            })
                          : /*#__PURE__*/ _jsx(ZButton, {
                              variant: 'primary',
                              disabled: true,
                              children: 'Submit',
                            }),
                      ],
                    })
                  ],
                }),
              ],
            }),
          ],
        }),
        /*#__PURE__*/ _jsx(StoppageDialog, {
          open: stoppageDialogOpen,
          busy: stoppageBusy,
          mode: openStoppage ? 'manage' : 'open',
          stoppageCodes,
          stoppages: lotStoppages,
          openStoppage: openStoppage,
          onCancel: () => setStoppageDialogOpen(false),
          onConfirm: (body) => void handleStoppageConfirm(body),
        }),
      ],
      }),
      /*#__PURE__*/ _jsx(FurnaceConsumptionModal, {
        open: consOpen,
        busy: consBusy,
        machines,
        defaultFurnaceCode: consFurnaceEffective,
        defaultProdDate: consDateEffective,
        shiftRef: form.shiftRef || currentShiftRef(),
        contextChargeNo: consBoardRow?.chargeNo || form.chargeNo || '',
        contextWorkOrderNo:
          consBoardRow?.runningOrder?.workOrderNo || form.workOrderNo || '',
        initial: dailyConsumption,
        onFurnaceChange: setConsFurnace,
        onDateChange: setConsDate,
        onClose: () => setConsOpen(false),
        onSave: handleConsumptionSave,
      }),
    ],
  });
}
