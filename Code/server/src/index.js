import { config, assertCollectorModeSupported, assertProductionSecrets, assertBcAdapterSupported } from './config';
import { createApp } from './app';
import { registerCollectorConsumers } from './services/CollectorIngestService';
import { startCollectorLoop, stopCollectorLoop } from './collector/CollectorRunner';
import { startShiftBoundaryScheduler, stopShiftBoundaryScheduler } from './jobs/ShiftBoundaryScheduler';
import { closePool } from './db/pool';
import { logger, writeEventLog } from './lib/logger';

try {
  assertProductionSecrets();
  assertCollectorModeSupported();
  assertBcAdapterSupported();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
}

registerCollectorConsumers();
startCollectorLoop();
startShiftBoundaryScheduler();

const app = createApp({ serveClient: true });

const listenArgs = config.host
  ? [config.port, config.host]
  : [config.port];

const server = app.listen(...listenArgs, () => {
  const where = config.host ? `${config.host}:${config.port}` : `*:${config.port}`;
  logger.info({ bind: where, authMode: config.authMode, collector: config.collectorMode }, 'API listening');
  writeEventLog('Information', 1000, `Zedral backend started on ${where}`);
});

server.on('error', (err) => {
  logger.error({ err }, 'listen failed');
  writeEventLog('Error', 1001, `Listen failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown started');
  writeEventLog('Information', 1002, `Shutdown started (${signal})`);

  stopCollectorLoop();
  stopShiftBoundaryScheduler();

  const forceTimer = setTimeout(() => {
    logger.error('graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 15_000);
  forceTimer.unref?.();

  server.close(async (closeErr) => {
    if (closeErr) {
      logger.error({ err: closeErr }, 'HTTP server close error');
    }
    try {
      await closePool();
    } catch (err) {
      logger.error({ err }, 'pool close error');
    }
    clearTimeout(forceTimer);
    writeEventLog('Information', 1003, 'Zedral backend stopped');
    process.exit(closeErr ? 1 : 0);
  });
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
