import { queryOne } from '../db/pool';
import { config } from '../config';









































export async function resolveRunDefaults(
sizeKey,
thkMm,
gradeCode)
{
  const chart = await queryOne(
    `SELECT * FROM master.tm_param_chart
     WHERE tenant_id = $1 AND size_key = $2 AND thk_mm = $3 AND grade_code = $4 AND is_active = true
     ORDER BY version DESC LIMIT 1`,
    [config.tenantId, sizeKey, thkMm, gradeCode]
  );

  if (!chart) return null;

  return {
    tooling: {
      idTool: chart.id_tool,
      odTool: chart.od_tool,
      boggieSize: chart.boggie,
      impederSize: chart.impeder,
      ferriteRod: chart.ferrite_rod,
      ssRod: chart.ss_rod,
      workCoilId: chart.work_coil_id,
      seamGuide: chart.seam_guide,
      weldDiaMm: chart.weld_dia_mm ? Number(chart.weld_dia_mm) : null
    },
    band: {
      powerKwMin: Number(chart.power_kw_min),
      powerKwMax: Number(chart.power_kw_max),
      speedMinMpm: Number(chart.speed_min_mpm),
      speedMaxMpm: Number(chart.speed_max_mpm)
    }
  };
}

export function checkInBand(
powerKw,
band,
speedMpm)
{
  const powerOk = powerKw >= band.powerKwMin && powerKw <= band.powerKwMax;
  if (speedMpm === undefined || Number.isNaN(speedMpm)) return powerOk;
  const speedOk = speedMpm >= band.speedMinMpm && speedMpm <= band.speedMaxMpm;
  return powerOk && speedOk;
}

export function bandViolationReason(
powerKw,
speedMpm,
band)
{
  const parts = [];
  if (powerKw < band.powerKwMin || powerKw > band.powerKwMax) {
    parts.push(`power ${powerKw} outside ${band.powerKwMin}-${band.powerKwMax} kW`);
  }
  if (speedMpm < band.speedMinMpm || speedMpm > band.speedMaxMpm) {
    parts.push(`speed ${speedMpm} outside ${band.speedMinMpm}-${band.speedMaxMpm} mpm`);
  }
  return parts.join('; ') || 'out of band';
}

/** Strict theoretical tube weight (kg). Returns null if OD/THK/Length missing — never invents dims. */
export function strictTheoreticalTubeWeightKg(size, pieces, densityKgM3 = 7850) {
  if (pieces == null || !Number.isFinite(pieces) || pieces < 0) return null;
  const odMm = size?.odMm ?? size?.equivOdMm;
  const thkMm = size?.thkMm;
  const lengthMm = size?.lengthMm;
  if (odMm == null || thkMm == null || lengthMm == null) return null;
  if (!(odMm > 0) || !(thkMm > 0) || !(lengthMm > 0)) return null;

  const od = odMm / 1000;
  const thk = thkMm / 1000;
  const length = lengthMm / 1000;
  const id = Math.max(od - 2 * thk, 0.001);
  const area = Math.PI / 4 * (od * od - id * id);
  const weightPerPiece = area * length * densityKgM3;
  return Math.round(weightPerPiece * pieces * 100) / 100;
}

/** Simple theoretical tube weight (kg) — round tube approximation (legacy defaults). */
export function theoreticalTubeWeightKg(
size,
pieces,
densityKgM3 = 7850)
{
  const od = (size.odMm ?? size.equivOdMm ?? 25) / 1000;
  const thk = (size.thkMm ?? 2) / 1000;
  const length = (size.lengthMm ?? 6000) / 1000;
  const id = Math.max(od - 2 * thk, 0.001);
  const area = Math.PI / 4 * (od * od - id * id);
  const weightPerPiece = area * length * densityKgM3;
  return Math.round(weightPerPiece * pieces * 100) / 100;
}