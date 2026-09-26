import serverless from 'serverless-http';
import {
  assertBcAdapterSupported,
  assertCollectorModeSupported,
  assertProductionSecrets,
  config,
} from '../../server/src/config';
import { createApp } from '../../server/src/app';
import { registerCollectorConsumers } from '../../server/src/services/CollectorIngestService';

/**
 * Never throw at module load — a top-level throw becomes a permanent 502 for every
 * /api/* request. Validate config, then export a working handler (or a 503 JSON body).
 */
function buildHandler() {
  try {
    assertProductionSecrets();
    assertCollectorModeSupported();
    assertBcAdapterSupported();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[netlify/api] boot config error:', message);
    return async () => ({
      statusCode: 503,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: null,
        errors: [{ message, code: 'BOOT_CONFIG' }],
      }),
    });
  }

  try {
    registerCollectorConsumers();
    const app = createApp({ serveClient: false });
    console.log(
      `A-59 Tubemill Netlify function ready (auth=${config.authMode}, st=${config.superTokensEnabled}, demoSessions=${config.demoSessionsEnabled}, collector=${config.collectorMode})`,
    );
    return serverless(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[netlify/api] createApp failed:', message);
    return async () => ({
      statusCode: 503,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: null,
        errors: [{ message, code: 'APP_INIT' }],
      }),
    });
  }
}

export const handler = buildHandler();
