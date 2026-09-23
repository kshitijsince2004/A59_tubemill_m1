import serverless from 'serverless-http';
import {
  assertBcAdapterSupported,
  assertCollectorModeSupported,
  assertProductionSecrets,
  config,
} from '../../server/src/config';
import { createApp } from '../../server/src/app';
import { registerCollectorConsumers } from '../../server/src/services/CollectorIngestService';

try {
  assertProductionSecrets();
  assertCollectorModeSupported();
  assertBcAdapterSupported();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  throw err;
}

registerCollectorConsumers();
// No startCollectorLoop — serverless cannot hold setInterval between invocations.
// Simulated PLC ticks run on demand from GET /tubemill/runs/:id/live.

const app = createApp({ serveClient: false });

console.log(
  `A-59 Tubemill Netlify function ready (auth=${config.authMode}, collector=${config.collectorMode})`,
);

export const handler = serverless(app);
