import { config, assertCollectorModeSupported, assertProductionSecrets, assertBcAdapterSupported } from './config';
import { createApp } from './app';
import { registerCollectorConsumers } from './services/CollectorIngestService';
import { startCollectorLoop } from './collector/CollectorRunner';

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

const app = createApp({ serveClient: true });

app.listen(config.port, () => {
  console.log(`A-59 Tubemill API listening on http://localhost:${config.port}`);
  console.log(`Auth mode: ${config.authMode}; Collector: ${config.collectorMode}`);
});