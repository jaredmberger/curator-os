export async function buildOlcManifest(files = []) {
  const manifest = { ships: [], builders: [], shippingLines: [], sources: [], objects: [], photos: [] };
  const report = { files: files.length, recognized: 0, skipped: [], warnings: [], duplicates: [] };
  const seen = new Map();

  for (const file of [...files]) {
    const name = String(file?.name || 'unnamed');
    try {
      const text = await file.text();
      const lower = name.toLowerCase();
      let entries = [];

      if (lower.endsWith('.html') || lower.endsWith('.htm')) {
        const ship = parseShipGuideHtml(text, name, report);
        if (ship) entries = [{ group: 'ships', entry: ship }];
      } else if (lower.endsWith('.json')) {
        entries = parseJsonFile(text, name, report);
      } else if (lower.endsWith('.js')) {
        entries = parseJavaScriptData(text, name, report);
      } else {
        report.skipped.push({ file: name, reason: 'Unsupported file type.' });
        continue;
      }

      if (!entries.length) {
        report.skipped.push({ file: name, reason: 'No supported catalog entries were detected.' });
        continue;
      }

      report.recognized += 1;
      for (const { group, entry } of entries) {
        const key = `${group}:${entry.id || entry.slug || entry.title || entry.name}`.toLowerCase();
        if (seen.has(key)) {
          report.duplicates.push({ file: name, key, firstFile: seen.get(key) });
          continue;
        }
        seen.set(key, name);
        manifest[group].push(entry);
      }
    } catch (error) {
      report.skipped.push({ file: name, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    format: 'ocean-liner-curator-site-manifest',
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    ...manifest,
    report
  };
}

function parseShipGuideHtml(html, filename, report) {
  const title = firstMatch(html, [
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]);
  if (!title) return null;

  const cleanedTitle = stripHtml(title).replace(/\s*[—|]\s*(Ship Guide|Ocean Liner Curator).*$/i, '').trim();
  const canonical = firstMatch(html, [/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i]);
  const summary = firstMatch(html, [
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i
  ]);
  const builder = labeledValue(html, ['Builder', 'Built by', 'Shipbuilder']);
  const operator = labeledValue(html, ['Operator', 'Shipping line', 'Line']);
  const launchDate = labeledValue(html, ['Launched', 'Launch date']);
  const maidenVoyage = labeledValue(html, ['Maiden voyage']);
  const grossTonnage = labeledValue(html, ['Gross tonnage', 'Tonnage']);
  const length = labeledValue(html, ['Length']);
  const beam = labeledValue(html, ['Beam']);
  const speed = labeledValue(html, ['Speed', 'Service speed']);
  const image = firstMatch(html, [/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i]);

  if (!canonical) report.warnings.push({ file: filename, message: 'Ship guide has no canonical URL.' });
  if (!builder) report.warnings.push({ file: filename, message: 'Builder was not explicitly detected.' });

  return compact({
    id: canonical || filename.replace(/\.html?$/i, ''),
    title: cleanedTitle,
    summary: decode(summary),
    status: 'review',
    confidence: 'tentative',
    builder,
    operator,
    launchDate,
    maidenVoyage,
    grossTonnage,
    length,
    beam,
    speed,
    url: canonical,
    media: image ? [{ id: image, title: `${cleanedTitle} primary image`, url: image, type: 'image' }] : [],
    notes: [{ body: `Extracted from ${filename}; verify before publication.`, kind: 'migration' }]
  });
}

function parseJsonFile(text, filename, report) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return inferGroupedEntries(parsed, filename, report);
  if (!parsed || typeof parsed !== 'object') return [];
  const groups = [
    ['ships', parsed.ships], ['builders', parsed.builders], ['shippingLines', parsed.shippingLines || parsed.lines],
    ['sources', parsed.sources], ['objects', parsed.objects || parsed.referenceObjects], ['photos', parsed.photos || parsed.media]
  ];
  const entries = groups.flatMap(([group, values]) => Array.isArray(values) ? values.map((entry) => ({ group, entry })) : []);
  if (entries.length) return entries;
  if (Array.isArray(parsed.records)) return inferGroupedEntries(parsed.records, filename, report);
  return inferGroupedEntries([parsed], filename, report);
}

function parseJavaScriptData(text, filename, report) {
  const arrayText = firstMatch(text, [/=\s*(\[[\s\S]*\])\s*;?\s*$/m, /export\s+default\s*(\[[\s\S]*\])\s*;?\s*$/m]);
  if (!arrayText) return [];
  try {
    return inferGroupedEntries(JSON.parse(arrayText), filename, report);
  } catch {
    report.warnings.push({ file: filename, message: 'JavaScript data was not strict JSON and could not be parsed safely.' });
    return [];
  }
}

function inferGroupedEntries(values, filename, report) {
  return values.flatMap((value) => {
    if (typeof value === 'string') {
      const title = value.split('/').filter(Boolean).pop().replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return [{ group: 'ships', entry: { id: value, title, status: 'review', confidence: 'unknown', notes: [{ body: `Imported from ${filename}.`, kind: 'migration' }] } }];
    }
    if (!value || typeof value !== 'object') return [];
    const kind = String(value.type || value.kind || '').toLowerCase();
    if (/builder|shipyard/.test(kind) || /builder/.test(filename)) return [{ group: 'builders', entry: value }];
    if (/line|operator/.test(kind) || /line/.test(filename)) return [{ group: 'shippingLines', entry: value }];
    if (/source|citation/.test(kind) || /source/.test(filename)) return [{ group: 'sources', entry: value }];
    if (/object|artifact/.test(kind) || /object/.test(filename)) return [{ group: 'objects', entry: value }];
    if (/photo|media|image/.test(kind) || /photo|media/.test(filename)) return [{ group: 'photos', entry: value }];
    if (value.title || value.name || value.ship || value.slug || value.url || value.path) return [{ group: 'ships', entry: value }];
    report.warnings.push({ file: filename, message: 'An object entry could not be classified.' });
    return [];
  });
}

function labeledValue(html, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<dt[^>]*>\\s*${escaped}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i'),
      new RegExp(`<th[^>]*>\\s*${escaped}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i'),
      new RegExp(`<[^>]+class=["'][^"']*(?:fact|label)[^"']*["'][^>]*>\\s*${escaped}\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, 'i')
    ];
    const match = firstMatch(html, patterns);
    if (match) return stripHtml(match);
  }
  return '';
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}
function stripHtml(value) { return decode(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function decode(value) { return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '' && item != null && !(Array.isArray(item) && !item.length))); }
