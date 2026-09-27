// Read-only, fixed-route bridge. Configure CURATOR_OPS as a service binding to ops.
// Never forward caller URLs, headers, cookies, request bodies, or write methods.
const CHECKS = {
  journey: '/api/public-site-journey',
  'browser-search': '/api/browser-search-journey',
  'self-test': '/api/self-test',
};
const STATES = new Set(['healthy', 'warming', 'observing', 'degraded', 'persistent', 'attention', 'unknown']);
const MAX_AGE_MS = 20 * 60 * 1000; // Matches Ops operational-state freshness policy.
const TIMEOUT_MS = 5000;

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { allow: 'GET', 'cache-control': 'no-store' } });
  const configured = typeof env?.CURATOR_OPS?.fetch === 'function';
  const checks = Object.fromEntries(await Promise.all(Object.entries(CHECKS).map(async ([id, path]) => [
    id, configured ? await readCheck(env.CURATOR_OPS, path) : unavailable('not_configured'),
  ])));
  return new Response(JSON.stringify({
    schemaVersion: 1,
    available: Object.values(checks).every(check => check.available),
    generatedAt: new Date().toISOString(),
    checks,
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  });
}

function unavailable(reason) {
  return { available: false, state: 'unknown', reason, checkedAt: null, stale: false };
}

async function readCheck(service, path) {
  const controller = new AbortController();
  let timer;
  try {
    // Race the entire read (including JSON parsing); a hung service cannot hold
    // the other two results indefinitely, even if it ignores abort signals.
    return await Promise.race([
      (async () => {
        const response = await service.fetch(new Request(`https://ops.oceanlinercurator.com${path}`, {
          method: 'GET', headers: { accept: 'application/json' },
          redirect: 'manual', signal: controller.signal,
        }));
        if (response.status >= 300 && response.status < 400 || response.status === 401 || response.status === 403) {
          return unavailable('access_required');
        }
        if (!response.ok) return unavailable('upstream_error');
        if (!(response.headers.get('content-type') || '').includes('application/json')) return unavailable('invalid_response');
        const payload = await response.json();
        const snapshot = payload?.snapshot;
        if (payload?.ok !== true || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return unavailable('invalid_response');
        const rawState = String(snapshot.effectiveState || snapshot.summary?.status || 'unknown').toLowerCase();
        const state = STATES.has(rawState) ? rawState : 'unknown';
        const checkedMs = typeof snapshot.generatedAt === 'string' ? Date.parse(snapshot.generatedAt) : NaN;
        const validTime = Number.isFinite(checkedMs) && checkedMs <= Date.now() + 60000;
        const stale = validTime && Date.now() - checkedMs > MAX_AGE_MS;
        return {
          available: true,
          state: validTime ? state : state === 'warming' ? 'warming' : 'unknown',
          reason: stale ? 'stale' : !validTime ? 'awaiting_check' : null,
          checkedAt: validTime ? new Date(checkedMs).toISOString() : null,
          stale,
        };
      })(),
      new Promise(resolve => {
        timer = setTimeout(() => { resolve(unavailable('timeout')); controller.abort(); }, TIMEOUT_MS);
      }),
    ]);
  } catch {
    return unavailable('upstream_error');
  } finally {
    clearTimeout(timer);
  }
}
