const launcher = document.querySelector('#legacy-workspaces-launcher');
const root = document.querySelector('#legacy-workspaces-root');
const rebuiltApp = document.querySelector('#app');
let loading = false;

launcher?.addEventListener('click', async () => {
  if (!root || loading) return;

  const opening = root.hidden;
  if (!opening) {
    root.hidden = true;
    rebuiltApp?.removeAttribute('hidden');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.textContent = 'Full Workspaces';
    return;
  }

  root.hidden = false;
  rebuiltApp?.setAttribute('hidden', '');
  launcher.setAttribute('aria-expanded', 'true');
  launcher.textContent = root.dataset.mounted === 'true' ? 'Close Workspaces' : 'Loading Workspaces…';

  if (root.dataset.mounted === 'true') {
    launcher.textContent = 'Close Workspaces';
    root.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }

  loading = true;
  launcher.disabled = true;
  root.innerHTML = '<section class="panel"><span class="eyebrow">Full Workspaces</span><h3>Loading the knowledge-base workspaces…</h3><p>The stable CuratorOS shell remains available if a workspace module cannot load.</p></section>';

  try {
    const module = await import('./legacy-workspaces.js?v=20260731-guide-fix');
    root.innerHTML = '';
    module.mountLegacyWorkspaces(root);
    launcher.textContent = 'Close Workspaces';
    root.scrollIntoView({ behavior:'smooth', block:'start' });
  } catch (error) {
    console.error('Full Workspaces failed to load.', error);
    root.innerHTML = `<section class="panel"><span class="eyebrow">Full Workspaces</span><h3>The workspaces could not be loaded</h3><p>${escapeHtml(error?.message || String(error))}</p><p>Return to the rebuilt interface and reload CuratorOS. Your locally stored catalog has not been changed.</p><button type="button" id="workspace-retry">Try again</button></section>`;
    root.querySelector('#workspace-retry')?.addEventListener('click', () => {
      root.hidden = true;
      rebuiltApp?.removeAttribute('hidden');
      launcher.disabled = false;
      launcher.textContent = 'Full Workspaces';
      launcher.click();
    }, { once:true });
    launcher.textContent = 'Close Workspaces';
  } finally {
    loading = false;
    launcher.disabled = false;
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}
