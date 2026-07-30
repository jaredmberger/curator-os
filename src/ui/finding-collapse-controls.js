const FINDING_SELECTOR = '.cos-worker-finding';
const ACTIONS_SELECTOR = '.cos-worker-actions';

export function installFindingCollapseControls(root) {
  if (!root) return { destroy() {} };

  let queued = false;

  const enhance = () => {
    queued = false;
    root.querySelectorAll(FINDING_SELECTOR).forEach((card) => {
      if (card.dataset.collapseReady === 'true') return;

      const actions = card.querySelector(ACTIONS_SELECTOR);
      if (!actions) return;

      const body = document.createElement('div');
      body.dataset.findingBody = '';

      const movable = [...card.children].filter((child) => child !== actions);
      movable.forEach((child) => body.append(child));
      card.insertBefore(body, actions);

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.findingCollapse = '';
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'Collapse';
      actions.prepend(button);

      card.dataset.collapsed = 'false';
      card.dataset.collapseReady = 'true';
    });
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(enhance);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches?.(FINDING_SELECTOR) || node.querySelector?.(FINDING_SELECTOR))))) {
      schedule();
    }
  });

  observer.observe(root, { childList: true, subtree: true });
  schedule();

  return {
    destroy() {
      observer.disconnect();
    }
  };
}

const root = document.querySelector('#curatoros-preview');
if (root) installFindingCollapseControls(root);
