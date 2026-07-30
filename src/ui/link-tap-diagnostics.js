const STORAGE_KEY = 'curatoros.linkTapDiagnostics.v1';

export function installLinkTapDiagnostics(root) {
  if (!root) return { destroy() {} };

  const log = [];
  let touchStart = null;
  let touchNavigatedAt = 0;

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
  const hrefFor = (target) => target?.href || target?.dataset?.navigationUrl || target?.dataset?.suiteUrl || '';

  const pointerHandler = (event) => {
    const target = findLinkTarget(event);
    if (target) record(event.type, event, target);
  };

  const touchStartHandler = (event) => {
    const target = findLinkTarget(event);
    if (!target) {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches?.[0];
    touchStart = {
      target,
      href: hrefFor(target),
      x: touch?.clientX ?? 0,
      y: touch?.clientY ?? 0,
      at: Date.now()
    };
    record('touchstart', event, target);
  };

  const touchEndHandler = (event) => {
    const target = findLinkTarget(event) || touchStart?.target || null;
    if (!target) return;
    record('touchend', event, target);

    const touch = event.changedTouches?.[0];
    const elapsed = Date.now() - (touchStart?.at || 0);
    const moved = touchStart && touch
      ? Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y)
      : 0;
    const href = hrefFor(target) || touchStart?.href || '';

    if (!href || !touchStart || elapsed > 1200 || moved > 18) {
      touchStart = null;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    touchNavigatedAt = Date.now();
    touchStart = null;
    window.location.href = href;
  };

  const clickHandler = (event) => {
    const target = findLinkTarget(event);
    if (!target) return;
    record('click-capture', event, target);

    if (Date.now() - touchNavigatedAt < 1500) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const href = hrefFor(target);
    if (!href) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = href;
  };

  document.addEventListener('pointerdown', pointerHandler, true);
  document.addEventListener('pointerup', pointerHandler, true);
  document.addEventListener('touchstart', touchStartHandler, { capture: true, passive: true });
  document.addEventListener('touchend', touchEndHandler, { capture: true, passive: false });
  document.addEventListener('click', clickHandler, true);

  return {
    destroy() {
      document.removeEventListener('pointerdown', pointerHandler, true);
      document.removeEventListener('pointerup', pointerHandler, true);
      document.removeEventListener('touchstart', touchStartHandler, true);
      document.removeEventListener('touchend', touchEndHandler, true);
      document.removeEventListener('click', clickHandler, true);
    }
  };
}
