

/** Fail-closed placeholder until a plant OPC-UA/Modbus driver is wired. */
export class UnsupportedPlcDriver {
  millCode = 'A-59';

  constructor(mode) {this.mode = mode;}

  start() {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  stop() {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  poll() {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  setForceOutOfBand() {
    throw new Error(`COLLECTOR_MODE=${this.mode} is not implemented. Use sim.`);
  }
  getLiveSnapshot() {
    return null;
  }
}