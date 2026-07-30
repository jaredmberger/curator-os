const DISPLAY_ID = 'curatoros-ipad-tap-inspector';
const TOGGLE_ID = 'curatoros-ipad-tap-inspector-toggle';
const STORAGE_KEY = 'curatoros.ipadTapInspector.enabled';
const LATEST_KEY = 'curatoros.ipadTapInspector.latest';

export function installIpadTapInspector(root = document.querySelector('#curatoros-preview')) {
  if (!root) return { destroy() {} };

  let enabled = readEnabled();
  let display = null;
  let listenersAttached = false;

  const toggle = document.createElement('button');
  toggle.id = TOGGLE_ID;
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', String(enabled));
  Object.assign(toggle.style, {
    position: 'fixed',
    right: '10px',
    bottom: '10px',
    zIndex: '2147483647',
    padding: '7px 10px',
    border: '1px solid #bfa46a',
    borderRadius: '999px',
    background: 'rgba(5,12,10,.96)',
    color: '#fff',
    font: '600 11px/1 system-ui,-apple-system,sans-serif'
  });

  const describe = (value) => {
    if (!(value instanceof Element)) return String(value?.nodeName || 'unknown');
    const id = value.id ? `#${value.id}` : '';
    const classes = [...value.classList].slice(0, 3).map((name) => `.${name}`).join('');
    const data = [...value.attributes]
      .filter((attribute) => attribute.name.startsWith('data-'))
      .slice(0, 3)
      .map((attribute) => `[${attribute.name}${attribute.value ? `=${attribute.value}` : ''}]`)
      .join('');
    return `${value.tagName.toLowerCase()}${id}${classes}${data}`;
  };

  const report = (event) => {
    if (!enabled || !display) return;
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    const x = Number(point.clientX || 0);
    const y = Number(point.clientY || 0);
    const hit = Number.isFinite(x) && Number.isFinite(y) ? document.elementFromPoint(x, y) : null;
    const target = event.target;
    const control = target instanceof Element ? target.closest('a[href],button:not([disabled])') : null;
    const detail = event.detail && typeof event.detail === 'object' ? JSON.stringify(event.detail) : '';
    const text = `${event.type} | target:${describe(target)} | control:${describe(control)} | hit:${describe(hit)}${detail ? ` | detail:${detail}` : ''}`;
    display.textContent = text;
    try { localStorage.setItem(LATEST_KEY, text); } catch {}
  };

  const touchOptions = { capture: true, passive: true };

  const attach = () => {
    if (listenersAttached) return;
    listenersAttached = true;
    document.addEventListener('touchstart', report, touchOptions);
    document.addEventListener('touchend', report, touchOptions);
    document.addEventListener('pointerdown', report, true);
    document.addEventListener('pointerup', report, true);
    document.addEventListener('click', report, true);
    root.addEventListener('curatoros:safari-workspace', report, true);
    root.addEventListener('curatoros:safari-view', report, true);
  };

  const detach = () => {
    if (!listenersAttached) return;
    listenersAttached = false;
    document.removeEventListener('touchstart', report, touchOptions);
    document.removeEventListener('touchend', report, touchOptions);
    document.removeEventListener('pointerdown', report, true);
    document.removeEventListener('pointerup', report, true);
    document.removeEventListener('click', report, true);
    root.removeEventListener('curatoros:safari-workspace', report, true);
    root.removeEventListener('curatoros:safari-view', report, true);
  };

  const sync = () => {
    toggle.textContent = enabled ? 'Touch debug: On' : 'Touch debug: Off';
    toggle.setAttribute('aria-pressed', String(enabled));
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false'); } catch {}

    if (enabled) {
      if (!display) {
        display = document.createElement('div');
        display.id = DISPLAY_ID;
        display.setAttribute('role', 'status');
        display.setAttribute('aria-live', 'polite');
        Object.assign(display.style, {
          position: 'fixed',
          left: '8px',
          right: '8px',
          bottom: '48px',
          zIndex: '2147483646',
          padding: '8px 10px',
          border: '1px solid #bfa46a',
          borderRadius: '8px',
          background: 'rgba(5,12,10,.97)',
          color: '#fff',
          font: '600 11px/1.35 system-ui,-apple-system,sans-serif',
          pointerEvents: 'none',
          whiteSpace: 'normal'
        });
        display.textContent = localStorage.getItem(LATEST_KEY) || 'Touch inspector ready — tap a control.';
        document.body.append(display);
      }
      attach();
    } else {
      detach();
      display?.remove();
      display = null;
    }
  };

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    sync();
  });

  document.body.append(toggle);
  sync();

  return {
    destroy() {
      detach();
      display?.remove();
      toggle.remove();
    }
  };
}

function readEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
}
