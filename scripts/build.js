const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('views/shell.html');
const css = read('styles/curatoros.css');
const linkMapHtml = read('link-map/index.html');
const modules = [
  'src/core/database.js',
  'src/core/storage.js',
  'src/core/relationships.js',
  'src/core.js',
  'src/registry.js',
  'src/startup.js'
];
const js = modules.map(read).join('\n\n');

new vm.Script(js, { filename: 'curatoros-browser.js' });

const assembled = html
  .replace('/*__CURATOROS_CSS__*/', css)
  .replace('/*__CURATOROS_JS__*/', js);

if (assembled.includes('__CURATOROS_')) {
  throw new Error('Build failed: unresolved assembly token.');
}

const worker = `const HTML = ${JSON.stringify(assembled)};
const LINK_MAP_HTML = ${JSON.stringify(linkMapHtml)};
const PROJECT_RECORDS_KEY = 'project-records';
const LINK_MAP_CACHE_KEY = 'curatoros-link-map-v1';
const LINK_MAP_CACHE_TTL_SECONDS = 60 * 60 * 6;
const LINK_MAP_MAX_PAGES = 1200;
const SITE_ORIGIN = 'https://oceanliners.net';

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

async function handleProjectRecords(request, env) {
  const store = env && env.CURATOROS_RECORDS;
  if (!store) {
    return jsonResponse({
      ok: false,
      error: 'CURATOROS_RECORDS binding is not configured on this Worker.'
    }, 500);
  }

  if (request.method === 'GET') {
    const raw = await store.get(PROJECT_RECORDS_KEY, 'json');
    const payload = raw && Array.isArray(raw.records)
      ? raw
      : { records: [], version: 0, updatedAt: null, reason: 'uninitialized' };
    return jsonResponse(payload);
  }

  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    if (!Array.isArray(body && body.records)) {
      return jsonResponse({ ok: false, error: 'records must be an array.' }, 400);
    }

    const previous = await store.get(PROJECT_RECORDS_KEY, 'json');
    const version = Number(previous && previous.version || 0) + 1;
    const payload = {
      records: body.records,
      version,
      updatedAt: new Date().toISOString(),
      reason: String(body.reason || 'update')
    };

    await store.put(PROJECT_RECORDS_KEY, JSON.stringify(payload));

    return jsonResponse({
      ok: true,
      storage: 'kv',
      key: PROJECT_RECORDS_KEY,
      version,
      recordCount: body.records.length,
      updatedAt: payload.updatedAt
    });
  }

  return new Response(null, {
    status: 405,
    headers: {
      allow: 'GET, PUT',
      'cache-control': 'no-store'
    }
  });
}

async function handleLinkMap(request, env) {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET', 'cache-control': 'no-store' } });
  }
  const url = new URL(request.url);
  const force = url.searchParams.get('refresh') === '1';
  const cache = (env && (env.CURATOROS_LINK_MAP || env.CURATOROS_RECORDS)) || null;

  if (!force && cache) {
    const cached = await cache.get(LINK_MAP_CACHE_KEY, 'json');
    if (cached && cached.generatedAt && Array.isArray(cached.pages) && Array.isArray(cached.edges)) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (Number.isFinite(age) && age < LINK_MAP_CACHE_TTL_SECONDS * 1000) {
        return jsonResponse(cached);
      }
    }
  }

  try {
    const result = await crawlSite();
    if (cache) {
      await cache.put(LINK_MAP_CACHE_KEY, JSON.stringify(result), { expirationTtl: LINK_MAP_CACHE_TTL_SECONDS });
    }
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

async function crawlSite() {
  const discovered = new Set(['/']);
  const queue = [];
  const sitemapUrls = await getSitemapUrls();
  sitemapUrls.forEach(value => discovered.add(value));
  queue.push(...discovered);

  const pages = [];
  const edgeKeys = new Set();
  const edges = [];
  let cursor = 0;
  const workers = Array.from({ length: 8 }, () => crawlWorker());
  await Promise.all(workers);

  async function crawlWorker() {
    while (true) {
      const index = cursor++;
      if (index >= queue.length || pages.length >= LINK_MAP_MAX_PAGES) return;
      const pagePath = queue[index];
      const url = new URL(pagePath, SITE_ORIGIN).href;
      let response;
      try {
        response = await fetch(url, { headers: { 'user-agent': 'CuratorOS-LinkMap/1.1 (+https://oceanliners.net/)', accept: 'text/html,application/xhtml+xml' } });
      } catch {
        continue;
      }
      const type = response.headers.get('content-type') || '';
      if (!response.ok || !type.includes('text/html')) continue;
      const html = await response.text();
      const title = extractTitle(html) || friendlyTitle(pagePath);
      const canonical = normalizeSiteUrl(extractCanonical(html) || url);
      if (!canonical) continue;
      const links = extractLinks(html, url);
      const outgoing = [];
      for (const link of links) {
        const normalized = normalizeSiteUrl(link);
        if (!normalized) continue;
        outgoing.push(normalized);
        const key = canonical + '>' + normalized;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ source: canonical, target: normalized });
        }
        const parsed = new URL(normalized);
        const nextPath = parsed.pathname + parsed.search;
        if (!discovered.has(nextPath) && discovered.size < LINK_MAP_MAX_PAGES) {
          discovered.add(nextPath);
          queue.push(nextPath);
        }
      }
      pages.push({ url: canonical, title, status: response.status, outgoingCount: new Set(outgoing).size });
    }
  }

  const pageUrls = new Set(pages.map(page => page.url));
  const internalEdges = edges.filter(edge => pageUrls.has(edge.source) && pageUrls.has(edge.target));
  pages.sort((a, b) => a.url.localeCompare(b.url));
  internalEdges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  return {
    site: SITE_ORIGIN,
    generatedAt: new Date().toISOString(),
    pages,
    edges: internalEdges,
    limits: { maxPages: LINK_MAP_MAX_PAGES },
    source: 'live-crawl'
  };
}

async function getSitemapUrls() {
  const candidates = ['/sitemap.xml', '/sitemap_index.xml'];
  const out = new Set();
  for (const candidate of candidates) {
    try {
      const response = await fetch(new URL(candidate, SITE_ORIGIN), { headers: { 'user-agent': 'CuratorOS-LinkMap/1.1' } });
      if (!response.ok) continue;
      const xml = await response.text();
      const locs = [...xml.matchAll(/<loc>\\s*([^<]+?)\\s*<\\/loc>/gi)].map(match => decodeEntities(match[1].trim()));
      for (const loc of locs) {
        if (loc.endsWith('.xml')) {
          try {
            const child = await fetch(loc, { headers: { 'user-agent': 'CuratorOS-LinkMap/1.1' } });
            if (!child.ok) continue;
            const childXml = await child.text();
            for (const match of childXml.matchAll(/<loc>\\s*([^<]+?)\\s*<\\/loc>/gi)) {
              const normalized = normalizeSiteUrl(decodeEntities(match[1].trim()));
              if (normalized) {
                const parsed = new URL(normalized);
                out.add(parsed.pathname + parsed.search);
              }
            }
          } catch {}
        } else {
          const normalized = normalizeSiteUrl(loc);
          if (normalized) {
            const parsed = new URL(normalized);
            out.add(parsed.pathname + parsed.search);
          }
        }
      }
      if (out.size) break;
    } catch {}
  }
  return [...out].slice(0, LINK_MAP_MAX_PAGES);
}

function extractLinks(html, base) {
  const links = [];
  const pattern = /<a\\b[^>]*?href\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    try { links.push(new URL(decodeEntities(raw), base).href); } catch {}
  }
  return [...new Set(links)];
}

function normalizeSiteUrl(value) {
  try {
    const url = new URL(value, SITE_ORIGIN);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.hostname !== 'oceanliners.net' && url.hostname !== 'www.oceanliners.net') return null;
    url.protocol = 'https:';
    url.hostname = 'oceanliners.net';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    let pathname = url.pathname.replace(/\\/index\\.html?$/i, '/').replace(/\\/{2,}/g, '/');
    if (pathname.length > 1) pathname = pathname.replace(/\\/$/, '');
    if (/\\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|xml|json|js|css|ico|txt|mp4|webm|mp3|woff2?|ttf)$/i.test(pathname)) return null;
    url.pathname = pathname || '/';
    return url.href;
  } catch {
    return null;
  }
}

function extractTitle(html) {
  const match = html.match(/<title\\b[^>]*>([\\s\\S]*?)<\\/title>/i);
  return match ? stripTags(decodeEntities(match[1])).replace(/\\s+/g, ' ').trim() : '';
}
function extractCanonical(html) {
  const match = html.match(/<link\\b[^>]*rel\\s*=\\s*[\"'][^\"']*canonical[^\"']*[\"'][^>]*href\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>/i)
    || html.match(/<link\\b[^>]*href\\s*=\\s*[\"']([^\"']+)[\"'][^>]*rel\\s*=\\s*[\"'][^\"']*canonical[^\"']*[\"'][^>]*>/i);
  return match ? decodeEntities(match[1]) : '';
}
function stripTags(value) { return value.replace(/<[^>]*>/g, ''); }
function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '\"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function friendlyTitle(pagePath) {
  if (pagePath === '/') return 'Ocean Liner Curator';
  return pagePath.split('/').filter(Boolean).pop().replace(/[-_]+/g, ' ').replace(/\\b\\w/g, char => char.toUpperCase());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\\/+$/, '') || '/';

    if (pathname === '/api/project-records') {
      return handleProjectRecords(request, env);
    }

    if (pathname === '/api/link-map') {
      return handleLinkMap(request, env);
    }

    if (pathname === '/link-map') {
      return new Response(LINK_MAP_HTML, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }

    return new Response(HTML, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }
};
`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/curatoros-worker.js'), worker);
fs.writeFileSync(path.join(root, 'dist/curatoros-worker.json'), worker);
console.log('Built dist/curatoros-worker.js with KV-backed Project Records API, cached /api/link-map, and /link-map routing');
