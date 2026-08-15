const ERROR_RECHECK_URL = 'https://errors.oceanliners.net/api/recheck-active';
const ERROR_STATUS_URL = 'https://errors.oceanliners.net/api/status';
const TIMEOUT_MS = 25000;

export async function onRequestPost() {
  const startedAt = Date.now();

  const recheck = await fetchJson(ERROR_RECHECK_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'CuratorOS-Hardware-Error-Recheck/1.0 (+https://curator.oceanliners.net/)'
    },
    body: '{}'
  });

  if (!recheck.ok) {
    return json({
      ok: false,
      service: 'CuratorOS Hardware Error Recheck',
      error: recheck.error || 'Error Bus recheck failed.',
      httpStatus: recheck.httpStatus ?? null,
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    }, 502);
  }

  const status = await fetchJson(ERROR_STATUS_URL, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'user-agent': 'CuratorOS-Hardware-Error-Recheck/1.0 (+https://curator.oceanliners.net/)'
    }
  });

  const statusData = status.ok ? status.data : null;

  return json({
    ok: true,
    service: 'CuratorOS Hardware Error Recheck',
    recheck: recheck.data,
    errors: {
      status: statusData?.status || null,
      activeIncidentCount: Number(statusData?.activeIncidentCount || 0),
      counts: statusData?.counts || null,
      publicSiteAvailability: statusData?.publicSiteAvailability || null,
      generatedAt: statusData?.generatedAt || null
    },
    responseTimeMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString()
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        httpStatus: response.status,
        error: 'Upstream returned non-JSON content.'
      };
    }

    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        httpStatus: response.status,
        error: data?.error || `Upstream returned HTTP ${response.status}.`,
        data
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      error: error?.name === 'AbortError' ? `Upstream timed out after ${TIMEOUT_MS} ms.` : (error instanceof Error ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow, noarchive'
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}
