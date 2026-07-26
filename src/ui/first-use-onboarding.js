export function buildStorageDiagnostics(recordService, storage = globalThis.localStorage) {
  const records = recordService?.all?.() || [];
  let storageAvailable = false;
  let storageBytes = 0;
  try {
    const probe = 'curatoros.storage-probe';
    storage?.setItem?.(probe, 'ok');
    storageAvailable = storage?.getItem?.(probe) === 'ok';
    storage?.removeItem?.(probe);
    storageBytes = new Blob([JSON.stringify(records)]).size;
  } catch {
    storageAvailable = false;
  }
  return {
    storageAvailable,
    recordCount: records.length,
    storageBytes,
    hasSnapshot: Boolean(storage?.getItem?.('curatoros.snapshot.latest')),
    hasPreImportSnapshot: Boolean(storage?.getItem?.('curatoros.snapshot.before-import'))
  };
}

export function renderFirstUseOnboarding(diagnostics) {
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-first-use-dialog><div class="cos-authoring-form"><header><div><span class="cos-eyebrow">Welcome aboard</span><h2>CuratorOS local-first alpha</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header><p class="cos-authoring-help">Your canonical catalog is stored in this browser. Use Export and Snapshot regularly, especially before imports or major changes.</p><section><h3>Start cataloging</h3><p>Create a ship, builder, shipping line, source, reference object, or media record from the toolbar. Use Review before generating publication output.</p></section><section><h3>Data protection</h3><ul><li>Browser storage: ${diagnostics.storageAvailable ? 'available' : 'unavailable'}</li><li>Canonical records: ${diagnostics.recordCount}</li><li>Approximate catalog size: ${diagnostics.storageBytes} bytes</li><li>Latest manual snapshot: ${diagnostics.hasSnapshot ? 'available' : 'not yet created'}</li><li>Pre-import recovery snapshot: ${diagnostics.hasPreImportSnapshot ? 'available' : 'not yet created'}</li></ul></section><section><h3>Current boundaries</h3><p>Cloud synchronization uses a local mock provider. Generated page packages are downloaded for review and are not deployed automatically.</p></section><footer><button type="button" data-dismiss-first-use>Got it</button></footer></div></dialog>`;
}

export function installFirstUseOnboarding(root, context) {
  const storage = context.storage || globalThis.localStorage;
  const key = context.storageKey || 'curatoros.onboarding.complete';
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-first-use>Guide</button>');

  function mount() {
    root.querySelector('[data-first-use-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderFirstUseOnboarding(buildStorageDiagnostics(context.recordService, storage)));
  }
  function open() {
    mount();
    root.querySelector('[data-first-use-dialog]')?.showModal();
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-first-use]')) { open(); return; }
    if (event.target.closest('[data-dismiss-first-use]')) {
      storage?.setItem?.(key, 'true');
      event.target.closest('dialog')?.close();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  if (storage?.getItem?.(key) !== 'true') queueMicrotask(open);
  return { destroy() { root.querySelector('[data-open-first-use]')?.remove(); root.querySelector('[data-first-use-dialog]')?.remove(); } };
}
