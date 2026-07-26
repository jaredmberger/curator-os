const CuratorDatabase = (() => {
  const SCHEMA_VERSION = 1;
  const RECORD_TYPES = Object.freeze(['ship', 'company', 'organization', 'person', 'object', 'photo', 'media', 'source']);
  const RECORD_STATUSES = Object.freeze(['draft', 'review', 'published', 'archived']);
  const CONFIDENCE_LEVELS = Object.freeze(['unknown', 'tentative', 'probable', 'verified']);
  const ID_PATTERN = /^[a-z][a-z0-9_-]*\.[a-z0-9][a-z0-9_-]*$/;

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const list = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value.trim() : '';

  function createRecord(input = {}) {
    const timestamp = now();
    const record = {
      id: text(input.id),
      type: text(input.type),
      title: text(input.title),
      status: RECORD_STATUSES.includes(input.status) ? input.status : 'draft',
      summary: text(input.summary),
      tags: [...new Set(list(input.tags).map(text).filter(Boolean))],
      relationships: list(input.relationships).map(clone),
      sources: list(input.sources).map(clone),
      media: list(input.media).map(clone),
      notes: list(input.notes).map(clone),
      data: input.data && typeof input.data === 'object' ? clone(input.data) : {},
      metadata: {
        created: input.metadata?.created || timestamp,
        updated: input.metadata?.updated || timestamp,
        reviewed: input.metadata?.reviewed || null,
        confidence: CONFIDENCE_LEVELS.includes(input.metadata?.confidence)
          ? input.metadata.confidence
          : 'unknown',
        schemaVersion: SCHEMA_VERSION
      }
    };

    assertRecord(record);
    return record;
  }

  function validateRecord(record) {
    const errors = [];
    if (!record || typeof record !== 'object') return ['Record must be an object.'];
    if (!ID_PATTERN.test(record.id || '')) errors.push('Record id must use namespace.slug format.');
    if (!RECORD_TYPES.includes(record.type)) errors.push(`Unsupported record type: ${record.type}`);
    if (!text(record.title)) errors.push('Record title is required.');
    if (!RECORD_STATUSES.includes(record.status)) errors.push(`Unsupported status: ${record.status}`);
    if (!Array.isArray(record.tags)) errors.push('Record tags must be an array.');
    if (!Array.isArray(record.relationships)) errors.push('Record relationships must be an array.');
    if (!Array.isArray(record.sources)) errors.push('Record sources must be an array.');
    if (!Array.isArray(record.media)) errors.push('Record media must be an array.');
    if (!Array.isArray(record.notes)) errors.push('Record notes must be an array.');
    if (!record.metadata || record.metadata.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`Record schemaVersion must equal ${SCHEMA_VERSION}.`);
    }
    if (!CONFIDENCE_LEVELS.includes(record.metadata?.confidence)) {
      errors.push(`Unsupported confidence: ${record.metadata?.confidence}`);
    }
    return errors;
  }

  function assertRecord(record) {
    const errors = validateRecord(record);
    if (errors.length) throw new Error(`Invalid CuratorOS record: ${errors.join(' ')}`);
    return record;
  }

  function createDatabase(records = []) {
    const database = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now(),
      records: list(records).map(record => createRecord(record))
    };
    assertDatabase(database);
    return database;
  }

  function validateDatabase(database) {
    const errors = [];
    if (!database || typeof database !== 'object') return ['Database must be an object.'];
    if (database.schemaVersion !== SCHEMA_VERSION) errors.push(`Database schemaVersion must equal ${SCHEMA_VERSION}.`);
    if (!Array.isArray(database.records)) return [...errors, 'Database records must be an array.'];

    const seen = new Set();
    database.records.forEach((record, index) => {
      validateRecord(record).forEach(error => errors.push(`records[${index}]: ${error}`));
      if (seen.has(record.id)) errors.push(`Duplicate record id: ${record.id}`);
      seen.add(record.id);
    });
    return errors;
  }

  function assertDatabase(database) {
    const errors = validateDatabase(database);
    if (errors.length) throw new Error(`Invalid CuratorOS database: ${errors.join(' ')}`);
    return database;
  }

  function indexById(database) {
    assertDatabase(database);
    return new Map(database.records.map(record => [record.id, record]));
  }

  return {
    SCHEMA_VERSION,
    RECORD_TYPES,
    RECORD_STATUSES,
    CONFIDENCE_LEVELS,
    createRecord,
    validateRecord,
    assertRecord,
    createDatabase,
    validateDatabase,
    assertDatabase,
    indexById,
    clone
  };
})();