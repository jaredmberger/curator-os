const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'views/shell.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/core.js'), 'utf8');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`Duplicate HTML IDs: ${[...new Set(duplicates)].join(', ')}`);

const navViews = [...html.matchAll(/data-view="([^"]+)"/g)].map(match => match[1]);
const panels = [...html.matchAll(/data-view-panel="([^"]+)"/g)].map(match => match[1]);

for (const view of navViews) {
  if (!panels.includes(view)) throw new Error(`Navigation view has no panel: ${view}`);
  if (!html.includes(`id="${view}View"`)) throw new Error(`Missing view element: ${view}View`);
  if (!new RegExp(`\\b${view}:\\s*\\[`).test(core)) throw new Error(`Missing labels entry: ${view}`);
}

const requiredLookups = [...core.matchAll(/assertElement\('([^']+)'\)/g)].map(match => match[1]);
for (const id of requiredLookups) {
  if (!ids.includes(id)) throw new Error(`Required DOM element is missing: #${id}`);
}

console.log(`Validated ${navViews.length} views and ${ids.length} unique DOM IDs.`);
