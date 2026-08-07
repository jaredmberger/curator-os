#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist-pages"
SITE_REPO="$ROOT/.build-oceanliners"

rm -rf "$OUT" "$SITE_REPO"
mkdir -p "$OUT/link-map" "$OUT/src"

# Publish the complete CuratorOS application at the Pages root.
cp -R "$ROOT/preview/." "$OUT/"
cp -R "$ROOT/src/." "$OUT/src/"

# Ensure the canonical version badge is loaded in production regardless of host.
python - <<'PY'
from pathlib import Path
path = Path('dist-pages/index.html')
html = path.read_text()
script = '  <script type="module" src="./version.js"></script>\n'
if script not in html:
    html = html.replace('</body>', script + '</body>')
path.write_text(html)
PY

# Build the Link Map from the current public Ocean Liner Curator repository.
cp "$ROOT/link-map/static-index.html" "$OUT/link-map/index.html"
git clone --depth 1 https://github.com/jaredmberger/Ocean-Liner-Curator.git "$SITE_REPO"
node "$ROOT/scripts/build-link-map-data.js" "$SITE_REPO" "$OUT/link-map/link-map-data.json"
rm -rf "$SITE_REPO"

# Cloudflare Pages serves these files directly; Functions are deployed separately
# from the repository's root /functions directory.
touch "$OUT/.nojekyll"

# Fail early rather than deploy an incomplete CuratorOS build.
test -f "$OUT/index.html"
test -f "$OUT/project-records-store.js"
test -f "$OUT/records-browser.js"
test -f "$OUT/record-editing.js"
test -f "$OUT/ship-record.js"
test -f "$OUT/ship-record.css"
test -f "$OUT/version.js"
test -f "$OUT/src/core/database.js"
test -f "$OUT/src/core/storage.js"
test -f "$OUT/link-map/link-map-data.json"
grep -q 'version.js' "$OUT/index.html"

echo "Built Cloudflare Pages artifact in dist-pages/"
