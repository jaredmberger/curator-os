const SERVICE = "CuratorOS";
const REPOSITORY = "jaredmberger/curator-os";
const VERSION = "1.0.0-rc.1";

export async function onRequestGet({ env } = {}) {
  const commit = env?.CF_PAGES_COMMIT_SHA || null;
  const branch = env?.CF_PAGES_BRANCH || "main";
  const deploymentUrl = env?.CF_PAGES_URL || null;

  return json({
    ok: true,
    contractVersion: 1,
    service: SERVICE,
    repository: REPOSITORY,
    productionBranch: "main",
    version: VERSION,
    commit,
    cloudflareDeploymentId: null,
    runtime: "cloudflare-pages",
    cloudflareVersion: {
      id: null,
      tag: branch,
      timestamp: null
    },
    build: {
      commit,
      branch,
      buildUuid: null,
      source: "cloudflare-pages"
    },
    deploymentUrl,
    observedAt: new Date().toISOString()
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store"
    }
  });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
