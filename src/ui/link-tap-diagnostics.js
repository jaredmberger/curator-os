const STORAGE_KEY = 'curatoros.linkTapDiagnostics.v1';

export function installLinkTapDiagnostics(root) {
  if (!root) return { destroy() {} };

  const log = [];
  const record = (type, event, target) => {
    const entry = {
      at: new Date().toISOString(),
      type,
      defaultPrevented: Boolean(event?.defaultPrevented),
      target: target?.tagName || '',
      text: target?.textContent?.trim()?.slice(0, 120) || '',
      href: target?.href || target?.dataset?.navigationUrl || target?.dataset?.suiteUrl || '',
      pointerEvents: target ? getComputedStyle(target).pointerEvents : '',
      visibility: target ? getComputedStyle(target).visibility : '',
      display: target ? getComputedStyle(target).display : ''
    };
    log.push(entry);
    while (log.length > 40) log.shift();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)); } catch {}
    console.info('[CuratorOS link diagnostics]', entry);
  };

  const findLinkTarget = (event) => event.target?.closest?.('a[href], [data-navigation-url], [data-suite-url]') || null;

  const pointerHandler = (event) => {
    const target = findLinkTarget(event);
    if (target) record(event.type, event, target);
  };

  const clickHandler = (event) => {
    const target = findLinkTarget(event);
    if (!target) return;
    record('click-capture', event, target);

    if (target.matches('a[href]')) {
      const href = target.href;
      if (!href) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = href;
    }
  };

  document.addEventListener('pointerdown', pointerHandler, true);
  document.addEventListener('pointerup', pointerHandler, true);
  document.addEventListener('touchstart', pointerHandler, true);
  document.addEventListener('touchend', pointerHandler, true);
  document.addEventListener('click', clickHandler, true);

  return {
    destroy() {
      document.removeEventListener('pointerdown', pointerHandler, true);
      document.removeEventListener('pointerup', pointerHandler, true);
      document.removeEventListener('touchstart', pointerHandler, true);
      document.removeEventListener('touchend', pointerHandler, true);
      document.removeEventListener('click', clickHandler, true);
    }
  };
}
