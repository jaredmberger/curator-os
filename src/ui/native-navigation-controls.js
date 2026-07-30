export function installNativeNavigationControls(root) {
  if (!root) return { refresh() {}, destroy() {} };

  let queued = false;

  const refresh = () => {
    queued = false;
    root.querySelectorAll('button[data-suite-url]').forEach((button) => {
      const href = safeHttpUrl(button.dataset.suiteUrl);
      if (!href) return;

      const link = document.createElement('a');
      link.className = button.className;
      link.href = href;
      link.textContent = button.textContent || 'Open';
      link.setAttribute('aria-label', button.getAttribute('aria-label') || link.textContent);
      button.replaceWith(link);
    });
  };

  const queueRefresh = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  };

  const observer = new MutationObserver(queueRefresh);
  observer.observe(root, { childList: true, subtree: true });
  refresh();

  return {
    refresh,
    destroy() {
      observer.disconnect();
    }
  };
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
