const CuratorRelationships = (() => {
  const CONFIDENCE_LEVELS = CuratorDatabase.CONFIDENCE_LEVELS;

  function create(input = {}) {
    const relationship = {
      target: typeof input.target === 'string' ? input.target.trim() : '',
      relationship: typeof input.relationship === 'string' ? input.relationship.trim() : '',
      confidence: CONFIDENCE_LEVELS.includes(input.confidence) ? input.confidence : 'unknown',
      sourceIds: Array.isArray(input.sourceIds) ? [...new Set(input.sourceIds.filter(Boolean))] : [],
      note: typeof input.note === 'string' ? input.note.trim() : ''
    };
    assert(relationship);
    return relationship;
  }

  function validate(relationship) {
    const errors = [];
    if (!relationship || typeof relationship !== 'object') return ['Relationship must be an object.'];
    if (!relationship.target) errors.push('Relationship target is required.');
    if (!relationship.relationship) errors.push('Relationship type is required.');
    if (!CONFIDENCE_LEVELS.includes(relationship.confidence)) {
      errors.push(`Unsupported relationship confidence: ${relationship.confidence}`);
    }
    if (!Array.isArray(relationship.sourceIds)) errors.push('Relationship sourceIds must be an array.');
    return errors;
  }

  function assert(relationship) {
    const errors = validate(relationship);
    if (errors.length) throw new Error(`Invalid relationship: ${errors.join(' ')}`);
    return relationship;
  }

  function validateIntegrity(database) {
    CuratorDatabase.assertDatabase(database);
    const ids = CuratorDatabase.indexById(database);
    const errors = [];

    database.records.forEach(record => {
      record.relationships.forEach((raw, index) => {
        const relationshipErrors = validate(raw);
        relationshipErrors.forEach(error => errors.push(`${record.id}.relationships[${index}]: ${error}`));
        if (raw.target === record.id) errors.push(`${record.id} contains a self-relationship.`);
        if (raw.target && !ids.has(raw.target)) errors.push(`${record.id} points to missing record ${raw.target}.`);
      });
    });
    return errors;
  }

  function assertIntegrity(database) {
    const errors = validateIntegrity(database);
    if (errors.length) throw new Error(`Relationship integrity failed: ${errors.join(' ')}`);
    return database;
  }

  function incoming(database, targetId) {
    CuratorDatabase.assertDatabase(database);
    return database.records.flatMap(record =>
      record.relationships
        .filter(relationship => relationship.target === targetId)
        .map(relationship => ({ source: record.id, ...CuratorDatabase.clone(relationship) }))
    );
  }

  return { create, validate, assert, validateIntegrity, assertIntegrity, incoming };
})();
