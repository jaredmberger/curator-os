import { DEFAULT_ARCHIVE_URL, reconcileProjectRecordsWithArchive } from '../../lib/project-records-archive-sync.mjs';

export async function onRequestPost(context) {
  const store = context.env.CURATOROS_RECORDS;
  if (!store) return json({ ok: false, error: 'CURATOROS_RECORDS binding is not configured.' }, 500);

  const previous = await store.get('project-records', 'json');
  const current = previous && Array.isArray(previous.records)
    ? previous
    : { records: [], version: 0, updatedAt: null };

  let response;
  try {
    response = await fetch(DEFAULT_ARCHIVE_URL, {
      headers: {
        accept: 'application/json',
        'user-agent': 'CuratorOS-Project-Records-Sync/1.0 (+https://curator.oceanliners.net)'
      },
      cf: { cacheTtl: 60, cacheEverything: true }
    });
  } catch (error) {
    return json({ ok: false, error: `Ship archive fetch failed: ${error instanceof Error ? error.message : String(error)}` }, 502);
  }

  if (!response.ok) {
    return json({ ok: false, error: `Ship archive returned HTTP ${response.status}.` }, 502);
  }

  let archive;
  try {
    archive = await response.json();
  } catch {
    return json({ ok: false, error: 'Ship archive returned invalid JSON.' }, 502);
  }

  let reconciliation;
  try {
    reconciliation = reconcileProjectRecordsWithArchive(current.records, archive);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }

  const changed = reconciliation.summary.added > 0 || reconciliation.summary.repaired > 0;
  if (!changed) {
    return json({
      ok: true,
      storage: 'kv',
      key: 'project-records',
      changed: false,
      version: Number(current.version || 0),
      recordCount: current.records.length,
      ...reconciliation.summary,
      ambiguousMatches: reconciliation.ambiguous
    }, 200);
  }

  const version = Number(current.version || 0) + 1;
  const updatedAt = new Date().toISOString();
  const payload = {
    records: reconciliation.records,
    version,
    updatedAt,
    reason: 'sync:site-archive'
  };

  await store.put('project-records', JSON.stringify(payload));

  return json({
    ok: true,
    storage: 'kv',
    key: 'project-records',
    changed: true,
    version,
    recordCount: reconciliation.records.length,
    updatedAt,
    ...reconciliation.summary,
    addedRecords: reconciliation.added,
    repairedUrls: reconciliation.repaired,
    ambiguousMatches: reconciliation.ambiguous
  }, 200);
}

function json(value, status) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
