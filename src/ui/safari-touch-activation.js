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

    if (openImportPicker(completed.control, root)) return;
    if (runApplicationAction(completed.control, root)) return;

    completed.control.click();
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
  const workspace = control.closest('[data-workspace-mode]');
  if (workspace) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-workspace', {
      bubbles: true,
      detail: { mode: workspace.dataset.workspaceMode || 'operations' }
    }));
    return true;
  }

  const view = control.closest('[data-worker-view]');
  if (view) {
    root.dispatchEvent(new CustomEvent('curatoros:safari-view', {
      bubbles: true,
      detail: { view: view.dataset.workerView || 'dashboard' }
    }));
    return true;
  }

  const collapse = control.closest('[data-finding-collapse]');
  if (collapse) {
    const card = collapse.closest('.cos-worker-finding');
    const body = card?.querySelector('[data-finding-body]');
    if (!card || !body) return false;
    const collapsed = card.dataset.collapsed === 'true';
    card.dataset.collapsed = collapsed ? 'false' : 'true';
    body.hidden = !collapsed;
    collapse.textContent = collapsed ? 'Collapse' : 'Expand';
    collapse.setAttribute('aria-expanded', String(collapsed));
    return true;
  }

  if (control.closest('[data-findings-collapse-all]')) {
    root.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, true));
    return true;
  }

  if (control.closest('[data-findings-expand-all]')) {
    root.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, false));
    return true;
  }

  return false;
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
