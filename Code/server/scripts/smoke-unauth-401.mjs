#!/usr/bin/env node
/**
 * CI smoke: unauthenticated GET /api/tubemill/session should return 401 when
 * AUTH_ALLOW_HEADER_ROLE is false (production posture).
 *
 * If SERVER_URL is unset, exits 0 with a skip message (no DB / server required).
 */
const base = (process.env.SERVER_URL || '').replace(/\/$/, '');

if (!base) {
  console.log('smoke:unauth skipped — set SERVER_URL to run (e.g. http://localhost:3001)');
  process.exit(0);
}

const url = `${base}/api/tubemill/session`;

try {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 401) {
    console.log(`smoke:unauth OK — ${url} → 401`);
    process.exit(0);
  }

  // Dev servers may allow header-role probes; accept only when the body says so.
  if (res.status === 200) {
    const json = await res.json().catch(() => null);
    const allow = json?.data?.allowHeaderRole === true;
    if (allow) {
      console.log(
        `smoke:unauth skipped — ${url} → 200 with allowHeaderRole=true (dev escape hatch)`
      );
      process.exit(0);
    }
  }

  console.error(`smoke:unauth FAILED — ${url} → ${res.status} (expected 401)`);
  process.exit(1);
} catch (err) {
  console.error(`smoke:unauth FAILED — ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
