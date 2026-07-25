import { fingerprintDatabase, SyncComparison } from '../core/sync-state.js';

const LABELS = {
  [SyncComparison.EQUAL]: 'Up to date',
  [SyncComparison.LOCAL_AHEAD]: 'Local changes ready',
  [SyncComparison.REMOTE_AHEAD]: 'Remote copy available',
  [SyncComparison.DIVERGED]: 'Conflict requires review',
  [SyncComparison.UNRELATED]: 'Choose a starting copy'
};

export function installSyncStatus(root, context) {
  const { recordService, provider, storage = globalThis.localStorage } = context;
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh: async () => null, destroy() {} };

  toolbar.insertAdjacentHTML('beforeend', `
    <span class="cos-sync-status" data-sync-status>Local only</span>
    <button type="button" data-sync-connect>Connect sync</button>
    <button type="button" data-sync-check disabled>Check sync</button>
    <button type="button" data-sync-upload disabled>Upload local</button>
  `);

  const status = toolbar.querySelector('[data-sync-status]');
  const connect = toolbar.querySelector('[data-sync-connect]');
  const check = toolbar.querySelector('[data-sync-check]');
  const upload = toolbar.querySelector('[data-sync-upload]');
  let connected = false;

  function database() { return recordService.snapshot(); }
  function metadata() {
    try { return JSON.parse(storage?.getItem?.('curatoros.sync.metadata') || '{}'); }
    catch { return {}; }
  }
  function saveMetadata(envelope) {
    storage?.setItem?.('curatoros.sync.metadata', JSON.stringify({
      provider: 'local-mock',
      databaseId: envelope.databaseId,
      lastRevision: envelope.revision,
      lastSyncedAt: new Date().toISOString(),
      lastLocalFingerprint: fingerprintDatabase(database())
    }));
  }

  async function refresh() {
    if (!connected) {
      status.textContent = 'Local only';
      check.disabled = true;
      upload.disabled = true;
      return null;
    }
    const result = await provider.compare(database(), metadata());
    status.textContent = LABELS[result.comparison] || result.comparison;
    check.disabled = false;
    upload.disabled = result.comparison === SyncComparison.REMOTE_AHEAD || result.comparison === SyncComparison.DIVERGED;
    return result;
  }

  connect.addEventListener('click', async () => {
    if (connected) {
      await provider.disconnect();
      connected = false;
      connect.textContent = 'Connect sync';
    } else {
      await provider.connect();
      connected = true;
      connect.textContent = 'Disconnect';
    }
    await refresh();
  });

  check.addEventListener('click', refresh);
  upload.addEventListener('click', async () => {
    const envelope = await provider.push(database());
    saveMetadata(envelope);
    await refresh();
  });

  return { refresh, destroy() {} };
}
