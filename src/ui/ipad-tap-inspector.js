const DISPLAY_ID = 'curatoros-ipad-tap-inspector';

export function installIpadTapInspector() {
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
    background: 'rgba(5,12,10,.96)',
    color: '#fff',
    font: '600 11px/1.35 system-ui,-apple-system,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'normal'
  });
  display.textContent = 'Tap inspector ready — tap a broken control.';
  document.body.append(display);

  const describe = (element) => {
    if (!(element instanceof Element)) return String(element?.nodeName || 'unknown');
    const id = element.id ? `#${element.id}` : '';
    const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
    const data = [...element.attributes]
      .filter((attribute) => attribute.name.startsWith('data-'))
      .slice(0, 2)
      .map((attribute) => `[${attribute.name}${attribute.value ? `=${attribute.value}` : ''}]`)
      .join('');
    return `${element.tagName.toLowerCase()}${id}${classes}${data}`;
  };

  const report = (event) => {
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    const x = Number(point.clientX || 0);
    const y = Number(point.clientY || 0);
    const hit = document.elementFromPoint(x, y);
    const target = event.target;
    const path = typeof event.composedPath === 'function'
      ? event.composedPath().filter((item) => item instanceof Element).slice(0, 4).map(describe).join(' > ')
      : '';
    const text = `${event.type} | target: ${describe(target)} | hit: ${describe(hit)}${path ? ` | path: ${path}` : ''}`;
    display.textContent = text;
    try { localStorage.setItem('curatoros.ipadTapInspector.latest', text); } catch {}
  };

  const options = { capture: true, passive: true };
  document.addEventListener('touchstart', report, options);
  document.addEventListener('pointerdown', report, options);
  document.addEventListener('click', report, true);

  return {
    destroy() {
      document.removeEventListener('touchstart', report, options);
      document.removeEventListener('pointerdown', report, options);
      document.removeEventListener('click', report, true);
      display.remove();
    }
  };
}
