const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, ['scripts/validate.js'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build.js'], { cwd: root, stdio: 'inherit' });

const workerPath = path.join(root, 'dist/curatoros-worker.js');
const worker = fs.readFileSync(workerPath, 'utf8');

for (const required of ['registryView', 'overviewView', 'graphView', 'intelligenceView', "registry: ['Institutional index'"]) {
  if (!worker.includes(required)) throw new Error(`Smoke test failed: generated Worker lacks ${required}`);
}

if (worker.includes("el('registryView').classList")) {
  throw new Error('Smoke test failed: unsafe legacy Registry view access detected.');
}

if (worker.includes('labels[view][0]') && !worker.includes('if (!labels[view])')) {
  throw new Error('Smoke test failed: labels lookup is not guarded.');
}

console.log('Stable Keel smoke test passed.');
