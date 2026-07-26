import assert from 'node:assert/strict';
import { buildOlcManifest } from '../src/core/olc-site-manifest-builder.js';

function file(name, content) {
  return { name, async text() { return content; } };
}

const html = `<!doctype html><html><head>
<title>RMS Olympic — Ship Guide | Ocean Liner Curator</title>
<meta name="description" content="Evidence-first guide to RMS Olympic.">
<link rel="canonical" href="https://oceanliners.net/ships/rms-olympic">
<meta property="og:image" content="https://oceanliners.net/images/olympic.jpg">
</head><body><h1>RMS Olympic</h1><dl><dt>Builder</dt><dd>Harland and Wolff</dd><dt>Shipping line</dt><dd>White Star Line</dd><dt>Launched</dt><dd>20 October 1910</dd></dl></body></html>`;

const json = JSON.stringify({ builders: [{ name: 'Harland and Wolff', city: 'Belfast' }], shippingLines: [{ name: 'White Star Line' }] });
const js = `const ships = ["/ships/rms-aquitania.html"];`;

const manifest = await buildOlcManifest([
  file('rms-olympic.html', html),
  file('catalog.json', json),
  file('random-ship.js', js),
  file('notes.txt', 'unsupported')
]);

assert.equal(manifest.format, 'ocean-liner-curator-site-manifest');
assert.equal(manifest.ships.length, 2);
assert.equal(manifest.ships[0].title, 'RMS Olympic');
assert.equal(manifest.ships[0].builder, 'Harland and Wolff');
assert.equal(manifest.ships[0].operator, 'White Star Line');
assert.equal(manifest.builders.length, 1);
assert.equal(manifest.shippingLines.length, 1);
assert.equal(manifest.report.recognized, 3);
assert.equal(manifest.report.skipped.length, 1);

const duplicate = await buildOlcManifest([file('a.html', html), file('b.html', html)]);
assert.equal(duplicate.ships.length, 1);
assert.equal(duplicate.report.duplicates.length, 1);

console.log('olc-site-manifest-builder tests passed');
