export function installSafariGlobalTapRepair(root) {
  if (!root) return { destroy() {} };

  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  if (!isSafari) return { destroy() {} };

  const findControl = (target) => target?.closest?.('button, a[href], input, select, textarea, summary, [role="button"]');

  const handlePointerUp = (event) => {
    const control = findControl(event.target);
    if (!control || !root.contains(control)) return;
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') return;

    const isExternalLink = control.matches('a[href]') && new URL(control.href, location.href).origin !== location.origin;
    if (isExternalLink) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(control.href);
      return;
    }

    if (control.matches('button, [role="button"], summary')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      control.click();
    }
  };

  root.addEventListener('pointerup', handlePointerUp, { capture: true });

  return {
    destroy() {
      root.removeEventListener('pointerup', handlePointerUp, { capture: true });
    }
  };
}
