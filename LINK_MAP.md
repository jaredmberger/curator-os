# CuratorOS Link Map

`/link-map/` is an interactive internal-link graph and audit for Ocean Liner Curator.

## Features

- Cytoscape force-directed graph with touch-friendly zoom/pan
- Search and page-type filters
- Incoming-only and outgoing-only focus views
- Weak-link and orphan detection
- Per-page incoming/outgoing link inspector
- Heuristic potential-connection suggestions based on shared graph neighbors
- CSV export for link-audit work

## GitHub Pages architecture

CuratorOS is deployed with GitHub Pages, so the Link Map uses a generated static dataset rather than a runtime server function.

During each CuratorOS deployment, GitHub Actions checks out `jaredmberger/Ocean-Liner-Curator` at `main` and runs `scripts/build-link-map-data.js`. The generator scans HTML files, uses canonical URLs as page identities when available, resolves internal links, deduplicates edges, and writes:

`_site/link-map/link-map-data.json`

The Link Map application is deployed as:

`_site/link-map/index.html`

Production URL:

`https://curator.oceanliners.net/link-map/`

## Refresh behavior

The graph dataset is regenerated whenever CuratorOS deploys. The **Reload map** button reloads the currently deployed dataset without requiring a server-side API.

This architecture avoids browser CORS limitations and requires no Cloudflare Pages Function or KV binding.
