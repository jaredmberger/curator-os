export function buildImportPlan(localRecords = [], incomingRecords = [], options = {}) {
  const selectedTypes = new Set(options.selectedTypes || []);
  const resolution = options.resolution || 'keep-local';
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const incoming = incomingRecords.filter((record) => !selectedTypes.size || selectedTypes.has(record.type));
  const plan = { add: [], identical: [], conflicts: [], skipped: [], selectedTypes: [...selectedTypes], resolution };

  for (const record of incoming) {
    const local = localById.get(record.id);
    if (!local) { plan.add.push(record); continue; }
    if (stableStringify(local) === stableStringify(record)) { plan.identical.push(record); continue; }
    plan.conflicts.push({ id: record.id, local, incoming: record, resolution });
  }

  return plan;
}

export function applyImportPlan(localRecords = [], plan = {}) {
  const byId = new Map(localRecords.map((record) => [record.id, clone(record)]));
  for (const record of plan.add || []) byId.set(record.id, clone(record));
  for (const conflict of plan.conflicts || []) {
    if (conflict.resolution === 'use-incoming') byId.set(conflict.id, clone(conflict.incoming));
    else if (conflict.resolution === 'skip') plan.skipped?.push({ id: conflict.id, reason: 'Conflict skipped.' });
  }
  return [...byId.values()];
}

export function summarizeImportPlan(plan = {}) {
  return {
    added: plan.add?.length || 0,
    identical: plan.identical?.length || 0,
    conflicts: plan.conflicts?.length || 0,
    skipped: plan.skipped?.length || 0
  };
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
