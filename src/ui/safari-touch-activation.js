const INTERACTIVE_SELECTOR = 'a[href], button:not([disabled]), select, input[type="search"], input[type="text"]';
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
    gesture = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      startedAt: performance.now()
    };
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
    const control = findControl(hit) || findControl(event.target);
    if (!control) return;

    if (isNativeFormControl(control)) {
      event.preventDefault();
      routeNativeFormControl(control, root);
      return;
    }

    event.preventDefault();
    suppressTrustedClick = { control, until: performance.now() + 900 };

    if (control instanceof HTMLAnchorElement) {
      window.location.assign(control.href);
      return;
    }

    if (openImportPicker(control, root)) return;
    if (runApplicationAction(control, root)) return;

    control.click();
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

function runApplicationAction(control, root) {
  if (control.matches('[data-workspace-mode]')) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-workspace', {
      detail: { mode: control.dataset.workspaceMode || 'operations' }
    }));
    return true;
  }

  if (control.matches('[data-worker-view]')) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-view', {
      detail: { view: control.dataset.workerView || 'dashboard' }
    }));
    return true;
  }

  if (control.matches('[data-finding-collapse]')) {
    const card = control.closest('.cos-worker-finding');
    const body = card?.querySelector('[data-finding-body]');
    if (!card || !body) return false;
    const collapsed = card.dataset.collapsed === 'true';
    card.dataset.collapsed = collapsed ? 'false' : 'true';
    body.hidden = !collapsed;
    control.textContent = collapsed ? 'Collapse' : 'Expand';
    control.setAttribute('aria-expanded', String(collapsed));
    return true;
  }

  if (control.matches('[data-findings-collapse-all]')) {
    root.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, true));
    return true;
  }

  if (control.matches('[data-findings-expand-all]')) {
    root.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, false));
    return true;
  }

  if (control.matches('[data-finding-action]')) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-finding-action', {
      detail: {
        action: control.dataset.findingAction || '',
        id: control.dataset.findingId || ''
      }
    }));
    return true;
  }

  if (control.matches('[data-finding-open]')) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-open-record', {
      detail: { id: control.dataset.findingOpen || '' }
    }));
    return true;
  }

  if (control.matches('[data-worker-command]')) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-command'));
    return true;
  }

  if (control.matches('[data-worker-backup]')) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-backup'));
    return true;
  }

  return false;
}

function isNativeFormControl(control) {
  return control instanceof HTMLSelectElement ||
    (control instanceof HTMLInputElement && ['search', 'text'].includes(control.type));
}

function routeNativeFormControl(control, root) {
  if (control instanceof HTMLInputElement) {
    control.focus({ preventScroll: true });
    root.dispatchEvent(new CustomEvent('curatoros:safari-filter-focus', {
      detail: { type: control.type }
    }));
    return;
  }

  if (control instanceof HTMLSelectElement) {
    control.focus({ preventScroll: true });
    root.dispatchEvent(new CustomEvent('curatoros:safari-select-open', {
      detail: {
        filter: control.hasAttribute('data-findings-category') ? 'category' : 'severity'
      }
    }));
    control.click();
  }
}

function setFindingCollapsed(card, collapsed) {
  const body = card.querySelector('[data-finding-body]');
  const button = card.querySelector('[data-finding-collapse]');
  if (!body) return;
  card.dataset.collapsed = collapsed ? 'true' : 'false';
  body.hidden = collapsed;
  if (button) {
    button.textContent = collapsed ? 'Expand' : 'Collapse';
    button.setAttribute('aria-expanded', String(!collapsed));
  }
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
