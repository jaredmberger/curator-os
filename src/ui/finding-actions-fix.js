export function installFindingActionsFix(root) {
  if (!root) return { destroy() {} };

  const clickHandler = (event) => {
    const button = event.target.closest('[data-navigation-url]');
    if (!button) return;
    const url = button.dataset.navigationUrl;
    if (url) window.location.href = url;
  };

  root.addEventListener('click', clickHandler);
  return { destroy() { root.removeEventListener('click', clickHandler); } };
}

export function findingNavigationButton(url, label, extraAttributes = '') {
  if (!url) return '';
  return `<button type="button" class="cos-worker-action-link" data-navigation-url="${escapeHtml(url)}" ${extraAttributes}>${escapeHtml(label)}</button>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}
