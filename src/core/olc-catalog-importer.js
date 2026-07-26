const SUPPORTED_TYPES = new Set(['ship', 'company', 'organization', 'source', 'object', 'photo', 'media', 'person']);

export function importOlcCatalog(input = {}) {
  const entries = extractEntries(input);
  const records = [];
  const warnings = [];
  const errors = [];
  const skipped = [];
  const seen = new Set();

  entries.forEach((entry, index) => {
    try {
      const record = convertEntry(entry, index, warnings);
      if (!record) { skipped.push({ index, reason: 'Unsupported or empty entry.' }); return; }
      if (seen.has(record.id)) { skipped.push({ index, id: record.id, reason: 'Duplicate id.' }); return; }
      seen.add(record.id);
      records.push(record);
    } catch (error) {
      errors.push({ index, message: error instanceof Error ? error.message : String(error) });
    }
  });

  return {
    format: 'curatoros-olc-import-review',
    formatVersion: 1,
    records,
    report: {
      input: entries.length,
      converted: records.length,
      skipped,
      warnings,
      errors
    }
  };
}

export function detectOlcCatalog(input = {}) {
  if (Array.isArray(input)) return 'array';
  if (Array.isArray(input.records)) return 'curatoros';
  if (Array.isArray(input.ships) || Array.isArray(input.builders) || Array.isArray(input.shippingLines) || Array.isArray(input.lines)) return 'olc-manifest';
  return 'unknown';
}

function extractEntries(input) {
  const detected = detectOlcCatalog(input);
  if (detected === 'array') return input;
  if (detected === 'curatoros') return input.records;
  if (detected === 'olc-manifest') {
    return [
      ...(input.ships || []).map((entry) => ({ ...entry, type: entry.type || 'ship' })),
      ...(input.builders || []).map((entry) => ({ ...entry, type: entry.type || 'company', tags: unique([...(entry.tags || []), 'Shipbuilder']) })),
      ...(input.shippingLines || input.lines || []).map((entry) => ({ ...entry, type: entry.type || 'company', tags: unique([...(entry.tags || []), 'Shipping line']) })),
      ...(input.sources || []).map((entry) => ({ ...entry, type: entry.type || 'source' })),
      ...(input.objects || input.referenceObjects || []).map((entry) => ({ ...entry, type: entry.type || 'object' })),
      ...(input.photos || input.media || []).map((entry) => ({ ...entry, type: entry.type || 'photo' }))
    ];
  }
  throw new Error('This file is not a recognized CuratorOS or Ocean Liner Curator catalog export.');
}

function convertEntry(entry, index, warnings) {
  if (!entry || typeof entry !== 'object') return null;
  const type = normalizeType(entry.type || entry.kind || entry.recordType || inferType(entry));
  if (!SUPPORTED_TYPES.has(type)) return null;
  const title = text(entry.title || entry.name || entry.ship || entry.label);
  if (!title) throw new Error('Entry has no title or name.');
  const id = normalizeId(entry.id || entry.slug || entry.path || title, type);
  const tags = unique(array(entry.tags).map(text).filter(Boolean));
  if (type === 'company' && isBuilder(entry) && !tags.some((tag) => tag.toLowerCase() === 'shipbuilder')) tags.push('Shipbuilder');
  if (type === 'company' && isShippingLine(entry) && !tags.some((tag) => tag.toLowerCase() === 'shipping line')) tags.push('Shipping line');

  const relationships = normalizeRelationships(entry, warnings, index);
  const data = { ...(entry.data && typeof entry.data === 'object' ? clone(entry.data) : {}) };
  copyKnownData(entry, data);

  return {
    id,
    type,
    title,
    status: normalizeStatus(entry.status),
    summary: text(entry.summary || entry.description || entry.excerpt || entry.introduction),
    tags,
    relationships,
    sources: normalizeSources(entry.sources || entry.citations),
    media: array(entry.media).map(clone),
    notes: normalizeNotes(entry.notes),
    data,
    metadata: {
      created: entry.metadata?.created || entry.created || undefined,
      updated: entry.metadata?.updated || entry.updated || undefined,
      reviewed: entry.metadata?.reviewed || entry.reviewed || null,
      confidence: normalizeConfidence(entry.metadata?.confidence || entry.confidence)
    }
  };
}

