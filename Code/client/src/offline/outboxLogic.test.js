import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONTINUE_AFTER_ITEM_FAILURE,
  MAX_OUTBOX_ATTEMPTS,
  backoffElapsed,
  isOutboxSuccessStatus,
  outboxBackoffMs,
} from './outboxLogic.js';

describe('outboxLogic (audit F12)', () => {
  it('treats 2xx and 409 as success', () => {
    assert.equal(isOutboxSuccessStatus(200), true);
    assert.equal(isOutboxSuccessStatus(201), true);
    assert.equal(isOutboxSuccessStatus(409), true);
    assert.equal(isOutboxSuccessStatus(400), false);
    assert.equal(isOutboxSuccessStatus(500), false);
  });

  it('continues past item failures', () => {
    assert.equal(CONTINUE_AFTER_ITEM_FAILURE, true);
  });

  it('caps attempts and backoff', () => {
    assert.equal(MAX_OUTBOX_ATTEMPTS, 8);
    assert.equal(outboxBackoffMs(1), 2000);
    assert.equal(outboxBackoffMs(2), 4000);
    assert.equal(outboxBackoffMs(10), 60_000);
  });

  it('honours backoffElapsed', () => {
    const now = Date.parse('2026-01-01T00:01:00Z');
    assert.equal(backoffElapsed({ attempts: 0 }, now), true);
    assert.equal(
      backoffElapsed(
        { attempts: 1, lastAttemptAt: '2026-01-01T00:00:59Z' },
        now,
        2000,
        60_000
      ),
      false
    );
    assert.equal(
      backoffElapsed(
        { attempts: 1, lastAttemptAt: '2026-01-01T00:00:00Z' },
        now,
        2000,
        60_000
      ),
      true
    );
  });
});
