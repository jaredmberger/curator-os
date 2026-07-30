export function installFindingCardCollapseControls(root) {
  if (!root) return { destroy() {} };

  const enhanceCard = (card) => {
    if (!(card instanceof HTMLElement) || card.dataset.collapseEnhanced === 'true') return;

    const head = card.querySelector(':scope > .cos-worker-finding-head');
    if (!head) return;

    const body = document.createElement('div');
    body.dataset.findingBody = '';

    let sibling = head.nextSibling;
    while (sibling) {
      const next = sibling.nextSibling;
      body.append(sibling);
      sibling = next;
    }
    card.append(body);

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.findingCollapse = '';
    button.setAttribute('aria-expanded', 'true');
    button.textContent = 'Collapse';

    const severity = head.querySelector('.cos-worker-finding-severity');
    if (severity) {
      const controls = document.createElement('div');
      controls.className = 'cos-worker-finding-head-actions';
      severity.replaceWith(controls);
      controls.append(severity, button);
    } else {
      head.append(button);
    }

    card.dataset.collapsed = 'false';
    card.dataset.collapseEnhanced = 'true';
  };

  const enhanceAll = (scope = root) => {
    if (scope instanceof Element && scope.matches('.cos-worker-finding')) enhanceCard(scope);
    scope.querySelectorAll?.('.cos-worker-finding').forEach(enhanceCard);
  };

  enhanceAll();

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) enhanceAll(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
