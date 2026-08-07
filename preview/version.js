// Canonical CuratorOS application version.
// Bump this value whenever a user-visible CuratorOS release is deployed.
export const CURATOROS_VERSION = '0.1.0';

window.CURATOROS_VERSION = CURATOROS_VERSION;

document.querySelectorAll('[data-curatoros-version]').forEach((node) => {
  node.textContent = `v${CURATOROS_VERSION}`;
  node.setAttribute('title', `CuratorOS version ${CURATOROS_VERSION}`);
});

document.documentElement.dataset.curatorosVersion = CURATOROS_VERSION;
