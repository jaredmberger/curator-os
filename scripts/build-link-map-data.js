const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(process.argv[2] || '_oceanliners');
const outputFile = path.resolve(process.argv[3] || '_site/link-map/link-map-data.json');
const SITE = 'https://oceanliners.net';
const SITE_HOSTS = new Set(['oceanliners.net', 'www.oceanliners.net']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'vendor', 'dist', 'build']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.html?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function attr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
}

function canonicalFrom(html, file) {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/\bcanonical\b/i.test(attr(tag, 'rel'))) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const u = new URL(href, SITE);
      if (SITE_HOSTS.has(u.hostname.toLowerCase())) return normalize(u.href);
    } catch {}
  }
  const rel = path.relative(sourceRoot, file).replace(/\\/g, '/');
  let pathname = '/' + rel.replace(/index\.html?$/i, '').replace(/\.html?$/i, '');
  pathname = pathname.replace(/\/+/g, '/');
  return normalize(new URL(pathname, SITE).href);
}

function normalize(value) {
  const u = new URL(value, SITE);
  u.hash = '';
  u.search = '';
  u.hostname = 'oceanliners.net';
  u.protocol = 'https:';
  let p = u.pathname.replace(/\/+/g, '/');
  if (p.length > 1) p = p.replace(/\/$/, '');
  u.pathname = p;
  return u.href;
}

function titleFrom(html, url) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).replace(/\s+[—|]\s+.*$/, '').trim();
  const p = new URL(url).pathname.split('/').filter(Boolean).pop() || 'Ocean Liner Curator';
  return p.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function decode(s) {
  return s.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
}

function hrefsFrom(html, base) {
  const found = new Set();
  for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
    const href = attr(tag, 'href').trim();
    if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href) || href.startsWith('#')) continue;
    try {
      const u = new URL(href, base);
      if (!SITE_HOSTS.has(u.hostname.toLowerCase())) continue;
      found.add(normalize(u.href));
    } catch {}
  }
  return [...found];
}

const files = walk(sourceRoot);
const pagesByUrl = new Map();
for (const file of files) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const url = canonicalFrom(html, file);
  const page = { url, title: titleFrom(html, url), file: path.relative(sourceRoot, file).replace(/\\/g, '/'), rawLinks: hrefsFrom(html, url) };
  const existing = pagesByUrl.get(url);
  if (!existing || page.file.length < existing.file.length) pagesByUrl.set(url, page);
}

const known = new Set(pagesByUrl.keys());
const pages = [...pagesByUrl.values()].map(({ rawLinks, ...p }) => p).sort((a,b) => a.url.localeCompare(b.url));
const edgeKeys = new Set();
const edges = [];
for (const page of pagesByUrl.values()) {
  for (const target of page.rawLinks) {
    if (target === page.url || !known.has(target)) continue;
    const key = `${page.url}\n${target}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ source: page.url, target });
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'jaredmberger/Ocean-Liner-Curator@main',
  pageCount: pages.length,
  edgeCount: edges.length,
  pages,
  edges
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(payload));
console.log(`Built ${outputFile}: ${pages.length} pages, ${edges.length} internal links`);
