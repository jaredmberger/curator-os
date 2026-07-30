const CONTROL_SELECTOR = 'button:not([disabled]), a[href], input, select, textarea';
const NATIVE_FORM_SELECTOR = 'input, select, textarea';

export function installSafariTouchActivation(root) {
  if (!root || !isIpadSafari()) return { destroy() {} };

  const onTouchEnd = (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const hit = document.elementFromPoint(touch.clientX, touch.clientY);
    const control = hit instanceof Element ? hit.closest(CONTROL_SELECTOR) : null;
    if (!control || !root.contains(control)) return;

    // Preserve native focus, keyboard, select menus, and text editing.
    if (control.matches(NATIVE_FORM_SELECTOR)) return;

    // File pickers must be opened directly from the trusted touch gesture.
    if (openImportPicker(control, root)) {
      event.preventDefault();
      return;
    }

    // Route every CuratorOS application button explicitly. iPad Safari is not
    // reliably producing the delegated click that the desktop path expects.
    if (control instanceof HTMLButtonElement) {
      event.preventDefault();
      root.dispatchEvent(new CustomEvent('curatoros:safari-control', {
        detail: { control }
      }));
      return;
    }

    // Navigate anchors directly from the trusted gesture.
    if (control instanceof HTMLAnchorElement) {
      event.preventDefault();
      if (control.target === '_blank') window.open(control.href, '_blank', 'noopener');
      else window.location.assign(control.href);
    }
  };

  root.addEventListener('touchend', onTouchEnd, { passive: false });

  return {
    destroy() {
      root.removeEventListener('touchend', onTouchEnd);
    }
  };
}

function openImportPicker(control, root) {
  const toolImport = control.closest('[data-tool-import]');
  if (toolImport) {
    const input = root.querySelector('[data-findings-import-file]');
    if (!(input instanceof HTMLInputElement)) return false;
    const source = toolImport.dataset.toolImport || '';
    input.dataset.requestedSource = source;
    input.accept = toolAccept(source);
    input.click();
    return true;
  }

  if (control.closest('[data-findings-import]')) {
    const input = root.querySelector('[data-findings-import-file]');
    if (!(input instanceof HTMLInputElement)) return false;
    input.dataset.requestedSource = '';
    input.accept = '.json,.csv,application/json,text/csv';
    input.click();
    return true;
  }

  if (control.closest('[data-catalog-import]')) {
    const input = root.querySelector('[data-catalog-import-file]');
    if (!(input instanceof HTMLInputElement)) return false;
    input.click();
    return true;
  }

  if (control.closest('[data-import-data]')) {
    const input = root.querySelector('[data-import-file]');
    if (!(input instanceof HTMLInputElement)) return false;
    input.click();
    return true;
  }

  return false;
}

function toolAccept(source) {
  if (source === 'site-health') return '.csv,text/csv';
  if (source === 'indexer' || source === 'speed') return '.json,application/json';
  return '.json,.csv,application/json,text/csv';
}

function isIpadSafari() {
  const ua = navigator.userAgent || '';
  const ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(ua);
  return ipad && safari;
}

const root = document.querySelector('#curatoros-preview');
if (root) installSafariTouchActivation(root);
