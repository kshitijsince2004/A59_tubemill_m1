import { config, assertCollectorModeSupported, assertProductionSecrets, assertBcAdapterSupported } from './config';
import { createApp } from './app';
import { registerCollectorConsumers } from './services/CollectorIngestService';
import { startCollectorLoop } from './collector/CollectorRunner';
import { startShiftBoundaryScheduler } from './jobs/ShiftBoundaryScheduler';

try {
  assertProductionSecrets();
  assertCollectorModeSupported();
  assertBcAdapterSupported();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

registerCollectorConsumers();
startCollectorLoop();
startShiftBoundaryScheduler();

const app = createApp({ serveClient: true });

const server = app.listen(config.port, () => {
  console.log(`A-59 Tubemill API listening on http://localhost:${config.port}`);
  console.log(`Auth mode: ${config.authMode}; Collector: ${config.collectorMode}`);
});

server.on('error', (err) => {
  console.error('[server] listen failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});