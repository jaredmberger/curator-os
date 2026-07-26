import assert from 'node:assert/strict';
import { filterSupportedTree, ingestGitHubCatalog } from '../src/core/github-catalog-ingestion.js';

const tree = [
  { type: 'blob', path: 'ships/rms-olympic.html' },
  { type: 'blob', path: 'data/random-ship.js' },
  { type: 'blob', path: 'notes/readme.md' },
  { type: 'blob', path: 'node_modules/example.json' },
  { type: 'tree', path: 'ships' }
];

assert.deepEqual(filterSupportedTree(tree).map((entry) => entry.path), ['data/random-ship.js', 'ships/rms-olympic.html']);

const responses = new Map([
  ['https://api.github.com/repos/jaredmberger/ocean-liner-curator/git/trees/main?recursive=1', { ok: true, json: async () => ({ tree: [{ type: 'blob', path: 'ships/rms-olympic.html' }] }) }],
  ['https://raw.githubusercontent.com/jaredmberger/ocean-liner-curator/main/ships/rms-olympic.html', { ok: true, text: async () => '<title>RMS Olympic — Ship Guide</title><link rel="canonical" href="https://oceanliners.net/ships/rms-olympic"><meta name="description" content="Olympic guide"><dl><dt>Builder</dt><dd>Harland and Wolff</dd></dl>' }]
]);

const result = await ingestGitHubCatalog({
  owner: 'jaredmberger',
  repo: 'ocean-liner-curator',
  branch: 'main',
  fetchImpl: async (url) => responses.get(url) || { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) }
});

assert.equal(result.discovered.length, 1);
assert.equal(result.manifest.ships.length, 1);
assert.equal(result.manifest.ships[0].title, 'RMS Olympic');
assert.equal(result.manifest.repository.downloaded, 1);

console.log('GitHub catalog ingestion tests passed.');
