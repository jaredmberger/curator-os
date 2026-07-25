const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('views/shell.html');
const css = read('styles/curatoros.css');
const modules = ['src/core.js', 'src/registry.js', 'src/startup.js'];
const js = modules.map(read).join('\n\n');

new vm.Script(js, { filename: 'curatoros-browser.js' });

const assembled = html
  .replace('/*__CURATOROS_CSS__*/', css)
  .replace('/*__CURATOROS_JS__*/', js);

if (assembled.includes('__CURATOROS_')) {
  throw new Error('Build failed: unresolved assembly token.');
}

const worker = `const HTML = ${JSON.stringify(assembled)};\n\nexport default {\n  async fetch() {\n    return new Response(HTML, {\n      headers: {\n        'content-type': 'text/html; charset=utf-8',\n        'cache-control': 'no-store'\n      }\n    });\n  }\n};\n`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/curatoros-worker.js'), worker);
fs.writeFileSync(path.join(root, 'dist/curatoros-worker.json'), worker);
console.log('Built dist/curatoros-worker.js');
