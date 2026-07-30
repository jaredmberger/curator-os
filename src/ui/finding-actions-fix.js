export function installFindingActionsFix(root) {
  if (!root) return { refresh() {}, destroy() {} };

  const refresh = () => {
    root.querySelectorAll('.cos-worker-finding .cos-worker-actions').forEach((actions) => {
      actions.querySelectorAll('a[href]').forEach((link) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = link.className;
        button.dataset.navigationUrl = link.href;
        if (link.hasAttribute('data-page-studio-handoff')) button.dataset.pageStudioHandoff = '';
        button.textContent = link.textContent || 'Open';
        button.setAttribute('aria-label', link.getAttribute('aria-label') || button.textContent);
        link.replaceWith(button);
      });
    });
  };

  const clickHandler = (event) => {
    const button = event.target.closest('[data-navigation-url]');
    if (!button) return;
    const url = button.dataset.navigationUrl;
    if (url) window.location.href = url;
  };

  const observer = new MutationObserver(() => queueMicrotask(refresh));
  observer.observe(root, { childList: true, subtree: true });
  root.addEventListener('click', clickHandler);
  refresh();

  return {
    refresh,
    destroy() {
      observer.disconnect();
      root.removeEventListener('click', clickHandler);
    }
  };
}
