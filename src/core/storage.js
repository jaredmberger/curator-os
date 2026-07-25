const CuratorStorage = (() => {
  const DEFAULT_KEY = 'curatoros.database';

  function migrate(payload) {
    if (!payload || typeof payload !== 'object') {
      return CuratorDatabase.createDatabase();
    }

    if (!payload.schemaVersion) {
      const legacyRecords = Array.isArray(payload) ? payload : payload.records || [];
      return CuratorDatabase.createDatabase(legacyRecords);
    }

    if (payload.schemaVersion > CuratorDatabase.SCHEMA_VERSION) {
      throw new Error(`Database schema ${payload.schemaVersion} is newer than CuratorOS supports.`);
    }

    return CuratorDatabase.createDatabase(payload.records || []);
  }

  function serialize(database) {
    CuratorDatabase.assertDatabase(database);
    return JSON.stringify({
      ...CuratorDatabase.clone(database),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  function deserialize(serialized) {
    if (typeof serialized !== 'string' || !serialized.trim()) {
      return CuratorDatabase.createDatabase();
    }
    return migrate(JSON.parse(serialized));
  }

  function load(storage = globalThis.localStorage, key = DEFAULT_KEY) {
    if (!storage || typeof storage.getItem !== 'function') {
      return CuratorDatabase.createDatabase();
    }
    return deserialize(storage.getItem(key));
  }

  function save(database, storage = globalThis.localStorage, key = DEFAULT_KEY) {
    if (!storage || typeof storage.setItem !== 'function') {
      throw new Error('A Storage-compatible adapter is required.');
    }
    const serialized = serialize(database);
    storage.setItem(key, serialized);
    return serialized;
  }

  function download(database, filename = 'curatoros-database.json') {
    const blob = new Blob([serialize(database)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return { DEFAULT_KEY, migrate, serialize, deserialize, load, save, download };
})();
