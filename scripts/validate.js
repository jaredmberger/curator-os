const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const previewDir = path.join(root, 'preview');
const htmlPath = path.join(previewDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-cloudflare-pages.sh'), 'utf8');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) {
  throw new Error(`Duplicate HTML IDs in preview/index.html: ${[...new Set(duplicates)].join(', ')}`);
}

const requiredSurfaceMarkers = [
  'Project Records',
  'Extract Knowledge',
  'Build Corpus',
  'Site / Knowledge Sync',
  'Knowledge Graph',
  'Research Desk',
  'Research Queue',
  'Conclusion Review',
  'Knowledge Promotion',
  'Incorporation Review'
];
for (const marker of requiredSurfaceMarkers) {
  if (!html.includes(marker)) throw new Error(`Current CuratorOS surface is missing: ${marker}`);
}

const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1].split('?')[0])
  .filter(ref => /^(?:\.\.?\/|\/)/.test(ref))
  .filter(ref => /\.(?:js|css|svg|webmanifest)$/.test(ref));

for (const ref of assetRefs) {
  const resolved = ref.startsWith('/')
    ? path.join(root, ref.slice(1))
    : path.resolve(previewDir, ref);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Current CuratorOS surface references a missing asset: ${ref}`);
  }
}

for (const required of [
  './project-records-store.js',
  './research-state-store.js',
  './records-browser.js',
  './record-editing.js',
  './app-shell.js',
  './version.js'
]) {
  if (!html.includes(required)) throw new Error(`Current CuratorOS surface is missing required module: ${required}`);
}

if (!build.includes('cp -R "$ROOT/preview/." "$OUT/"')) {
  throw new Error('Cloudflare Pages build must publish the current preview application.');
}
if (!build.includes('link-map.oceanliners.net')) {
  throw new Error('Cloudflare Pages build must redirect retired /link-map routes to the canonical standalone Link Map.');
}
if (build.includes('build-link-map-data.js')) {
  throw new Error('CuratorOS build must not regenerate the retired embedded Link Map.');
}

console.log(`Validated current CuratorOS surface: ${ids.length} unique IDs and ${assetRefs.length} local assets.`);
