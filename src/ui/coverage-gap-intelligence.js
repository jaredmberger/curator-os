const COVERAGE_KEY = 'curatoros.coverage.index.v1';

export function installCoverageGapIntelligence(root, { recordService } = {}) {
  if (!root) return { refresh() {}, destroy() {} };
  installStyles();

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  input.dataset.coverageIndexFile = '';
  root.append(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      const pages = extractPages(value);
      if (!pages.length) throw new Error('No indexed pages were found in this file.');
      localStorage.setItem(COVERAGE_KEY, JSON.stringify({ importedAt: new Date().toISOString(), fileName: file.name, pages }));
      refresh();
    } catch (error) {
      alert(`Could not import coverage index: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = '';
    }
  });

  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(root, recordService, input);
    });
  };

  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });
  const unsubscribe = recordService?.subscribe?.(refresh) || (() => {});
  refresh();

  return { refresh, destroy() { observer.disconnect(); unsubscribe(); input.remove(); } };
}

function render(root, recordService, input) {
  const anchor = root.querySelector('[data-site-assurance-readiness]') || root.querySelector('.cos-worker-scan-launchers');
  if (!anchor) return;
  const existing = root.querySelector('[data-coverage-gap-intelligence]');
  const panel = existing || document.createElement('section');
  panel.dataset.coverageGapIntelligence = '';
  panel.className = 'cos-coverage';

  const snapshot = readSnapshot();
  const records = recordService?.all?.() || [];
  if (!snapshot) {
    panel.innerHTML = `<div class="cos-coverage__head"><div><span class="cos-eyebrow">Coverage intelligence</span><h2>Import a fresh site index</h2><p>Compare CuratorOS canonical records with the pages Curator Indexer actually found.</p></div><button type="button" data-coverage-import>Import site-index.json</button></div>`;
  } else {
    const report = compareCoverage(records, snapshot.pages);
    const totalGaps = report.missingPages.length + report.unmatchedPages.length + report.missingBuilderPages.length + report.missingLinePages.length;
    panel.innerHTML = `<div class="cos-coverage__head"><div><span class="cos-eyebrow">Coverage intelligence</span><h2>${totalGaps ? `${totalGaps} coverage gap${totalGaps === 1 ? '' : 's'} found` : 'Canonical and indexed coverage agree'}</h2><p>${escapeHtml(snapshot.fileName)} imported ${escapeHtml(formatDate(snapshot.importedAt))}. Comparisons use normalized titles, paths, and record roles.</p></div><button type="button" data-coverage-import>Refresh index</button></div>
      <div class="cos-coverage__metrics">
        ${metric(report.shipRecords, 'canonical ships')}${metric(report.shipPages, 'indexed ship guides')}${metric(report.missingPages.length, 'missing guides')}${metric(report.unmatchedPages.length, 'unmatched guides')}${metric(report.missingBuilderPages.length, 'builder gaps')}${metric(report.missingLinePages.length, 'line gaps')}
      </div>
      <div class="cos-coverage__groups">
        ${renderGroup('Canonical ships missing an indexed guide', report.missingPages, 'Create or restore the ship guide.')}
        ${renderGroup('Indexed ship guides without a canonical ship record', report.unmatchedPages, 'Add or reconcile the canonical record.')}
        ${renderGroup('Shipbuilders missing an indexed builder page', report.missingBuilderPages, 'Create or connect the builder page.')}
        ${renderGroup('Shipping lines missing an indexed line or hub page', report.missingLinePages, 'Create or connect the shipping-line page.')}
      </div>`;
  }

  panel.querySelector('[data-coverage-import]')?.addEventListener('click', () => input.click());
  if (!existing) anchor.after(panel);
}

function compareCoverage(records, pages) {
  const normalizedPages = pages.map((page) => ({ ...page, key: pageKey(page) }));
  const shipPages = normalizedPages.filter(isShipPage);
  const builderPages = normalizedPages.filter((page) => pageType(page).includes('builder') || pathOf(page).includes('/builders/'));
  const linePages = normalizedPages.filter((page) => /shipping[- ]?line|line hub|company hub/.test(pageType(page)) || /\/(lines|shipping-lines)\//.test(pathOf(page)));

  const ships = records.filter((record) => record.type === 'ship');
  const builders = records.filter(isBuilderRecord);
  const lines = records.filter(isLineRecord);

  const missingPages = ships.filter((record) => !matchesAny(record, shipPages)).map(recordItem);
  const unmatchedPages = shipPages.filter((page) => !ships.some((record) => matches(record, page))).map(pageItem);
  const missingBuilderPages = builders.filter((record) => !matchesAny(record, builderPages)).map(recordItem);
  const missingLinePages = lines.filter((record) => !matchesAny(record, linePages)).map(recordItem);

  return { shipRecords: ships.length, shipPages: shipPages.length, missingPages, unmatchedPages, missingBuilderPages, missingLinePages };
}

function extractPages(value) {
  const pages = value?.pages || value?.entities?.pages || value?.index?.pages || [];
  if (!Array.isArray(pages)) return [];
  return pages.map((page) => ({
    title: page?.title || page?.name || '',
    url: page?.url || page?.canonical || '',
    path: page?.path || page?.filePath || page?.pathname || '',
    pageType: page?.pageType || page?.type || page?.template || ''
  })).filter((page) => page.title || page.url || page.path);
}

function matchesAny(record, pages) { return pages.some((page) => matches(record, page)); }
function matches(record, page) {
  const recordKeys = new Set([record.title, record.name, record.id, record.data?.slug, record.data?.url, record.data?.path].map(normalize).filter(Boolean));
  const pageKeys = new Set([page.title, page.url, page.path, page.key].map(normalize).filter(Boolean));
  for (const key of recordKeys) if (pageKeys.has(key)) return true;
  const slug = slugify(record.title || record.name || record.id || '');
  return Boolean(slug && [...pageKeys].some((key) => key.endsWith(`/${slug}`) || key.endsWith(`/${slug}.html`) || key === slug));
}
function isShipPage(page) { const type = pageType(page); const path = pathOf(page); return type.includes('ship') || path.includes('/ships/'); }
function isBuilderRecord(record) { return record.type === 'builder' || (record.type === 'company' && roleText(record).includes('shipbuilder')); }
function isLineRecord(record) { return record.type === 'shipping-line' || record.type === 'line' || (record.type === 'company' && roleText(record).includes('shipping line')); }
function roleText(record) { return [record.data?.role, record.data?.companyType, ...(record.tags || [])].join(' ').toLowerCase(); }
function pageType(page) { return String(page.pageType || '').toLowerCase(); }
function pathOf(page) { try { return new URL(page.url || page.path || '', 'https://oceanliners.net').pathname.toLowerCase(); } catch { return String(page.path || '').toLowerCase(); } }
function pageKey(page) { return normalize(pathOf(page)) || normalize(page.title); }
function recordItem(record) { return { title: record.title || record.name || record.id || 'Untitled record', detail: record.id || record.type || 'record' }; }
function pageItem(page) { return { title: page.title || pathOf(page) || page.url || 'Untitled page', detail: page.url || page.path || page.pageType || 'indexed page' }; }
function normalize(value) { return String(value || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?oceanliners\.net/i, '').replace(/\.html?$/i, '').replace(/[?#].*$/, '').replace(/[^a-z0-9/]+/g, '-').replace(/^-+|-+$/g, ''); }
function slugify(value) { return normalize(value).split('/').filter(Boolean).pop() || ''; }

function renderGroup(title, items, guidance) {
  return `<details class="cos-coverage__group"${items.length ? '' : ' open'}><summary><span>${escapeHtml(title)}</span><strong>${items.length}</strong></summary>${items.length ? `<p>${escapeHtml(guidance)}</p><div>${items.slice(0, 50).map((item) => `<article><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></article>`).join('')}</div>${items.length > 50 ? `<small>Showing the first 50 of ${items.length} items.</small>` : ''}` : '<p>No gaps detected in this category.</p>'}</details>`;
}
function metric(value, label) { return `<div><strong>${Number(value).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`; }
function readSnapshot() { try { const value = JSON.parse(localStorage.getItem(COVERAGE_KEY) || 'null'); return value?.pages && Array.isArray(value.pages) ? value : null; } catch { return null; } }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'on an unknown date' : date.toLocaleString(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }

function installStyles() {
  if (document.querySelector('[data-coverage-gap-styles]')) return;
  const style = document.createElement('style');
  style.dataset.coverageGapStyles = '';
  style.textContent = `
    .cos-coverage{margin:1rem 0;padding:1.15rem;border:1px solid rgba(191,164,106,.36);border-radius:18px;background:rgba(8,20,18,.94)}
    .cos-coverage__head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}.cos-coverage__head h2{margin:.25rem 0}.cos-coverage__head p{margin:.35rem 0 0;max-width:72ch}
    .cos-coverage__metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.6rem;margin:1rem 0}.cos-coverage__metrics>div{display:grid;gap:.15rem;padding:.7rem;border:1px solid rgba(191,164,106,.2);border-radius:12px}.cos-coverage__metrics strong{font-size:1.2rem}.cos-coverage__metrics span{font-size:.78rem;opacity:.72}
    .cos-coverage__groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}.cos-coverage__group{padding:.8rem;border:1px solid rgba(191,164,106,.22);border-radius:13px}.cos-coverage__group summary{display:flex;justify-content:space-between;gap:.75rem;cursor:pointer;font-weight:700}.cos-coverage__group>div{display:grid;gap:.45rem;margin-top:.65rem}.cos-coverage__group article{display:grid;gap:.15rem;padding:.55rem;border-radius:9px;background:rgba(255,255,255,.03)}.cos-coverage__group small{opacity:.7;overflow-wrap:anywhere}
    @media(max-width:900px){.cos-coverage__metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:680px){.cos-coverage__head{display:grid}.cos-coverage__groups{grid-template-columns:1fr}.cos-coverage__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.cos-coverage__head button{width:100%}}
  `;
  document.head.append(style);
}
