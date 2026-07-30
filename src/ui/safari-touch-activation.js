const INTERACTIVE_SELECTOR = 'a[href], button:not([disabled])';
const MAX_TAP_DISTANCE = 14;
const MAX_TAP_DURATION = 800;

export function installSafariTouchActivation(root) {
  if (!root || !isIpadSafari()) return { destroy() {} };

  let gesture = null;
  let suppressTrustedClick = null;

  const findControl = (target) => {
    const control = target instanceof Element ? target.closest(INTERACTIVE_SELECTOR) : null;
    if (!control || !root.contains(control)) return null;
    return control;
  };

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) {
      gesture = null;
      return;
    }
    const touch = event.touches[0];
    const control = findControl(event.target);
    gesture = control ? {
      control,
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      startedAt: performance.now()
    } : null;
  };

  const onTouchMove = (event) => {
    if (!gesture) return;
    const touch = [...event.touches].find((item) => item.identifier === gesture.identifier);
    if (!touch) return;
    if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > MAX_TAP_DISTANCE) gesture = null;
  };

  const onTouchEnd = (event) => {
    if (!gesture) return;
    const completed = gesture;
    gesture = null;

    const touch = [...event.changedTouches].find((item) => item.identifier === completed.identifier);
    if (!touch) return;
    if (performance.now() - completed.startedAt > MAX_TAP_DURATION) return;
    if (Math.hypot(touch.clientX - completed.x, touch.clientY - completed.y) > MAX_TAP_DISTANCE) return;

    const hit = document.elementFromPoint(touch.clientX, touch.clientY);
    const endingControl = findControl(hit);
    if (endingControl !== completed.control) return;

    event.preventDefault();
    suppressTrustedClick = { control: completed.control, until: performance.now() + 900 };

    if (completed.control instanceof HTMLAnchorElement) {
      window.location.assign(completed.control.href);
      return;
    }

    // File pickers must be opened directly from the trusted touchend event.
    // Calling button.click() first creates an untrusted synthetic click, and
    // iPad Safari then refuses the nested hidden-input click used by Import.
    if (openImportPicker(completed.control, root)) return;

    // Dispatch a composed, bubbling application click so delegated handlers in
    // the CuratorOS shell receive sidebar, collapse, filter, and workflow taps.
    completed.control.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    }));
  };

  const onClickCapture = (event) => {
    if (!suppressTrustedClick || performance.now() > suppressTrustedClick.until) {
      suppressTrustedClick = null;
      return;
    }
    if (event.isTrusted && event.target instanceof Element && suppressTrustedClick.control.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressTrustedClick = null;
    }
  };

  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchmove', onTouchMove, { passive: true });
  root.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('click', onClickCapture, true);

  return {
    destroy() {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('click', onClickCapture, true);
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
