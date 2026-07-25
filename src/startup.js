document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => CuratorOS.switchView(button.dataset.view));
  });

  RegistryModule.init();
  CuratorOS.switchView('overview');
});
