import type { PlcDriver, PlcPollReading } from './types';

/** Fail-closed placeholder until a plant OPC-UA/Modbus driver is wired. */
export class UnsupportedPlcDriver implements PlcDriver {
  millCode = 'A-59';

  constructor(private mode: string) {}

  start(): void {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  stop(): void {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  poll(): PlcPollReading[] {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  setForceOutOfBand(): void {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  getLiveSnapshot() {
    return null;
  }
}
