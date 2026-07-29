export function installSafariLinkActivation(root) {
  if (!root) return { destroy() {} };

  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  if (!isSafari) return { destroy() {} };

  const handleTouchEnd = (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !root.contains(link)) return;
    if (link.dataset.safariTapHandled === 'true') return;

    const href = link.href;
    if (!href) return;

    link.dataset.safariTapHandled = 'true';
    setTimeout(() => { delete link.dataset.safariTapHandled; }, 500);

    event.preventDefault();
    event.stopPropagation();
    window.location.href = href;
  };

  root.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });

  return {
    destroy() {
      root.removeEventListener('touchend', handleTouchEnd, { capture: true });
    }
  };
}
