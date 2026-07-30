const IMPORTED_FINDINGS_KEY = 'curatoros.findings.imported';

export function installRedirectInformationSummary(root) {
  if (!root) return { refresh() {}, destroy() {} };

  const refresh = () => {
    const dashboard = root.querySelector('.cos-worker-dashboard');
    const list = dashboard?.querySelector('.cos-worker-findings-list');
    if (!dashboard || !list) return;

    const findings = readImportedFindings();
    const redirects = findings.filter(isSuccessfulRedirect);
    const actionable = findings.filter((item) => !isSuccessfulRedirect(item));

    if (redirects.length && actionable.length !== findings.length) {
      localStorage.setItem(IMPORTED_FINDINGS_KEY, JSON.stringify(actionable));
    }

    dashboard.querySelector('[data-redirect-information-summary]')?.remove();
    if (!redirects.length) return;

    const details = document.createElement('details');
    details.dataset.redirectInformationSummary = '';
    details.className = 'cos-worker-panel cos-worker-redirect-information';
    details.innerHTML = `<summary><strong>${redirects.length.toLocaleString()} successful redirect${redirects.length === 1 ? '' : 's'}</strong> · informational only</summary><p>These links ultimately returned a successful 2xx response. They are optional maintenance notes and are not included in the actionable findings queue.</p>`;
    list.after(details);
  };

  const observer = new MutationObserver(() => queueMicrotask(refresh));
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('storage', refresh);
  refresh();

  return {
    refresh,
    destroy() {
      observer.disconnect();
      window.removeEventListener('storage', refresh);
    }
  };
}

function readImportedFindings() {
  try {
    const value = JSON.parse(localStorage.getItem(IMPORTED_FINDINGS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function isSuccessfulRedirect(item) {
  if (!item || typeof item !== 'object') return false;
  const summary = String(item.summary || '').toLowerCase();
  const recommendation = String(item.recommendation || '').toLowerCase();
  return item.severity === 'low'
    && item.category === 'link-maintenance'
    && summary.includes('redirects successfully')
    && (summary.includes('returned 200') || recommendation.includes('no immediate action is required'));
}
