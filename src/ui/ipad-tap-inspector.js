const DISPLAY_ID = 'curatoros-ipad-tap-inspector';
const EVENTS = ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'curatoros:safari-workspace', 'curatoros:safari-view'];

export function installIpadTapInspector(root = document.querySelector('#curatoros-preview')) {
  if (!root || document.getElementById(DISPLAY_ID)) return { destroy() {} };

  const display = document.createElement('div');
  display.id = DISPLAY_ID;
  display.setAttribute('role', 'status');
  display.setAttribute('aria-live', 'polite');
  Object.assign(display.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: '2147483647',
    maxWidth: 'calc(100vw - 16px)',
    padding: '8px 10px',
    border: '1px solid #bfa46a',
    borderRadius: '8px',
    background: 'rgba(5,12,10,.97)',
    color: '#fff',
    font: '600 11px/1.35 system-ui,-apple-system,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'normal'
  });
  display.textContent = 'Tap inspector ready — tap Guided Session, then a Collapse button.';
  document.body.append(display);

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
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    const x = Number(point.clientX || 0);
    const y = Number(point.clientY || 0);
    const hit = Number.isFinite(x) && Number.isFinite(y) ? document.elementFromPoint(x, y) : null;
    const target = event.target;
    const control = target instanceof Element ? target.closest('a[href],button:not([disabled])') : null;
    const detail = event.detail && typeof event.detail === 'object' ? JSON.stringify(event.detail) : '';
    const text = `${event.type} | target:${describe(target)} | control:${describe(control)} | hit:${describe(hit)}${detail ? ` | detail:${detail}` : ''}`;
    display.textContent = text;
    try { localStorage.setItem('curatoros.ipadTapInspector.latest', text); } catch {}
  };

  const touchOptions = { capture: true, passive: true };
  document.addEventListener('touchstart', report, touchOptions);
  document.addEventListener('touchend', report, touchOptions);
  document.addEventListener('pointerdown', report, true);
  document.addEventListener('pointerup', report, true);
  document.addEventListener('click', report, true);
  root.addEventListener('curatoros:safari-workspace', report, true);
  root.addEventListener('curatoros:safari-view', report, true);

  return {
    destroy() {
      document.removeEventListener('touchstart', report, touchOptions);
      document.removeEventListener('touchend', report, touchOptions);
      document.removeEventListener('pointerdown', report, true);
      document.removeEventListener('pointerup', report, true);
      document.removeEventListener('click', report, true);
      root.removeEventListener('curatoros:safari-workspace', report, true);
      root.removeEventListener('curatoros:safari-view', report, true);
      display.remove();
    }
  };
}
