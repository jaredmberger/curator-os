// Canonical CuratorOS application version.
// Bump this value whenever a user-visible CuratorOS release is deployed.
export const CURATOROS_VERSION = '0.4.0';

window.CURATOROS_VERSION = CURATOROS_VERSION;
document.documentElement.dataset.curatorosVersion = CURATOROS_VERSION;

const topbar = document.querySelector('.topbar');
const titleBlock = topbar?.firstElementChild;
if (titleBlock && !titleBlock.querySelector('[data-curatoros-version]')) {
  const badge = document.createElement('span');
  badge.className = 'curatoros-version-badge';
  badge.dataset.curatorosVersion = '';
  badge.textContent = `v${CURATOROS_VERSION}`;
  badge.setAttribute('title', `CuratorOS version ${CURATOROS_VERSION}`);
  titleBlock.querySelector('.eyebrow')?.insertAdjacentElement('afterend', badge);
}

const style = document.createElement('style');
style.textContent = `
  .curatoros-version-badge{
    display:inline-flex;
    align-items:center;
    margin-top:.35rem;
    padding:.22rem .55rem;
    border:1px solid rgba(191,164,106,.45);
    border-radius:999px;
    background:rgba(191,164,106,.09);
    color:var(--accent,#bfa46a);
    font-size:.72rem;
    font-weight:700;
    letter-spacing:.04em;
  }
`;
document.head.append(style);
