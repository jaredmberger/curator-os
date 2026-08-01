const SESSION_KEY = 'curatoros.extraction.lastSession';
const RETURN_KEY = 'curatoros.returnToExtractionAfterClear';

start();

function start() {
  document.addEventListener('click', handleExtractionControlClick, true);

  const observer = new MutationObserver(() => enhanceExtractionWorkspace());
  observer.observe(document.body, { childList: true, subtree: true });
  enhanceExtractionWorkspace();

  if (sessionStorage.getItem(RETURN_KEY) === '1') {
    sessionStorage.removeItem(RETURN_KEY);
    window.setTimeout(() => document.querySelector('#extract-knowledge')?.click(), 0);
  }
}

function handleExtractionControlClick(event) {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.id === 'select-all-candidates') {
    event.preventDefault();
    event.stopImmediatePropagation();
    setAllCandidates(true);
    return;
  }

  if (target.id === 'clear-candidates') {
    event.preventDefault();
    event.stopImmediatePropagation();
    setAllCandidates(false);
    return;
  }

  if (target.id === 'clear-loaded-extraction') {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearLoadedPage();
  }
}

function setAllCandidates(include) {
  const checkboxes = [...document.querySelectorAll('[data-candidate-include]')];
  if (!checkboxes.length) return;

  for (const checkbox of checkboxes) {
    checkbox.checked = include;
    checkbox.closest('.extraction-candidate')?.classList.toggle('selected', include);
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  updateSelectedMetric(checkboxes.filter((checkbox) => checkbox.checked).length);
}

function updateSelectedMetric(count) {
  const metrics = [...document.querySelectorAll('.extraction-metrics .metric')];
  const selected = metrics.find((metric) => metric.querySelector('span')?.textContent?.trim().toLowerCase() === 'selected');
  const value = selected?.querySelector('strong');
  if (value) value.textContent = String(count);
}

function enhanceExtractionWorkspace() {
  const source = document.querySelector('.extraction-source');
  if (!source || document.querySelector('#clear-loaded-extraction')) return;

  const actionHost = source.querySelector('.badges') || source;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.id = 'clear-loaded-extraction';
  clear.className = 'extraction-clear-page';
  clear.textContent = 'Clear loaded page';
  clear.title = 'Remove this page from the extraction workspace and start fresh';
  actionHost.append(clear);
}

function clearLoadedPage() {
  if (!confirm('Clear the loaded page from Extract Knowledge? This only clears the extraction session; it does not change Project Records or the source HTML.')) return;

  localStorage.removeItem(SESSION_KEY);
  const input = document.querySelector('#extract-html-file');
  if (input) input.value = '';
  sessionStorage.setItem(RETURN_KEY, '1');
  location.reload();
}
