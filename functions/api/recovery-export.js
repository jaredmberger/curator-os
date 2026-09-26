const BACKUP_FORMAT = 'curatoros-kv-recovery';
const SCHEMA_VERSION = 1;
const REQUIRED_KEYS = ['project-records', 'research-state'];

export async function onRequestGet(context) {
  const store = context.env.CURATOROS_RECORDS;
  if (!store) {
    return json({ ok: false, error: 'CURATOROS_RECORDS binding is not configured.' }, 500);
  }

  const entries = await Promise.all(
    REQUIRED_KEYS.map(async (key) => [key, await store.get(key, 'text')])
  );

  const missingKeys = entries.filter(([, raw]) => raw === null).map(([key]) => key);
  if (missingKeys.length) {
    return json({
      ok: false,
      error: 'Recovery export refused because required durable records are missing.',
      missingKeys
    }, 503);
  }

  const data = {};
  for (const [key, raw] of entries) {
    try {
      data[key] = JSON.parse(raw);
    } catch {
      return json({
        ok: false,
        error: 'Recovery export refused because a required durable record is not valid JSON.',
        corruptKey: key
      }, 500);
    }
  }

  const validationError = validateDurableData(data);
  if (validationError) {
    return json({ ok: false, error: validationError }, 500);
  }

  const dataJson = JSON.stringify(data);
  const digest = await sha256(dataJson);
  const exportedAt = new Date().toISOString();

  const payload = {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    source: {
      service: 'CuratorOS',
      binding: 'CURATOROS_RECORDS',
      keys: REQUIRED_KEYS
    },
    integrity: {
      algorithm: 'SHA-256',
      dataSha256: digest
    },
    summary: {
      projectRecordCount: data['project-records'].records.length,
      projectRecordsVersion: Number(data['project-records'].version || 0),
      projectRecordsUpdatedAt: data['project-records'].updatedAt || null,
      researchStateVersion: Number(data['research-state'].version || 0),
      researchStateUpdatedAt: data['research-state'].updatedAt || null
    },
    data
  };

  const stamp = exportedAt.replace(/[:.]/g, '-');
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="curatoros-recovery-${stamp}.json"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function validateDurableData(data) {
  const projectRecords = data['project-records'];
  if (!projectRecords || !Array.isArray(projectRecords.records)) {
    return 'Recovery export refused because project-records does not contain a records array.';
  }

  const researchState = data['research-state'];
  if (
    !researchState ||
    !researchState.state ||
    typeof researchState.state !== 'object' ||
    Array.isArray(researchState.state)
  ) {
    return 'Recovery export refused because research-state does not contain a state object.';
  }

  return null;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
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
