export function installNativeNavigationControls(root) {
  if (!root) return { destroy() {} };

  const suiteControls = root.querySelectorAll('button[data-suite-url]');
  suiteControls.forEach((button) => {
    const href = safeHttpUrl(button.dataset.suiteUrl);
    if (!href) return;

    const link = document.createElement('a');
    link.className = button.className;
    link.href = href;
    link.textContent = button.textContent || 'Open';
    link.setAttribute('aria-label', button.getAttribute('aria-label') || link.textContent);
    button.replaceWith(link);
  });

  return { destroy() {} };
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
