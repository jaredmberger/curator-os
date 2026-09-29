export const DEFAULT_ARCHIVE_URL = 'https://oceanliners.net/api/device/archive.json';

export function reconcileProjectRecordsWithArchive(records, archive, options = {}) {
  if (!Array.isArray(records)) throw new Error('Project Records must be an array.');
  const ships = Array.isArray(archive?.ships) ? archive.ships : [];
  if (!ships.length) throw new Error('Ship archive is missing ships[].');

  const now = options.now || new Date().toISOString();
  const archiveUrl = options.archiveUrl || DEFAULT_ARCHIVE_URL;
  const next = records.map(clone);

  const indexes = buildIndexes(next);
  const archiveExactCounts = countBy(ships, (ship) => normalizeTitle(ship?.name));
  const archiveLooseCounts = countBy(ships, (ship) => looseTitle(ship?.name));
  const archiveExactPaths = groupPaths(ships, (ship) => normalizeTitle(ship?.name));
  const archiveLoosePaths = groupPaths(ships, (ship) => looseTitle(ship?.name));

  const added = [];
  const repaired = [];
  const ambiguous = [];
  let matched = 0;

  for (const ship of ships) {
    if (!ship || !ship.name || !ship.page) continue;
    const match = findMatch(ship, indexes, archiveExactCounts, archiveLooseCounts, archiveExactPaths, archiveLoosePaths);

    if (match?.index != null) {
      matched += 1;
      const record = next[match.index];
      const current = normalizePath(publicUrl(record));
      const canonical = normalizePath(ship.page);

      if (canonical && current !== canonical) {
        const before = publicUrl(record) || null;
        record.data = isObject(record.data) ? record.data : {};
        record.data.pageUrl = absoluteSiteUrl(ship.page);
        record.metadata = {
          ...(isObject(record.metadata) ? record.metadata : {}),
          canonicalUrlSyncedAt: now,
          canonicalUrlSyncSource: archiveUrl
        };
        record.notes = Array.isArray(record.notes) ? record.notes : [];
        record.notes.push({
          kind: 'synchronization',
          body: `Canonical public-page URL reconciled from ${before || 'not linked'} to ${record.data.pageUrl} using the current Ocean Liner Curator ship archive.`
        });
        repaired.push({
          id: record.id,
          title: record.title,
          from: before,
          to: record.data.pageUrl,
          matchedBy: match.matchedBy
        });
        indexes.refresh(match.index, record);
      }
      continue;
    }

    if (match?.ambiguous) {
      ambiguous.push({
        archiveId: String(ship.id || ''),
        title: String(ship.name || ''),
        pageUrl: absoluteSiteUrl(ship.page),
        reason: match.reason
      });
      continue;
    }

    const record = archiveRecord(ship, { now, archiveUrl });
    next.push(record);
    indexes.add(next.length - 1, record);
    added.push({
      id: record.id,
      title: record.title,
      type: record.type,
      pageUrl: record.data?.pageUrl || null
    });
  }

  return {
    records: next,
    summary: {
      archiveEntries: ships.length,
      previousRecords: records.length,
      nextRecords: next.length,
      matched,
      added: added.length,
      repaired: repaired.length,
      ambiguous: ambiguous.length
    },
    added,
    repaired,
    ambiguous
  };
}

function findMatch(ship, indexes, archiveExactCounts, archiveLooseCounts, archiveExactPaths, archiveLoosePaths) {
  const path = normalizePath(ship.page);
  if (path && indexes.byPath.has(path)) {
    return { index: indexes.byPath.get(path), matchedBy: 'canonical-url' };
  }

  const id = String(ship.id || '').trim();
  const canonicalIds = [
    id ? `ship:${id}` : '',
    id === 'tall-ships-guide' ? 'collection:tall-ships' : ''
  ].filter(Boolean);
  for (const candidate of canonicalIds) {
    if (indexes.byId.has(candidate)) return { index: indexes.byId.get(candidate), matchedBy: 'record-id' };
  }

  const exact = normalizeTitle(ship.name);
  const exactMatches = indexes.byExactTitle.get(exact) || [];
  if (exact && archiveExactCounts.get(exact) === 1 && exactMatches.length === 1) {
    return { index: exactMatches[0], matchedBy: 'unique-title' };
  }

  const loose = looseTitle(ship.name);
  const looseMatches = indexes.byLooseTitle.get(loose) || [];
  if (loose && archiveLooseCounts.get(loose) === 1 && looseMatches.length === 1) {
    return { index: looseMatches[0], matchedBy: 'unique-loose-title' };
  }

  const competing = Math.max(exactMatches.length, looseMatches.length, archiveExactCounts.get(exact) || 0, archiveLooseCounts.get(loose) || 0);
  if (competing > 1) {
    const exactSiblingPaths = archiveExactPaths.get(exact) || [];
    const looseSiblingPaths = archiveLoosePaths.get(loose) || [];
    const representedSibling = [...new Set([...exactSiblingPaths, ...looseSiblingPaths])]
      .some((candidatePath) => candidatePath && candidatePath !== path && indexes.byPath.has(candidatePath));
    if (id && path && representedSibling) return null;
    return { ambiguous: true, reason: 'Multiple records or archive entries share the same normalized ship identity.' };
  }

  return null;
}