function normalizeRelationships(entry, warnings, index) {
  const values = array(entry.relationships).map((relationship) => ({
    target: normalizeTarget(relationship.target || relationship.id || relationship.recordId),
    relationship: text(relationship.relationship || relationship.type || 'related_to'),
    confidence: normalizeConfidence(relationship.confidence),
    sourceIds: array(relationship.sourceIds).map(String),
    note: text(relationship.note)
  })).filter((relationship) => relationship.target);

  [['builder', 'built_by'], ['operator', 'operated_by'], ['shippingLine', 'operated_by'], ['line', 'operated_by'], ['associatedRecord', 'associated_with'], ['depictedSubject', 'depicts']].forEach(([field, relationship]) => {
    if (!entry[field] && !entry.data?.[field]) return;
    const target = normalizeTarget(entry[field] || entry.data?.[field]);
    if (!target) return;
    if (!values.some((item) => item.target === target && item.relationship === relationship)) values.push({ target, relationship, confidence: 'unknown', sourceIds: [], note: '' });
  });

  values.forEach((relationship) => { if (!relationship.target.includes('.')) warnings.push({ index, message: `Relationship target ${relationship.target} may need review.` }); });
  return values;
}

function normalizeSources(value) {
  return array(value).map((source) => typeof source === 'string' ? { id: normalizeTarget(source), title: source } : clone(source)).filter((source) => source?.id);
}

function normalizeNotes(value) { return array(value).map((note) => typeof note === 'string' ? { body: note, kind: 'curatorial' } : clone(note)); }
function normalizeType(value) { const type = text(value).toLowerCase(); if (['builder', 'shipbuilder', 'shipping-line', 'shipping_line', 'line'].includes(type)) return 'company'; if (type === 'reference-object') return 'object'; if (type === 'photograph') return 'photo'; return type; }
function inferType(entry) { if (entry.launchDate || entry.maidenVoyage || entry.grossTonnage || entry.builder) return 'ship'; if (entry.sourceType || entry.citation) return 'source'; return 'ship'; }
function isBuilder(entry) { return /builder|shipyard/i.test([entry.kind, entry.category, ...(entry.tags || [])].join(' ')); }
function isShippingLine(entry) { return /shipping line|steamship line|operator/i.test([entry.kind, entry.category, ...(entry.tags || [])].join(' ')); }
function normalizeStatus(value) { return ['draft', 'review', 'published', 'archived'].includes(value) ? value : 'review'; }
function normalizeConfidence(value) { return ['unknown', 'tentative', 'probable', 'verified'].includes(value) ? value : 'unknown'; }
function normalizeId(value, type) { const raw = text(value).replace(/^https?:\/\/[^/]+\//, '').replace(/\.html?$/i, '').split('/').filter(Boolean).pop() || ''; const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const namespace = type === 'company' ? 'company' : type; return raw.includes('.') && /^[a-z][a-z0-9_-]*\.[a-z0-9][a-z0-9_-]*$/.test(raw) ? raw : `${namespace}.${slug || 'untitled'}`; }
function normalizeTarget(value) { if (typeof value === 'object') value = value.id || value.slug || value.title; const raw = text(value); if (!raw) return ''; if (raw.includes('.')) return raw; return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function copyKnownData(entry, data) { ['builder','operator','shippingLine','line','yardNumber','launchDate','maidenVoyage','grossTonnage','length','beam','speed','country','headquarters','city','founded','ceased','parentCompany','successor','routeFocus','houseFlag','yard','category','associatedRecord','date','dimensions','material','condition','storageLocation','curatorNotes','mediaType','creator','depictedSubject','sourceRecord','caption','altText','rights','attribution','sourceType','publisher','identifier','citation','url'].forEach((key) => { if (entry[key] != null && data[key] == null) data[key] = clone(entry[key]); }); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function array(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function text(value) { return String(value || '').trim(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
