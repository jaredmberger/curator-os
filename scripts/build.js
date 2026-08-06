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

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\\/+$/, '') || '/';

    if (pathname === '/api/project-records') {
      return handleProjectRecords(request, env);
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
console.log('Built dist/curatoros-worker.js with KV-backed Project Records API and /link-map routing');