function archiveRecord(ship, { now, archiveUrl }) {
  const isTallShips = String(ship.id || '') === 'tall-ships-guide';
  const type = isTallShips ? 'collection' : 'ship';
  const id = isTallShips ? 'collection:tall-ships' : `ship:${String(ship.id || slug(ship.name))}`;
  const sourceId = `source.site-archive-${slug(ship.id || ship.name)}`;

  return {
    id,
    title: String(ship.name).trim(),
    type,
    status: 'draft',
    summary: String(ship.summary || '').trim(),
    tags: ['site-archive-sync'],
    data: {
      pageUrl: absoluteSiteUrl(ship.page)
    },
    fieldEvidence: {},
    relationships: [],
    sources: [{
      id: sourceId,
      title: 'Ocean Liner Curator ship archive index',
      url: archiveUrl,
      sourceType: 'site-archive-index'
    }],
    notes: [{
      kind: 'synchronization',
      body: 'Created from the published ship archive inventory. Only page identity and the archive summary were imported; ship facts still require canonical page extraction or independent evidence review.'
    }],
    metadata: {
      ...(type === 'ship' ? { shipSchemaVersion: 2 } : {}),
      confidence: 'probable',
      extractionState: 'indexed-only',
      knowledgeExtraction: 'site-archive-sync-v1',
      siteArchiveSyncedAt: now,
      siteArchiveId: String(ship.id || ''),
      siteArchiveYear: ship.year ?? null,
      siteArchiveLine: String(ship.line || ''),
      siteArchiveBuilder: String(ship.builder || '')
    },
    origin: {
      kind: 'site-archive-sync',
      source: archiveUrl,
      createdAt: now
    }
  };
}

function buildIndexes(records) {
  const state = {
    byPath: new Map(),
    byId: new Map(),
    byExactTitle: new Map(),
    byLooseTitle: new Map()
  };

  function add(index, record) {
    const path = normalizePath(publicUrl(record));
    if (path && !state.byPath.has(path)) state.byPath.set(path, index);
    if (record?.id && !state.byId.has(String(record.id))) state.byId.set(String(record.id), index);
    pushMap(state.byExactTitle, normalizeTitle(record?.title), index);
    pushMap(state.byLooseTitle, looseTitle(record?.title), index);
  }

  function refresh(index, record) {
    state.byPath = new Map([...state.byPath].filter(([, value]) => value !== index));
    const path = normalizePath(publicUrl(record));
    if (path) state.byPath.set(path, index);
  }

  records.forEach((record, index) => add(index, record));
  return { ...state, add, refresh };
}

function pushMap(map, key, value) {
  if (!key) return;
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

function countBy(values, getter) {
  const map = new Map();
  for (const value of values) {
    const key = getter(value);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function groupPaths(values, getter) {
  const map = new Map();
  for (const value of values) {
    const key = getter(value);
    const path = normalizePath(value?.page);
    if (!key || !path) continue;
    const list = map.get(key) || [];
    list.push(path);
    map.set(key, list);
  }
  return map;
}

function publicUrl(record) {
  return record?.data?.pageUrl || record?.url || record?.path || record?.canonical || record?.href || '';
}

function normalizePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://oceanliners.net');
    if (!['oceanliners.net', 'www.oceanliners.net'].includes(url.hostname.toLowerCase())) return '';
    let path = url.pathname.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '').replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/$/, '');
    return path || '/';
  } catch {
    return raw.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/i, '').replace(/\.html?$/i, '').replace(/\/$/, '');
  }
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(rms|ss|ms|mv|rmmv|qsmv|hmhs|hmt|hms)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function looseTitle(value) {
  return normalizeTitle(value)
    .replace(/\b(18|19|20)\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteSiteUrl(value) {
  const path = normalizePath(value);
  return path ? `https://oceanliners.net${path}` : '';
}

function slug(value) {
  return normalizeTitle(value).replace(/\s+/g, '-') || 'unnamed';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
