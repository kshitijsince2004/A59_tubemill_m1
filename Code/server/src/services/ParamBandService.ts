import { queryOne } from '../db/pool';
import { config } from '../config';

export interface ParamChartRow {
  id: string;
  size_key: string;
  thk_mm: string;
  grade_code: string;
  power_kw_min: string;
  power_kw_max: string;
  speed_min_mpm: string;
  speed_max_mpm: string;
  id_tool: string | null;
  od_tool: string | null;
  boggie: string | null;
  impeder: string | null;
  ferrite_rod: string | null;
  ss_rod: string | null;
  work_coil_id: string | null;
  seam_guide: string | null;
  weld_dia_mm: string | null;
}

export interface RunDefaults {
  tooling: {
    idTool: string | null;
    odTool: string | null;
    boggieSize: string | null;
    impederSize: string | null;
    ferriteRod: string | null;
    ssRod: string | null;
    workCoilId: string | null;
    seamGuide: string | null;
    weldDiaMm: number | null;
  };
  band: {
    powerKwMin: number;
    powerKwMax: number;
    speedMinMpm: number;
    speedMaxMpm: number;
  };
}

export async function resolveRunDefaults(
  sizeKey: string,
  thkMm: number,
  gradeCode: string,
): Promise<RunDefaults | null> {
  const chart = await queryOne<ParamChartRow>(
    `SELECT * FROM master.tm_param_chart
     WHERE tenant_id = $1 AND size_key = $2 AND thk_mm = $3 AND grade_code = $4 AND is_active = true
     ORDER BY version DESC LIMIT 1`,
    [config.tenantId, sizeKey, thkMm, gradeCode],
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
      weldDiaMm: chart.weld_dia_mm ? Number(chart.weld_dia_mm) : null,
    },
    band: {
      powerKwMin: Number(chart.power_kw_min),
      powerKwMax: Number(chart.power_kw_max),
      speedMinMpm: Number(chart.speed_min_mpm),
      speedMaxMpm: Number(chart.speed_max_mpm),
    },
  };
}

export function checkInBand(
  powerKw: number,
  band: RunDefaults['band'],
  speedMpm?: number,
): boolean {
  const powerOk = powerKw >= band.powerKwMin && powerKw <= band.powerKwMax;
  if (speedMpm === undefined || Number.isNaN(speedMpm)) return powerOk;
  const speedOk = speedMpm >= band.speedMinMpm && speedMpm <= band.speedMaxMpm;
  return powerOk && speedOk;
}

export function bandViolationReason(
  powerKw: number,
  speedMpm: number,
  band: RunDefaults['band'],
): string {
  const parts: string[] = [];
  if (powerKw < band.powerKwMin || powerKw > band.powerKwMax) {
    parts.push(`power ${powerKw} outside ${band.powerKwMin}-${band.powerKwMax} kW`);
  }
  if (speedMpm < band.speedMinMpm || speedMpm > band.speedMaxMpm) {
    parts.push(`speed ${speedMpm} outside ${band.speedMinMpm}-${band.speedMaxMpm} mpm`);
  }
  return parts.join('; ') || 'out of band';
}

/** Simple theoretical tube weight (kg) — round tube approximation */
export function theoreticalTubeWeightKg(
  size: { profile: string; odMm?: number; equivOdMm?: number; thkMm?: number; lengthMm?: number },
  pieces: number,
  densityKgM3 = 7850,
): number {
  const od = (size.odMm ?? size.equivOdMm ?? 25) / 1000;
  const thk = (size.thkMm ?? 2) / 1000;
  const length = (size.lengthMm ?? 6000) / 1000;
  const id = Math.max(od - 2 * thk, 0.001);
  const area = (Math.PI / 4) * (od * od - id * id);
  const weightPerPiece = area * length * densityKgM3;
  return Math.round(weightPerPiece * pieces * 100) / 100;
}
