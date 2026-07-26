import { buildOlcManifest } from './olc-site-manifest-builder.js';

const SUPPORTED_EXTENSIONS = new Set(['.html', '.htm', '.json', '.js']);

export async function ingestGitHubCatalog(options = {}) {
  const owner = required(options.owner, 'Repository owner is required.');
  const repo = required(options.repo, 'Repository name is required.');
  const branch = String(options.branch || 'main').trim() || 'main';
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is not available in this browser.');

  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const treeResponse = await fetchImpl(treeUrl, { headers: { Accept: 'application/vnd.github+json' } });
  if (!treeResponse.ok) throw new Error(await githubError(treeResponse, 'Could not read the repository tree.'));
  const treePayload = await treeResponse.json();
  if (treePayload.truncated) throw new Error('GitHub returned a truncated repository tree; narrow the repository scope before importing.');

  const discovered = filterSupportedTree(treePayload.tree || []);
  if (!discovered.length) throw new Error('No supported OLC HTML, JSON, or JavaScript files were found in this repository.');

  const files = [];
  const fetchErrors = [];
  let completed = 0;
  for (const entry of discovered) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetchImpl(rawUrl);
      if (!response.ok) throw new Error(await githubError(response, 'File download failed.'));
      const text = await response.text();
      files.push(createVirtualFile(entry.path, text));
    } catch (error) {
      fetchErrors.push({ file: entry.path, reason: error instanceof Error ? error.message : String(error) });
    } finally {
      completed += 1;
      options.onProgress?.({ completed, total: discovered.length, path: entry.path });
    }
  }

  const manifest = await buildOlcManifest(files);
  manifest.repository = { owner, repo, branch, discovered: discovered.length, downloaded: files.length };
  manifest.report.fetchErrors = fetchErrors;
  manifest.report.files = discovered.length;

  return { manifest, discovered, fetchErrors };
}

export function filterSupportedTree(tree = []) {
  return tree
    .filter((entry) => entry?.type === 'blob' && isSupportedPath(entry.path))
    .filter((entry) => !isIgnoredPath(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function isSupportedPath(path = '') {
  const lower = String(path).toLowerCase();
  return [...SUPPORTED_EXTENSIONS].some((extension) => lower.endsWith(extension));
}

function isIgnoredPath(path = '') {
  return /(^|\/)(node_modules|dist|_site|coverage|vendor|\.git)(\/|$)/i.test(String(path));
}

function createVirtualFile(path, text) {
  return { name: path, async text() { return text; } };
}

async function githubError(response, fallback) {
  try {
    const payload = await response.json();
    return payload?.message ? `${fallback} GitHub says: ${payload.message}` : fallback;
  } catch {
    return `${fallback} HTTP ${response.status}.`;
  }
}

function required(value, message) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(message);
  return normalized;
}
