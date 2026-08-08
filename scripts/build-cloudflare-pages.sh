#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist-pages"
SITE_REPO="$ROOT/.build-oceanliners"
VERSION="$(python - <<'PY'
import re
from pathlib import Path
text = Path('preview/version.js').read_text()
match = re.search(r"CURATOROS_VERSION\s*=\s*['\"]([^'\"]+)['\"]", text)
if not match:
    raise SystemExit('Could not determine CURATOROS_VERSION from preview/version.js')
print(match.group(1))
PY
)"

rm -rf "$OUT" "$SITE_REPO"
mkdir -p "$OUT/link-map" "$OUT/src"

# Publish the complete CuratorOS application at the Pages root.
cp -R "$ROOT/preview/." "$OUT/"
cp -R "$ROOT/src/." "$OUT/src/"

# Ensure the canonical version badge is loaded in production and add a release
# token to local JS/CSS URLs. The token is useful for release visibility, while
# _headers below now requires revalidation so a stale Safari/edge cache can never
# keep an older CuratorOS module indefinitely.
CURATOROS_BUILD_VERSION="$VERSION" python - <<'PY'
import os
import re
from pathlib import Path

version = os.environ['CURATOROS_BUILD_VERSION']
path = Path('dist-pages/index.html')
html = path.read_text()

script = '  <script type="module" src="./version.js"></script>\n'
if script not in html and './version.js' not in html:
    html = html.replace('</body>', script + '</body>')

pattern = re.compile(r'(?P<prefix>(?:src|href)=["\'])(?P<url>(?:\.\.?/|/)[^"\']+?\.(?:js|css))(?:\?v=[^"\']*)?(?P<suffix>["\'])')
html = pattern.sub(lambda m: f"{m.group('prefix')}{m.group('url')}?v={version}{m.group('suffix')}", html)
path.write_text(html)
PY

# Cloudflare Pages custom headers. CuratorOS is a frequently updated internal app,
# so correctness and freshness matter more than year-long immutable browser caches.
# `no-cache` allows Safari to retain a local copy, but requires revalidation before
# reuse; unchanged assets can still return efficiently via normal HTTP validation.
cat > "$OUT/_headers" <<EOF
/
  Cache-Control: no-cache, max-age=0, must-revalidate

/index.html
  Cache-Control: no-cache, max-age=0, must-revalidate

/*.html
  Cache-Control: no-cache, max-age=0, must-revalidate

/*.js
  Cache-Control: no-cache, max-age=0, must-revalidate

/*.css
  Cache-Control: no-cache, max-age=0, must-revalidate

/src/*.js
  Cache-Control: no-cache, max-age=0, must-revalidate

/src/*.css
  Cache-Control: no-cache, max-age=0, must-revalidate
EOF

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
test -f "$OUT/_headers"
test -f "$OUT/src/core/database.js"
test -f "$OUT/src/core/storage.js"
test -f "$OUT/link-map/link-map-data.json"
grep -q "version.js?v=$VERSION" "$OUT/index.html"
grep -q "Cache-Control: no-cache" "$OUT/_headers"

echo "Built Cloudflare Pages artifact in dist-pages/ (CuratorOS v$VERSION)"
