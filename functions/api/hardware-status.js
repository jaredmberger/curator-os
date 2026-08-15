const SOURCES = {
  siteHealth: 'https://site-health.oceanliners.net/api/site-health-snapshot',
  errors: 'https://errors.oceanliners.net/api/status',
  speed: 'https://speed.oceanliners.net/api/curator-intelligence',
  integrity: 'https://integrity.oceanliners.net/api/curator-intelligence',
};

const FETCH_TIMEOUT_MS = 7000;

export async function onRequestGet() {
  const startedAt = Date.now();

  const [siteHealthRaw, errorsRaw, speedRaw, integrityRaw] = await Promise.all([
    getJson(SOURCES.siteHealth),
    getJson(SOURCES.errors),
    getJson(SOURCES.speed),
    getJson(SOURCES.integrity),
  ]);

  const siteHealth = summarizeSiteHealth(siteHealthRaw);
  const errors = summarizeErrors(errorsRaw);
  const speed = summarizeSpeed(speedRaw);
  const integrity = summarizeIntegrity(integrityRaw);

  const sourceStates = [siteHealth, errors, speed, integrity];
  const unavailable = sourceStates.filter(item => item.available === false).length;
  const attention = sourceStates.filter(item => item.status === 'attention').length;

  const payload = {
    ok: unavailable === 0,
    schemaVersion: 2,
    service: 'CuratorOS Hardware Status',
    generatedAt: new Date().toISOString(),
    responseTimeMs: Date.now() - startedAt,
    overall: {
      status: unavailable ? 'partial' : attention ? 'attention' : 'healthy',
      availableSources: sourceStates.length - unavailable,
      sourceCount: sourceStates.length,
      attentionCount: attention,
    },
    siteHealth,
    errors,
    speed,
    integrity,
  };

  return json(payload, 200);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'CuratorOS-Hardware-Status/2.0 (+https://curator.oceanliners.net/)',
      },
      signal: controller.signal,
    });

    const responseTimeMs = Date.now() - startedAt;
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return {
        available: false,
        httpStatus: response.status,
        responseTimeMs,
        error: 'Upstream returned non-JSON content.',
      };
    }

    if (!response.ok) {
      return {
        available: false,
        httpStatus: response.status,
        responseTimeMs,
        error: data?.error || `Upstream returned HTTP ${response.status}.`,
        data,
      };
    }

    return {
      available: true,
      httpStatus: response.status,
      responseTimeMs,
      data,
    };
  } catch (error) {
    return {
      available: false,
      httpStatus: null,
      responseTimeMs: Date.now() - startedAt,
      error: error?.name === 'AbortError'
        ? `Upstream timed out after ${FETCH_TIMEOUT_MS} ms.`
        : (error instanceof Error ? error.message : String(error)),
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarizeSiteHealth(raw) {
  if (!raw.available) return unavailableSummary('site-health', 'Site Health', raw);

  const snapshot = raw.data?.snapshot || null;
  if (!snapshot) {
    return {
      id: 'site-health', name: 'Site Health', available: true,
      status: 'unknown', statusLabel: 'Building baseline',
      problemPageCount: 0, checkedPageCount: 0, discoveredPageCount: 0,
      coveragePct: 0, updatedAt: raw.data?.generatedAt || null,
      upstreamResponseMs: raw.responseTimeMs,
    };
  }

  const problems = number(snapshot.problemPageCount);
  const checked = number(snapshot.checkedPageCount);
  const discovered = number(snapshot.discoveredPageCount);

  return {
    id: 'site-health', name: 'Site Health', available: true,
    status: problems > 0 ? 'attention' : 'healthy',
    statusLabel: problems > 0 ? 'Attention' : 'Healthy',
    problemPageCount: problems,
    checkedPageCount: checked,
    discoveredPageCount: discovered,
    coveragePct: number(snapshot.coveragePct),
    non200PageCount: number(snapshot.non200PageCount),
    canonicalIssuePageCount: number(snapshot.canonicalIssuePageCount),
    nonIndexablePageCount: number(snapshot.nonIndexablePageCount),
    updatedAt: snapshot.generatedAt || null,
    upstreamResponseMs: raw.responseTimeMs,
  };
}

function summarizeErrors(raw) {
  if (!raw.available) return unavailableSummary('errors', 'Errors', raw);

  const data = raw.data || {};
  const incidents = Array.isArray(data.incidents)
    ? data.incidents
    : Array.isArray(data.activeIncidents)
      ? data.activeIncidents
      : [];

  const count = firstFinite([
    data.activeIncidentCount,
    data.activeCount,
    data.incidentCount,
    data.counts?.active,
    data.summary?.active,
    incidents.length,
  ], 0);

  const p0 = firstFinite([data.p0, data.counts?.p0, data.summary?.p0], 0);
  const p1 = firstFinite([data.p1, data.counts?.p1, data.summary?.p1], 0);
  const p2 = firstFinite([data.p2, data.counts?.p2, data.summary?.p2], 0);

  return {
    id: 'errors', name: 'Errors', available: true,
    status: count > 0 ? 'attention' : 'healthy',
    statusLabel: count > 0 ? 'Active incidents' : 'Clear',
    count,
    severity: { p0, p1, p2 },
    updatedAt: data.generatedAt || data.updatedAt || data.checkedAt || null,
    upstreamResponseMs: raw.responseTimeMs,
  };
}

function summarizeSpeed(raw) {
  if (!raw.available) return unavailableSummary('speed', 'Speed', raw);

  const data = raw.data || {};
  const metrics = data.metrics || {};
  const snapshot = data.snapshot || null;

  const average = firstNullable([
    metrics.averageResponseTimeMs,
    snapshot?.averageResponseTimeMs,
  ]);

  const p90 = firstNullable([
    metrics.p90ResponseTimeMs,
    snapshot?.p90ResponseTimeMs,
  ]);

  const attention = firstFinite([
    metrics.attentionPageCount,
    snapshot?.attentionPageCount,
  ], 0);

  const errors = firstFinite([
    metrics.errorPageCount,
    snapshot?.errorPageCount,
  ], 0);

  const systemStatus = String(data.system?.status || '').toLowerCase();
  const status = systemStatus === 'warning' || attention > 0 || errors > 0 ? 'attention' : 'healthy';

  return {
    id: 'speed', name: 'Speed', available: true,
    status,
    statusLabel: status === 'attention' ? 'Attention' : 'Good',
    averageResponseTimeMs: average,
    p90ResponseTimeMs: p90,
    attentionPageCount: attention,
    errorPageCount: errors,
    auditedPageCount: firstFinite([metrics.auditedPageCount, snapshot?.auditedPageCount], 0),
    discoveredPageCount: firstFinite([metrics.discoveredPageCount, snapshot?.discoveredPageCount], 0),
    coveragePct: firstFinite([metrics.coveragePct, snapshot?.coveragePct], 0),
    updatedAt: data.generatedAt || snapshot?.generatedAt || null,
    upstreamResponseMs: raw.responseTimeMs,
  };
}

function summarizeIntegrity(raw) {
  if (!raw.available) return unavailableSummary('integrity', 'Integrity', raw);

  const data = raw.data || {};
  const metrics = data.metrics || {};
  const snapshot = data.siteSnapshot || data.snapshot || null;

  const problems = firstFinite([
    metrics.siteProblemPageCount,
    metrics.problemPageCount,
    snapshot?.problemPageCount,
  ], 0);

  const findings = firstFinite([
    metrics.siteFindingCount,
    metrics.findingCount,
    snapshot?.findingCount,
  ], 0);

  const critical = firstFinite([
    metrics.siteCriticalFindingCount,
    snapshot?.severityCounts?.critical,
  ], 0) + firstFinite([
    snapshot?.severityCounts?.error,
  ], 0);

  const systemStatus = String(data.system?.status || '').toLowerCase();
  const status = systemStatus === 'warning' || problems > 0 || critical > 0 ? 'attention' : 'healthy';

  return {
    id: 'integrity', name: 'Integrity', available: true,
    status,
    statusLabel: status === 'attention' ? 'Attention' : 'Pass',
    problemPageCount: problems,
    findingCount: findings,
    criticalErrorFindingCount: critical,
    warningFindingCount: firstFinite([
      metrics.siteWarningFindingCount,
      snapshot?.severityCounts?.warning,
    ], 0),
    auditedPageCount: firstFinite([
      metrics.siteAuditedPageCount,
      metrics.checkedPageCount,
      snapshot?.auditedPageCount,
    ], 0),
    inventoryCount: firstFinite([
      metrics.siteInventoryCount,
      snapshot?.inventoryCount,
    ], 0),
    pendingInitialAuditCount: firstFinite([
      metrics.sitePendingInitialAuditCount,
      snapshot?.pendingInitialAuditCount,
    ], 0),
    updatedAt: data.generatedAt || snapshot?.generatedAt || null,
    upstreamResponseMs: raw.responseTimeMs,
  };
}

function unavailableSummary(id, name, raw) {
  return {
    id,
    name,
    available: false,
    status: 'unavailable',
    statusLabel: 'Unavailable',
    error: raw.error || 'Upstream unavailable.',
    httpStatus: raw.httpStatus ?? null,
    upstreamResponseMs: raw.responseTimeMs ?? null,
    updatedAt: null,
  };
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function firstNullable(values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function firstFinite(values, fallback) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow, noarchive',
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: corsHeaders(),
  });
}
