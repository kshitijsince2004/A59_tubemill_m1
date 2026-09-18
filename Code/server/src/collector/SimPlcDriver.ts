import type { PlcDriver, PlcPollReading } from './types';

interface SimState {
  runId: string;
  speedMpm: number;
  powerKw: number;
  currentAmp: number;
  pieceCount: number;
  forceOutOfBand: boolean;
  lineRunning: boolean;
  stoppageCycle: number;
  pendingPieces: number;
  lastCutEmitted: number;
  band: { powerKwMin: number; powerKwMax: number; speedMinMpm: number; speedMaxMpm: number } | null;
}

export class SimPlcDriver implements PlcDriver {
  millCode = 'A-59';
  private states = new Map<string, SimState>();

  start(runId: string): void {
    if (this.states.has(runId)) return;
    this.states.set(runId, {
      runId,
      speedMpm: 42,
      powerKw: 100,
      currentAmp: 850,
      pieceCount: 0,
      forceOutOfBand: false,
      lineRunning: true,
      stoppageCycle: 0,
      pendingPieces: 0,
      lastCutEmitted: 0,
      band: null,
    });
  }

  stop(runId: string): void {
    this.states.delete(runId);
  }

  setBand(
    runId: string,
    band: { powerKwMin: number; powerKwMax: number; speedMinMpm: number; speedMaxMpm: number },
  ): void {
    const s = this.states.get(runId);
    if (s) s.band = band;
  }

  setForceOutOfBand(runId: string, force: boolean): void {
    const s = this.states.get(runId);
    if (s) s.forceOutOfBand = force;
  }

  getLiveSnapshot(runId: string) {
    const s = this.states.get(runId);
    if (!s) return null;
    return {
      speedMpm: s.speedMpm,
      powerKw: s.powerKw,
      currentAmp: s.currentAmp,
      pieceCount: s.pieceCount,
      lineRunning: s.lineRunning,
      forceOutOfBand: s.forceOutOfBand,
    };
  }

  poll(runId: string): PlcPollReading[] {
    const s = this.states.get(runId);
    if (!s) return [];

    s.stoppageCycle += 1;
    const at = new Date().toISOString();

    // Periodic line stop every ~30 polls
    if (s.stoppageCycle % 30 === 0 && s.lineRunning) {
      s.lineRunning = false;
    }
    if (s.stoppageCycle % 30 === 5 && !s.lineRunning) {
      s.lineRunning = true;
    }

    if (s.lineRunning && s.band) {
      const midSpeed = (s.band.speedMinMpm + s.band.speedMaxMpm) / 2;
      const midPower = (s.band.powerKwMin + s.band.powerKwMax) / 2;
      s.speedMpm = midSpeed + Math.sin(Date.now() / 3000) * 5;
      s.powerKw = s.forceOutOfBand
        ? s.band.powerKwMax + 15
        : midPower + Math.sin(Date.now() / 4000) * 8;
      s.currentAmp = s.powerKw * 8.5;
      s.pendingPieces += 1;
      if (s.pendingPieces >= 3) {
        s.pieceCount += s.pendingPieces;
        s.pendingPieces = 0;
      }
    }

    return [
      { signal: 'LINE_SPEED', value: s.speedMpm, unit: 'mpm', at },
      { signal: 'WELD_POWER', value: s.powerKw, unit: 'kW', at },
      { signal: 'WELD_CURRENT', value: s.currentAmp, unit: 'A', at },
      { signal: 'RUN_STATE', value: s.lineRunning ? 1 : 0, unit: 'bool', at },
      { signal: 'CUT_COUNT', value: s.pieceCount, unit: 'pcs', at },
      { signal: 'COOLANT_PRESSURE', value: 2.4, unit: 'kg', at },
    ];
  }
}

export const simDriver = new SimPlcDriver();
