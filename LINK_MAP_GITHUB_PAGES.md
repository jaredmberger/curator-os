# CuratorOS Link Map — GitHub Pages deployment

CuratorOS is deployed with GitHub Pages. The Link Map therefore uses a prebuilt graph dataset rather than a server-side runtime API.

During each CuratorOS deployment:

1. GitHub Actions checks out `jaredmberger/Ocean-Liner-Curator` at `main` into `_oceanliners`.
2. `scripts/build-link-map-data.js` scans the website HTML files.
3. Canonical URLs are used as page identities when present.
4. Internal `<a href>` links are resolved and deduplicated.
5. `_site/link-map/link-map-data.json` is generated.
6. `link-map/static-index.html` is deployed as `_site/link-map/index.html`.

The production address is:

`https://curator.oceanliners.net/link-map/`

The map is regenerated whenever CuratorOS is deployed. The Reload Map button reloads the current deployed dataset.
