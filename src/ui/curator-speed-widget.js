export const CURATOR_SPEED_URL = 'https://speed.oceanliners.net/';

export function renderCuratorSpeedWidget() {
  return `<article class="cos-worker-scan-card cos-worker-speed-card">
    <span>Performance Intelligence</span>
    <p>Analyze an OceanLiners.net page for response time, transfer weight, image loading, caching, compression, and render-blocking resources.</p>
    <a class="cos-worker-action-link" href="${CURATOR_SPEED_URL}" target="_blank" rel="noopener noreferrer">Open Curator Speed</a>
  </article>`;
}
