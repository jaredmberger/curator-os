import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet as getHardwareStatus } from '../functions/api/hardware-status.js';
import { onRequestGet as getVersionedStatus } from '../functions/api/device/v1/status.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

test('physical-device contract exposes stable v1 status fields', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('site-health')) return json({ snapshot: { problemPageCount: 0, checkedPageCount: 10, discoveredPageCount: 10, coveragePct: 100, generatedAt: '2026-09-28T07:00:00.000Z' } });
    if (url.includes('errors.oceanliners.net')) return json({ activeIncidentCount: 1, counts: { p0: 0, p1: 1, p2: 0 }, publicSiteAvailability: { status: 'online' }, generatedAt: '2026-09-28T07:00:00.000Z' });
    if (url.includes('speed.oceanliners.net')) return json({ system: { status: 'good' }, metrics: {} });
    if (url.includes('integrity.oceanliners.net')) return json({ system: { status: 'good' }, metrics: {} });
    throw new Error('Unexpected fetch: ' + url);
  };

  const env = {
    CURATOR_OPS: {
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/api/operational-state') {
          return json({ ok: true, snapshot: { status: 'attention', generatedAt: '2026-09-28T07:00:00.000Z' } });
        }
        if (url.pathname === '/api/devices') {
          return json({ ok: true, snapshot: { generatedAt: '2026-09-28T07:00:00.000Z', summary: { total: 4, online: 3, quiet: 1, stale: 0, unknown: 0 } } });
        }
        return json({ ok: false }, 404);
      },
    },
  };

  try {
    const response = await getHardwareStatus({ env });
    const payload = await response.json();

    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.contractVersion, 1);
    assert.equal(payload.system.state, 'attention');
    assert.equal(payload.system.publicSite, 'online');
    assert.equal(payload.system.activeIncidentCount, 1);
    assert.equal(payload.system.highestIncidentSeverity, 'p1');
    assert.deepEqual(payload.devices, {
      total: 4,
      online: 3,
      quiet: 1,
      stale: 0,
      unknown: 0,
      available: true,
      generatedAt: '2026-09-28T07:00:00.000Z',
    });
    assert.equal(payload.polling.recommendedSeconds, 60);
    assert.equal(payload.polling.minimumSeconds, 30);
    assert.equal(payload.heartbeat.endpoint, 'https://ops.oceanlinercurator.com/api/device/v1/heartbeat');
    assert.equal(payload.heartbeat.method, 'POST');
    assert.equal(payload.heartbeat.authHeader, 'x-curator-ops-key');

    const aliasResponse = await getVersionedStatus({ env });
    const aliasPayload = await aliasResponse.json();
    assert.equal(aliasPayload.contractVersion, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
