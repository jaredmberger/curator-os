# CuratorOS Link Map

`/link-map/` is an interactive internal-link graph and audit for Ocean Liner Curator.

## Features

- Live crawl of `https://oceanliners.net`
- Cytoscape force-directed graph with touch-friendly zoom/pan
- Search and page-type filters
- Incoming-only and outgoing-only focus views
- Weak-link and orphan detection
- Per-page incoming/outgoing link inspector
- Heuristic potential-connection suggestions based on shared graph neighbors
- CSV export for link-audit work
- Six-hour server-side cache when a KV binding is available

## Cloudflare Pages

The crawler lives at `functions/api/link-map.js`. It will use either of these KV bindings for cache storage, in this order:

1. `CURATOROS_LINK_MAP`
2. `CURATOROS_RECORDS`

A dedicated `CURATOROS_LINK_MAP` namespace is preferred, but the endpoint still works without KV; it will simply crawl live on each request.

The page is available at `/link-map/`. With the CuratorOS Pages project attached to `curator.oceanliners.net`, the intended URL is:

`https://curator.oceanliners.net/link-map/`

## Refresh behavior

Normal loads use cached graph data for up to six hours when KV is configured. The **Refresh crawl** button calls `/api/link-map?refresh=1` and rebuilds the graph from the live site.

## Scope

The crawler follows same-origin HTML pages only. It normalizes `www`, removes fragments and common campaign query parameters, rejects static assets, and caps discovery at 1,200 pages.
