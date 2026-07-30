export function installFindingCollapseControls(root) {
  if (!root) return { destroy() {} };

  const enhance = () => {
    root.querySelectorAll('.cos-worker-finding').forEach((card) => {
      if (card.querySelector('[data-finding-collapse]')) return;

      const head = card.querySelector('.cos-worker-finding-head');
      if (!head) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.findingCollapse = '';
      button.textContent = 'Collapse';
      button.setAttribute('aria-expanded', 'true');
      button.className = 'cos-worker-finding-collapse';
      head.append(button);

      let body = card.querySelector('[data-finding-body]');
      if (!body) {
        body = document.createElement('div');
        body.dataset.findingBody = '';
        while (head.nextSibling) body.append(head.nextSibling);
        card.append(body);
      }

      card.dataset.collapsed = 'false';
    });
  };

  enhance();
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(root, { childList: true, subtree: true });

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
