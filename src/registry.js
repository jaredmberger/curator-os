const RegistryModule = (() => {
  function init() {
    const search = CuratorOS.byId('registrySearch');
    const results = CuratorOS.byId('registryResults');
    if (!search || !results) return;

    search.addEventListener('input', () => {
      const query = search.value.trim();
      results.textContent = query ? `Registry search ready for: ${query}` : '';
    });
  }

  return { init };
})();
