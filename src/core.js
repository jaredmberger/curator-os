const CuratorOS = (() => {
  const labels = Object.freeze({
    overview: ['Voyage III', 'Captain’s Brief'],
    registry: ['Institutional index', 'The Registry'],
    graph: ['Knowledge structure', 'Relationship Graph'],
    intelligence: ['Knowledge Genome', 'Intelligence']
  });

  const requiredViews = Object.keys(labels);
  const byId = id => document.getElementById(id);

  function assertElement(id) {
    const node = byId(id);
    if (!node) throw new Error(`CuratorOS structural error: missing #${id}`);
    return node;
  }

  function switchView(view) {
    if (!labels[view]) {
      console.warn(`CuratorOS ignored unknown view: ${view}`);
      return false;
    }

    requiredViews.forEach(name => {
      const panel = assertElement(`${name}View`);
      panel.hidden = name !== view;
    });

    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.toggleAttribute('aria-current', active);
    });

    assertElement('viewEyebrow').textContent = labels[view][0];
    assertElement('viewTitle').textContent = labels[view][1];
    return true;
  }

  return { labels, requiredViews, byId, assertElement, switchView };
})();
