import { fingerprintDatabase, SyncComparison } from '../core/sync-state.js';
import { resolveSyncComparison, applyConflictChoice } from './sync-resolution.js';

const LABELS = {
  [SyncComparison.EQUAL]: 'Up to date',
  [SyncComparison.LOCAL_AHEAD]: 'Local changes ready',
  [SyncComparison.REMOTE_AHEAD]: 'Remote copy available',
  [SyncComparison.DIVERGED]: 'Conflict requires review',
  [SyncComparison.UNRELATED]: 'Choose a starting copy'
};

export function installSyncStatus(root, context) {
  const { recordService, provider, storage = globalThis.localStorage, onDatabaseReplaced, downloadJson = defaultDownloadJson } = context;
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh: async () => null, destroy() {} };

  toolbar.insertAdjacentHTML('beforeend', `
    <span class="cos-sync-status" data-sync-status>Local only</span>
    <button type="button" data-sync-connect>Connect sync</button>
    <button type="button" data-sync-check disabled>Check sync</button>
    <button type="button" data-sync-upload disabled>Upload local</button>
    <button type="button" data-sync-download disabled>Download remote</button>
    <button type="button" data-sync-resolve disabled>Resolve conflict</button>
  `);

  const status = toolbar.querySelector('[data-sync-status]');
  const connect = toolbar.querySelector('[data-sync-connect]');
  const check = toolbar.querySelector('[data-sync-check]');
  const upload = toolbar.querySelector('[data-sync-upload]');
  const download = toolbar.querySelector('[data-sync-download]');
  const resolve = toolbar.querySelector('[data-sync-resolve]');
  let connected = false;
  let lastResult = null;

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
      download.disabled = true;
      resolve.disabled = true;
      lastResult = null;
      return null;
    }
    lastResult = await provider.compare(database(), metadata());
    status.textContent = LABELS[lastResult.comparison] || lastResult.comparison;
    check.disabled = false;
    upload.disabled = lastResult.comparison === SyncComparison.REMOTE_AHEAD || lastResult.comparison === SyncComparison.DIVERGED;
    download.disabled = lastResult.comparison !== SyncComparison.REMOTE_AHEAD;
    resolve.disabled = ![SyncComparison.DIVERGED, SyncComparison.UNRELATED].includes(lastResult.comparison);
    return lastResult;
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
  download.addEventListener('click', async () => {
    const result = lastResult || await refresh();
    if (!result) return;
    const resolution = resolveSyncComparison({
      comparison: result.comparison,
      localDatabase: database(),
      remoteEnvelope: result.remoteEnvelope,
      recordService,
      storage
    });
    if (resolution.action === 'used-remote') {
      saveMetadata(result.remoteEnvelope);
      onDatabaseReplaced?.();
      await refresh();
    }
  });
  resolve.addEventListener('click', async () => {
    const result = lastResult || await refresh();
    if (!result?.remoteEnvelope) return;
    const choice = prompt('Choose conflict action: keep-local, use-remote, or export-both', 'export-both');
    if (!choice) return;
    const resolution = applyConflictChoice({
      choice: choice.trim(),
      localDatabase: database(),
      remoteEnvelope: result.remoteEnvelope,
      recordService,
      storage,
      downloadJson
    });
    if (resolution.action === 'used-remote') {
      saveMetadata(result.remoteEnvelope);
      onDatabaseReplaced?.();
    }
    await refresh();
  });

  return { refresh, destroy() {} };
}

function defaultDownloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
