const PAGE_STUDIO_URL = 'https://page-studio.oceanliners.net/';

export function installPageStudioHandoff(root) {
  if (!root) return { refresh() {}, destroy() {} };

  const refresh = () => {
    root.querySelectorAll('.cos-worker-finding').forEach((card) => enhanceFinding(card));
  };

  const observer = new MutationObserver(() => refresh());
  observer.observe(root, { childList: true, subtree: true });
  refresh();

  return {
    refresh,
    destroy() { observer.disconnect(); }
  };
}

function enhanceFinding(card) {
  const actions = card.querySelector('.cos-worker-actions');
  if (!actions) return;

  const existing = [...actions.querySelectorAll('a[href],button[data-suite-url]')]
    .find((control) => {
      const href = control.matches('a[href]') ? control.href : control.dataset.suiteUrl;
      return String(href || '').startsWith(PAGE_STUDIO_URL) || control.textContent?.trim() === 'Edit in Page Studio';
    });
  if (existing) return;

  const pageLink = [...actions.querySelectorAll('a[href]')]
    .find((link) => !link.href.startsWith(PAGE_STUDIO_URL));
  const pageUrl = safeOceanLinersUrl(pageLink?.href || '');
  if (!pageUrl) return;

  const title = card.querySelector('h2')?.textContent?.trim() || 'CuratorOS finding';
  const recommendation = findLabeledText(card, ['What to do next:', 'Maintenance note:']);
  const checkedUrl = findLabeledLink(card, 'Checked URL:');
  const replacementUrl = findLabeledLink(card, ['Suggested replacement:', 'Final destination:']);
  const category = card.querySelector('.cos-worker-finding-category')?.textContent?.trim() || '';

  const handoffUrl = new URL(PAGE_STUDIO_URL);
  handoffUrl.searchParams.set('url', pageUrl);
  handoffUrl.searchParams.set('source', 'curatoros');
  handoffUrl.searchParams.set('finding_title', title);
  if (category) handoffUrl.searchParams.set('finding_category', category);
  if (recommendation) handoffUrl.searchParams.set('recommendation', recommendation);
  if (checkedUrl) handoffUrl.searchParams.set('checked_url', checkedUrl);
  if (replacementUrl) handoffUrl.searchParams.set('replacement_url', replacementUrl);

  const link = document.createElement('a');
  link.className = 'cos-worker-action-link';
  link.href = handoffUrl.href;
  link.dataset.pageStudioHandoff = '';
  link.textContent = 'Edit in Page Studio';
  link.setAttribute('aria-label', `Edit ${title} in Page Studio`);

  if (pageLink?.nextSibling) actions.insertBefore(link, pageLink.nextSibling);
  else actions.prepend(link);
}

function findLabeledText(card, labels) {
  const expected = Array.isArray(labels) ? labels : [labels];
  for (const paragraph of card.querySelectorAll('p')) {
    const strong = paragraph.querySelector('strong');
    if (!strong || !expected.includes(strong.textContent?.trim())) continue;
    return paragraph.textContent.replace(strong.textContent, '').trim();
  }
  return '';
}

function findLabeledLink(card, labels) {
  const expected = Array.isArray(labels) ? labels : [labels];
  for (const paragraph of card.querySelectorAll('p')) {
    const strong = paragraph.querySelector('strong');
    if (!strong || !expected.includes(strong.textContent?.trim())) continue;
    return safeHttpUrl(paragraph.querySelector('a[href]')?.href || '');
  }
  return '';
}

function safeOceanLinersUrl(value) {
  const url = safeUrl(value);
  if (!url) return '';
  return ['oceanliners.net', 'www.oceanliners.net'].includes(url.hostname.toLowerCase()) ? url.href : '';
}

function safeHttpUrl(value) {
  return safeUrl(value)?.href || '';
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}
